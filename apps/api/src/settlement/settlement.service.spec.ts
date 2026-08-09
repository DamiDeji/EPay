import { Test, TestingModule } from '@nestjs/testing';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

describe('SettlementService', () => {
  let service: SettlementService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockSettlement = {
    id: 'set_1', settlementId: 'set_abc', merchantId: 'merch_1',
    amount: BigInt(5000000000), currency: 'XLM', feeAmount: BigInt(25000000),
    netAmount: BigInt(4975000000), status: 'PENDING',
    paymentIds: ['pay_1', 'pay_2'], txHash: null,
    settlementAddress: 'pending', periodStart: mockDate('2026-08-01'), periodEnd: mockDate(),
    processedAt: null, metadata: {}, createdAt: mockDate(), updatedAt: mockDate(),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SettlementService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<SettlementService>(SettlementService);
  });

  describe('create', () => {
    it('should create settlement from completed payments', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { id: 'pay_1', amount: BigInt(3000000000), status: 'COMPLETED', createdAt: mockDate() },
        { id: 'pay_2', amount: BigInt(2000000000), status: 'COMPLETED', createdAt: mockDate() },
      ]);
      prisma.settlement.create.mockResolvedValue(mockSettlement);

      const result = await service.create('merch_1');
      expect(result.settlementId).toMatch(/^set_/);
      expect(result.paymentIds).toHaveLength(2);
    });

    it('should throw if no completed payments', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      await expect(service.create('merch_1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('process', () => {
    it('should process a pending settlement', async () => {
      prisma.settlement.findUnique.mockResolvedValue(mockSettlement);
      prisma.settlement.update.mockResolvedValue({
        ...mockSettlement, status: 'COMPLETED', txHash: '0xabc', processedAt: mockDate(),
      });

      const result = await service.process('set_1', '0xabc', 'GAD_wallet');
      expect(result.status).toBe('COMPLETED');
      expect(result.txHash).toBe('0xabc');
    });

    it('should throw if not pending', async () => {
      prisma.settlement.findUnique.mockResolvedValue({ ...mockSettlement, status: 'COMPLETED' });
      await expect(service.process('set_1', '0xabc', 'GAD_wallet')).rejects.toThrow(BadRequestException);
    });
  });
});
