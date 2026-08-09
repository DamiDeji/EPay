import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockSub = {
    id: 'sub_1', subscriptionId: 'sub_abc', merchantId: 'merch_1', customerId: 'cust_1',
    planName: 'Premium Plan', amount: BigInt(1000000000), currency: 'XLM',
    interval: 'MONTHLY', status: 'ACTIVE',
    trialEndDate: null, currentPeriodStart: mockDate(), currentPeriodEnd: new Date('2026-09-05'),
    nextBillingDate: new Date('2026-09-05'), maxPayments: 12, paymentsMade: 3,
    lastPaymentId: null, cancelledAt: null,
    metadata: {}, createdAt: mockDate(), updatedAt: mockDate(),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubscriptionService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<SubscriptionService>(SubscriptionService);
  });

  describe('create', () => {
    it('should create a subscription', async () => {
      prisma.subscription.create.mockResolvedValue(mockSub);
      const result = await service.create({
        merchantId: 'merch_1', customerId: 'cust_1', planName: 'Premium',
        amount: '1000000000', currency: 'XLM', interval: 'MONTHLY',
      });
      expect(result.subscriptionId).toMatch(/^sub_/);
      expect(result.planName).toBe('Premium Plan');
    });

    it('should set TRIAL status with trialDays', async () => {
      prisma.subscription.create.mockResolvedValue({ ...mockSub, status: 'TRIAL' });
      const result = await service.create({
        merchantId: 'merch_1', customerId: 'cust_1', planName: 'Trial',
        amount: '1000', currency: 'XLM', interval: 'MONTHLY', trialDays: 7,
      });
      expect(result.status).toBe('TRIAL');
    });
  });

  describe('pause', () => {
    it('should pause an active subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(mockSub);
      prisma.subscription.update.mockResolvedValue({ ...mockSub, status: 'PAUSED' });
      const result = await service.pause('sub_1');
      expect(result.status).toBe('PAUSED');
    });

    it('should throw if not active or trial', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ ...mockSub, status: 'CANCELLED' });
      await expect(service.pause('sub_1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resume', () => {
    it('should resume a paused subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ ...mockSub, status: 'PAUSED' });
      prisma.subscription.update.mockResolvedValue({ ...mockSub, status: 'ACTIVE' });
      const result = await service.resume('sub_1');
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('cancel', () => {
    it('should cancel a subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(mockSub);
      prisma.subscription.update.mockResolvedValue({ ...mockSub, status: 'CANCELLED', cancelledAt: mockDate() });
      const result = await service.cancel('sub_1');
      expect(result.status).toBe('CANCELLED');
    });
  });
});
