import { Test, TestingModule } from '@nestjs/testing';
import { RefundService } from './refund.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

describe('RefundService', () => {
  let service: RefundService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockPayment = { id: 'pay_1', merchantId: 'merch_1', amount: BigInt(1000000000), currency: 'TON', status: 'COMPLETED' };
  const mockRefund = {
    id: 'ref_1', refundId: 'ref_abc', paymentId: 'pay_1', merchantId: 'merch_1',
    amount: BigInt(1000000000), originalAmount: BigInt(1000000000), currency: 'TON',
    status: 'REQUESTED', reason: 'Customer request', isPartial: false,
    txHash: null, processedAt: null, metadata: {}, createdAt: mockDate(), updatedAt: mockDate(),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [RefundService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<RefundService>(RefundService);
  });

  describe('request', () => {
    it('should request a full refund', async () => {
      prisma.payment.findUnique.mockResolvedValue(mockPayment);
      prisma.refund.findFirst.mockResolvedValue(null);
      prisma.refund.create.mockResolvedValue(mockRefund);

      const result = await service.request({
        paymentId: 'pay_1', amount: '1000000000', reason: 'Customer request',
      });
      expect(result.refundId).toMatch(/^ref_/);
      expect(result.isPartial).toBe(false);
    });

    it('should mark as partial if amount < original', async () => {
      prisma.payment.findUnique.mockResolvedValue(mockPayment);
      prisma.refund.findFirst.mockResolvedValue(null);
      prisma.refund.create.mockResolvedValue({ ...mockRefund, amount: BigInt(500000000), isPartial: true });

      const result = await service.request({
        paymentId: 'pay_1', amount: '500000000', reason: 'Partial refund',
      });
      expect(result.isPartial).toBe(true);
    });

    it('should throw if payment not completed', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...mockPayment, status: 'PENDING' });
      await expect(service.request({
        paymentId: 'pay_1', amount: '1000000000', reason: 'test',
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw if refund already exists', async () => {
      prisma.payment.findUnique.mockResolvedValue(mockPayment);
      prisma.refund.findFirst.mockResolvedValue(mockRefund);
      await expect(service.request({
        paymentId: 'pay_1', amount: '500', reason: 'test',
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should approve a requested refund', async () => {
      prisma.refund.findUnique.mockResolvedValue(mockRefund);
      prisma.refund.update.mockResolvedValue({ ...mockRefund, status: 'APPROVED' });
      const result = await service.approve('ref_1');
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('process', () => {
    it('should process an approved refund', async () => {
      prisma.refund.findUnique.mockResolvedValue({ ...mockRefund, status: 'APPROVED' });
      prisma.refund.update.mockResolvedValue({ ...mockRefund, status: 'COMPLETED', txHash: '0xabc' });
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'REFUNDED' });

      const result = await service.process('ref_1', '0xabc');
      expect(result.status).toBe('COMPLETED');
      expect(prisma.payment.update).toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('should reject a requested refund', async () => {
      prisma.refund.findUnique.mockResolvedValue(mockRefund);
      prisma.refund.update.mockResolvedValue({ ...mockRefund, status: 'REJECTED' });
      const result = await service.reject('ref_1');
      expect(result.status).toBe('REJECTED');
    });
  });
});
