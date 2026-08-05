import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { createMockPrismaService } from '../../test/mocks/prisma.mock';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      generateApiKey: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should register a user', async () => {
    authService.register.mockResolvedValue({
      user: { id: '1' } as any,
      tokens: { accessToken: 'at', refreshToken: 'rt', expiresIn: 900, tokenType: 'Bearer' },
    });

    const result = await controller.register({
      email: 'test@test.com',
      displayName: 'Test',
      password: 'pass123',
    });

    expect(result.tokens.accessToken).toBe('at');
    expect(authService.register).toHaveBeenCalled();
  });

  it('should login', async () => {
    authService.login.mockResolvedValue({
      user: { id: '1' } as any,
      tokens: { accessToken: 'at', refreshToken: 'rt', expiresIn: 900, tokenType: 'Bearer' },
    });

    const result = await controller.login({ email: 'test@test.com', password: 'pass' });
    expect(result.tokens.accessToken).toBe('at');
    expect(authService.login).toHaveBeenCalled();
  });

  it('should refresh token', async () => {
    authService.refreshToken.mockResolvedValue({
      accessToken: 'new_at',
      refreshToken: 'new_rt',
      expiresIn: 900,
      tokenType: 'Bearer',
    });

    const result = await controller.refresh({ refreshToken: 'old_rt' });
    expect(result.accessToken).toBe('new_at');
  });

  it('should logout', async () => {
    await controller.logout({ user: { sub: 'user_1' } } as any);
    expect(authService.logout).toHaveBeenCalledWith('user_1');
  });

  it('should create API key', async () => {
    authService.generateApiKey.mockResolvedValue({ rawKey: 'epay_abc' });

    const result = await controller.createApiKey(
      { user: { sub: 'user_1' } } as any,
      { name: 'Test Key', permissions: ['read:payments'] },
    );

    expect(result.rawKey).toBe('epay_abc');
  });
});
