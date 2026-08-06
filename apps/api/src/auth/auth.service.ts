import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { WalletAuthDto } from './dto/wallet-auth.dto';
import type { AuthTokens, User } from '@epay/types';

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

    const passwordHash = dto.password
      ? await this.hashPassword(dto.password)
      : null;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        role: dto.role ?? 'CUSTOMER',
        stellarPublicKey: dto.stellarPublicKey,
        passwordHash,
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
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await this.verifyPassword(password, user.passwordHash);
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
    _signature: string,
    _message?: string,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // Validate Stellar public key format
    if (!/^G[A-Z2-7]{55}$/.test(stellarPublicKey)) {
      throw new UnauthorizedException('Invalid Stellar public key');
    }

    let user = await this.prisma.user.findUnique({
      where: { stellarPublicKey },
    });

    if (!user) {
      // Auto-register wallet user
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

  private sanitizeUser(user: any): User {
    const { passwordHash, refreshToken, twoFactorSecret, ...safe } = user;
    return safe as User;
  }

  private async hashPassword(password: string): Promise<string> {
    return crypto.scryptSync(password, 'epay_salt', 64).toString('hex');
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const computed = crypto.scryptSync(password, 'epay_salt', 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  }

  private hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}
