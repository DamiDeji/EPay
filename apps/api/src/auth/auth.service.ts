import * as crypto from 'crypto';

import type { AuthTokens, User } from '@epay/types';
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Keypair } from '@stellar/stellar-sdk';

import { PrismaService } from '../database/prisma.service';

import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

/** Stellar public key format: G + 55 base32 chars (56 total) */
const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;

/** Number of random salt bytes for password hashing */
const PASSWORD_SALT_BYTES = 16;

/** scrypt key length for password hashing */
const PASSWORD_KEY_LENGTH = 64;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: User; tokens: AuthTokens }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    let passwordHash: string | null = null;
    let passwordSalt: string | null = null;

    if (dto.password) {
      passwordSalt = crypto.randomBytes(PASSWORD_SALT_BYTES).toString('hex');
      passwordHash = this.hashPassword(dto.password, passwordSalt);
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        role: dto.role ?? 'CUSTOMER',
        stellarPublicKey: dto.stellarPublicKey,
        passwordHash,
        passwordSalt,
      },
    });

    const tokens = await this.generateTokens(user.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<{ user: User; tokens: AuthTokens }> {
    if (dto.email && dto.password) {
      return this.loginWithEmail(dto.email, dto.password);
    }
    if (dto.stellarPublicKey && dto.signature) {
      return this.loginWithWallet(dto.stellarPublicKey, dto.signature, dto.message);
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  private async loginWithEmail(
    email: string,
    password: string,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!user?.passwordHash || !user?.passwordSalt) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = this.verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  private async loginWithWallet(
    stellarPublicKey: string,
    signature: string,
    message?: string,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // Validate Stellar public key format
    if (!STELLAR_PUBLIC_KEY_REGEX.test(stellarPublicKey)) {
      throw new UnauthorizedException('Invalid Stellar public key');
    }

    // Verify the Ed25519 signature against the public key
    const authMessage = message ?? 'Login to EPay';
    const isSignatureValid = this.verifyStellarSignature(
      stellarPublicKey,
      authMessage,
      signature,
    );

    if (!isSignatureValid) {
      this.logger.warn(
        `Invalid wallet signature for public key: ${stellarPublicKey.slice(0, 8)}...`,
      );
      throw new UnauthorizedException('Invalid wallet signature');
    }

    let user = await this.prisma.user.findUnique({
      where: { stellarPublicKey },
    });

    if (!user) {
      // Auto-register wallet user after successful signature verification
      user = await this.prisma.user.create({
        data: {
          email: `stellar_${stellarPublicKey.slice(0, 8)}@epay.internal`,
          displayName: `Stellar ${stellarPublicKey.slice(0, 6)}...${stellarPublicKey.slice(-4)}`,
          role: 'CUSTOMER',
          stellarPublicKey,
        },
      });
    }

    const tokens = await this.generateTokens(user.id);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findFirst({
      where: { refreshToken },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return tokens;
  }

  async validateApiKey(apiKey: string): Promise<User | null> {
    const keyHash = this.hashApiKey(apiKey);
    const prefix = apiKey.slice(0, 8);

    const key = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        prefix,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        user: true,
        merchant: true,
      },
    });

    if (!key) return null;

    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return key.user ? this.sanitizeUser(key.user) : null;
  }

  async generateApiKey(
    userId: string,
    merchantId: string | undefined,
    name: string,
    permissions: string[],
  ): Promise<{ rawKey: string }> {
    const rawKey = `epay_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = this.hashApiKey(rawKey);
    const prefix = rawKey.slice(0, 8);

    await this.prisma.apiKey.create({
      data: {
        keyHash,
        prefix,
        name,
        permissions: permissions as any[],
        userId,
        merchantId,
      },
    });

    return { rawKey };
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  private async generateTokens(userId: string): Promise<AuthTokens> {
    const payload = { sub: userId };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private sanitizeUser(user: any): User {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, passwordSalt, refreshToken, twoFactorSecret, ...safe } = user;
    return safe as User;
  }

  /**
   * Hash a password using scrypt with a per-user random salt.
   * @returns hex-encoded derived key (not a combined format; salt is stored separately)
   */
  private hashPassword(password: string, salt: string): string {
    return crypto
      .scryptSync(password, salt, PASSWORD_KEY_LENGTH)
      .toString('hex');
  }

  /**
   * Verify a password against a stored hash using the user's unique salt.
   * Uses timing-safe comparison to prevent timing attacks.
   */
  private verifyPassword(password: string, storedHash: string, salt: string): boolean {
    const computed = crypto
      .scryptSync(password, salt, PASSWORD_KEY_LENGTH)
      .toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
  }

  /**
   * Verify an Ed25519 signature against a Stellar public key.
   * Uses the Stellar SDK's Keypair for cryptographic verification.
   *
   * @param publicKey - Stellar G-address (56 chars, base32 encoded Ed25519 key)
   * @param message   - The original message that was signed
   * @param signature - Base64-encoded Ed25519 signature from the wallet
   */
  private verifyStellarSignature(
    publicKey: string,
    message: string,
    signature: string,
  ): boolean {
    try {
      const keypair = Keypair.fromPublicKey(publicKey);
      const dataBuffer = Buffer.from(message, 'utf-8');
      const signatureBuffer = Buffer.from(signature, 'base64');
      return keypair.verify(dataBuffer, signatureBuffer);
    } catch (error: unknown) {
      this.logger.warn(
        `Stellar signature verification error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}
