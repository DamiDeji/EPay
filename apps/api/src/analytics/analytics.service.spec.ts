import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../database/prisma.service';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockPayment = (status: string, amount: string, daysAgo = 0) => ({
    id: `pay_${Math.random().toString(36).slice(2)}`,
    amount: BigInt(amount),
    currency: 'XLM',
    status,
    createdAt: new Date(Date.now() - daysAgo * 86400000),
  });

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('getMerchantAnalytics', () => {
    it('should calculate analytics from payments', async () => {
      prisma.payment.findMany.mockResolvedValue([
        mockPayment('COMPLETED', '1000000000', 1),
        mockPayment('COMPLETED', '500000000', 2),
        mockPayment('FAILED', '1000000000', 3),
      ]);

      const result = await service.getMerchantAnalytics('merch_1', 30);
      expect(result.totalPayments).toBe(3);
      expect(result.totalVolume).toBe('2500000000');
      expect(result.successRate).toBeGreaterThan(0);
    });

    it('should handle no payments', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      const result = await service.getMerchantAnalytics('merch_1', 30);
      expect(result.totalPayments).toBe(0);
      expect(result.totalVolume).toBe('0');
    });
  });

  describe('getPlatformAnalytics', () => {
    it('should return platform stats', async () => {
      prisma.merchant.count.mockResolvedValue(10);
      prisma.payment.findMany.mockResolvedValue([
        mockPayment('COMPLETED', '1000000000'),
      ]);
      prisma.merchant.count.mockResolvedValue(5);

      const result = await service.getPlatformAnalytics(30);
      expect(result.totalPayments).toBe(1);
      expect(result.totalVolume).toBe('1000000000');
    });
  });

  describe('getMerchantRevenue', () => {
    it('should calculate revenue and fees', async () => {
      prisma.payment.findMany.mockResolvedValue([
        mockPayment('COMPLETED', '1000000000'),
      ]);

      const result = await service.getMerchantRevenue('merch_1', 30);
      expect(result.totalRevenue).toBe('1000000000');
      expect(result.totalFees).toBe('5000000'); // 0.5% fee
      expect(result.netRevenue).toBe('995000000');
    });
  });
});
