import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockPayment = {
    id: 'pay_1',
    paymentId: 'pay_abc123',
    merchantId: 'merch_1',
    customerId: 'cust_1',
    amount: BigInt(1000000000),
    currency: 'XLM',
    status: 'PENDING',
    description: 'Test payment',
    payerAddress: 'GAD_payer',
    recipientAddress: 'GAD_recipient',
    memo: 'Order #123',
    txHash: null,
    blockHeight: null,
    confirmedAt: null,
    completedAt: null,
    expiresAt: new Date(Date.now() + 3600000),
    isExpired: false,
    metadata: {},
    createdAt: mockDate(),
    updatedAt: mockDate(),
    merchant: { id: 'merch_1', businessName: 'Test Store' },
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<PaymentService>(PaymentService);
  });

  describe('create', () => {
    it('should create a payment', async () => {
      prisma.payment.create.mockResolvedValue(mockPayment);
      const result = await service.create({
        merchantId: 'merch_1',
        amount: '1000000000',
        currency: 'XLM',
        recipientAddress: 'GAD_recipient',
      });
      expect(result.paymentId).toMatch(/^pay_/);
      expect(prisma.payment.create).toHaveBeenCalled();
    });

    it('should reject amount below minimum', async () => {
      await expect(
        service.create({
          merchantId: 'merch_1',
          amount: '1000',
          currency: 'XLM',
          recipientAddress: 'GAD_recipient',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject amount above maximum', async () => {
      await expect(
        service.create({
          merchantId: 'merch_1',
          amount: '100000000000001',
          currency: 'XLM',
          recipientAddress: 'GAD_recipient',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept amount at minimum boundary', async () => {
      prisma.payment.create.mockResolvedValue(mockPayment);
      const result = await service.create({
        merchantId: 'merch_1',
        amount: '1000000',
        currency: 'XLM',
        recipientAddress: 'GAD_recipient',
      });
      expect(result.paymentId).toMatch(/^pay_/);
    });

    it('should accept amount at maximum boundary', async () => {
      prisma.payment.create.mockResolvedValue(mockPayment);
      const result = await service.create({
        merchantId: 'merch_1',
        amount: '100000000000000',
        currency: 'XLM',
        recipientAddress: 'GAD_recipient',
      });
      expect(result.paymentId).toMatch(/^pay_/);
    });
  });

  describe('getById', () => {
    it('should return payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(mockPayment);
      const result = await service.getById('pay_1');
      expect(result?.id).toBe('pay_1');
    });

    it('should return null if not found', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      expect(await service.getById('bad')).toBeNull();
    });
  });

  describe('list', () => {
    it('should return paginated payments', async () => {
      prisma.payment.findMany.mockResolvedValue([mockPayment]);
      prisma.payment.count.mockResolvedValue(1);
      const result = await service.list({ page: 1, pageSize: 20 });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('confirm', () => {
    it('should confirm a pending payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(mockPayment);
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'CONFIRMED', txHash: '0xabc' });
      const result = await service.confirm('pay_1', '0xabc');
      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw if not pending', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...mockPayment, status: 'CONFIRMED' });
      await expect(service.confirm('pay_1', '0xabc')).rejects.toThrow(BadRequestException);
    });

    it('should throw if expired', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        expiresAt: new Date('2020-01-01'),
      });
      await expect(service.confirm('pay_1', '0xabc')).rejects.toThrow(BadRequestException);
    });
  });

  describe('complete', () => {
    it('should complete a confirmed payment', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...mockPayment, status: 'CONFIRMED' });
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'COMPLETED' });
      const result = await service.complete('pay_1');
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('cancel', () => {
    it('should cancel a pending payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(mockPayment);
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'CANCELLED' });
      const result = await service.cancel('pay_1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should not cancel completed payment', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...mockPayment, status: 'COMPLETED' });
      await expect(service.cancel('pay_1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('payment links', () => {
    it('should create a payment link', async () => {
      prisma.paymentLink.create.mockResolvedValue({
        id: 'link_1', code: 'test_code', url: 'https://epay.dev/pay/test_code',
        amount: BigInt(1000), currency: 'XLM', description: null,
        maxPayments: null, currentPayments: 0, expiresAt: null,
        isActive: true, merchantId: 'merch_1', metadata: {},
        createdAt: mockDate(), updatedAt: mockDate(),
      });

      const result = await service.createPaymentLink({
        merchantId: 'merch_1', amount: '1000000000', currency: 'XLM',
      });

      expect(result.code).toBeDefined();
      expect(result.url).toContain('test_code');
    });
  });
});
