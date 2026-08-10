import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

const TEST_PASSWORD = 'password123';
const TEST_SALT = crypto.randomBytes(16).toString('hex');
const TEST_HASH = crypto.scryptSync(TEST_PASSWORD, TEST_SALT, 64).toString('hex');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let jwt: JwtService;

  const mockUser = {
    id: 'user_1',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'CUSTOMER',
    stellarPublicKey: null,
    avatarUrl: null,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    passwordHash: TEST_HASH,
    passwordSalt: TEST_SALT,
    refreshToken: 'old_refresh_token',
    createdAt: mockDate(),
    updatedAt: mockDate(),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwt = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    it('should register a new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      (jwt.signAsync as jest.Mock).mockResolvedValueOnce('access_token');
      (jwt.signAsync as jest.Mock).mockResolvedValueOnce('refresh_token');

      const result = await service.register({
        email: 'test@example.com',
        displayName: 'Test User',
        password: TEST_PASSWORD,
      });

      expect(result.tokens.accessToken).toBe('access_token');
      expect(result.tokens.refreshToken).toBe('refresh_token');
      expect(result.tokens.tokenType).toBe('Bearer');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          displayName: 'Test User',
          password: TEST_PASSWORD,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login with email and password', async () => {
      const userWithHash = { ...mockUser, passwordHash: TEST_HASH, passwordSalt: TEST_SALT };
      prisma.user.findUnique.mockResolvedValue(userWithHash);
      prisma.user.update.mockResolvedValue(userWithHash);
      (jwt.signAsync as jest.Mock).mockResolvedValueOnce('access_token');
      (jwt.signAsync as jest.Mock).mockResolvedValueOnce('refresh_token');

      const result = await service.login({
        email: 'test@example.com',
        password: TEST_PASSWORD,
      });

      expect(result.tokens.accessToken).toBe('access_token');
    });

    it('should throw UnauthorizedException with wrong credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: TEST_HASH,
        passwordSalt: TEST_SALT,
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong_password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if no credentials provided', async () => {
      await expect(service.login({})).rejects.toThrow(UnauthorizedException);
    });

    it('should auto-register wallet user on first login with valid signature', async () => {
      // Generate a real Stellar keypair for testing
      const testKeypair = Keypair.random();
      const testPublicKey = testKeypair.publicKey();
      const testMessage = 'Login to EPay';
      const testSignature = testKeypair.sign(Buffer.from(testMessage, 'utf-8')).toString('base64');

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        email: `stellar_${testPublicKey.slice(0, 8)}@epay.internal`,
        stellarPublicKey: testPublicKey,
      });
      prisma.user.update.mockResolvedValue(mockUser);
      (jwt.signAsync as jest.Mock).mockResolvedValueOnce('access_token');
      (jwt.signAsync as jest.Mock).mockResolvedValueOnce('refresh_token');

      const result = await service.login({
        stellarPublicKey: testPublicKey,
        signature: testSignature,
        message: testMessage,
      });

      expect(result.tokens.accessToken).toBe('access_token');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should reject login with invalid wallet signature', async () => {
      const testKeypair = Keypair.random();
      const testPublicKey = testKeypair.publicKey();
      const fakeSignature = Buffer.from('not_a_real_signature').toString('base64');

      await expect(
        service.login({
          stellarPublicKey: testPublicKey,
          signature: fakeSignature,
          message: 'Login to EPay',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      (jwt.signAsync as jest.Mock).mockResolvedValueOnce('new_access');
      (jwt.signAsync as jest.Mock).mockResolvedValueOnce('new_refresh');

      const result = await service.refreshToken('valid_refresh');

      expect(result.accessToken).toBe('new_access');
      expect(result.refreshToken).toBe('new_refresh');
    });

    it('should throw if refresh token invalid', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.refreshToken('bad_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should clear refresh token', async () => {
      prisma.user.update.mockResolvedValue(mockUser);

      await service.logout('user_1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        data: { refreshToken: null },
      });
    });
  });

  describe('validateApiKey', () => {
    it('should return user for valid API key', async () => {
      prisma.apiKey.findFirst.mockResolvedValue({
        id: 'key_1',
        user: mockUser,
        merchant: null,
      });

      const result = await service.validateApiKey('epay_valid_key_here');
      expect(result).toBeDefined();
      expect(result?.id).toBe('user_1');
    });

    it('should return null for invalid API key', async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);

      const result = await service.validateApiKey('bad_key');
      expect(result).toBeNull();
    });
  });

  describe('generateApiKey', () => {
    it('should create a new API key', async () => {
      prisma.apiKey.create.mockResolvedValue({ id: 'key_1' } as any);

      const result = await service.generateApiKey('user_1', undefined, 'Test Key', [
        'read:payments',
      ]);

      expect(result.rawKey).toMatch(/^epay_/);
      expect(prisma.apiKey.create).toHaveBeenCalled();
    });
  });
});
