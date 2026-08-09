import { Test, TestingModule } from '@nestjs/testing';
import { MerchantService } from './merchant.service';
import { PrismaService } from '../database/prisma.service';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

describe('MerchantService', () => {
  let service: MerchantService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockMerchant = {
    id: 'merch_1',
    userId: 'user_1',
    businessName: 'Test Store',
    businessEmail: 'merchant@test.com',
    businessUrl: 'https://test.com',
    description: 'A test store',
    status: 'ACTIVE',
    verificationLevel: 'VERIFIED',
    supportedCurrencies: ['XLM'],
    feeRate: 50,
    settlementAddress: 'GAD_test',
    webhookUrl: 'https://test.com/webhook',
    webhookSecret: 'whsec_test',
    metadata: {},
    createdAt: mockDate(),
    updatedAt: mockDate(),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [MerchantService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<MerchantService>(MerchantService);
  });

  describe('register', () => {
    it('should create a new merchant', async () => {
      prisma.merchant.findUnique.mockResolvedValue(null);
      prisma.merchant.create.mockResolvedValue(mockMerchant);

      const result = await service.register('user_1', {
        businessName: 'Test Store',
        businessEmail: 'merchant@test.com',
      });

      expect(result.businessName).toBe('Test Store');
      expect(prisma.merchant.create).toHaveBeenCalled();
    });

    it('should throw if user already has merchant', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);

      await expect(
        service.register('user_1', {
          businessName: 'Test',
          businessEmail: 'm@t.com',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getById', () => {
    it('should return merchant', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      const result = await service.getById('merch_1');
      expect(result?.id).toBe('merch_1');
    });

    it('should return null if not found', async () => {
      prisma.merchant.findUnique.mockResolvedValue(null);
      const result = await service.getById('bad_id');
      expect(result).toBeNull();
    });
  });

  describe('getByUserId', () => {
    it('should return merchant by user ID', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      const result = await service.getByUserId('user_1');
      expect(result.id).toBe('merch_1');
    });

    it('should throw if not found', async () => {
      prisma.merchant.findUnique.mockResolvedValue(null);
      await expect(service.getByUserId('bad_user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('should return paginated merchants', async () => {
      prisma.merchant.findMany.mockResolvedValue([mockMerchant]);
      prisma.merchant.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, pageSize: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.merchant.findMany.mockResolvedValue([mockMerchant]);
      prisma.merchant.count.mockResolvedValue(1);

      await service.list({ status: 'ACTIVE' });
      expect(prisma.merchant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'ACTIVE' } }),
      );
    });
  });

  describe('update', () => {
    it('should update merchant', async () => {
      prisma.merchant.findUnique.mockResolvedValue({ ...mockMerchant, userId: 'user_1' });
      prisma.merchant.update.mockResolvedValue({
        ...mockMerchant,
        businessName: 'Updated Store',
      });

      const result = await service.update('merch_1', 'user_1', {
        businessName: 'Updated Store',
      });

      expect(result.businessName).toBe('Updated Store');
    });

    it('should throw if not your merchant', async () => {
      prisma.merchant.findUnique.mockResolvedValue({ ...mockMerchant, userId: 'other_user' });
      prisma.merchant.update.mockResolvedValue(mockMerchant);

      await expect(
        service.update('merch_1', 'user_1', { businessName: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('suspend', () => {
    it('should suspend merchant', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.merchant.update.mockResolvedValue({ ...mockMerchant, status: 'SUSPENDED' });

      await service.suspend('merch_1');
      expect(prisma.merchant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'SUSPENDED' } }),
      );
    });
  });
});
