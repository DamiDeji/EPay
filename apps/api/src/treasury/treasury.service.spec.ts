import { Test, TestingModule } from '@nestjs/testing';
import { TreasuryService } from './treasury.service';
import { PrismaService } from '../database/prisma.service';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

describe('TreasuryService', () => {
  let service: TreasuryService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TreasuryService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<TreasuryService>(TreasuryService);
  });

  describe('getBalance', () => {
    it('should calculate balances from transactions', async () => {
      prisma.treasuryTransaction.findMany.mockResolvedValue([
        { txType: 'DEPOSIT', amount: BigInt(10000), status: 'COMPLETED' },
        { txType: 'FEE_COLLECTION', amount: BigInt(50), status: 'COMPLETED' },
        { txType: 'ESCROW_HOLD', amount: BigInt(1000), status: 'COMPLETED' },
      ]);

      const result = await service.getBalance();
      expect(result.totalBalance).toBeDefined();
      expect(result.feeBalance).toBe('50');
    });
  });

  describe('recordDeposit', () => {
    it('should record a deposit transaction', async () => {
      prisma.treasuryTransaction.create.mockResolvedValue({
        id: 'tx_1', txType: 'DEPOSIT', amount: BigInt(5000), currency: 'TON',
        fromAddress: 'EQD_from', toAddress: null, txHash: '0xdep', status: 'COMPLETED',
        referenceId: null, referenceType: null, metadata: {}, createdAt: mockDate(), completedAt: mockDate(),
      });

      const result = await service.recordDeposit('5000', 'EQD_from', '0xdep');
      expect(result.txType).toBe('DEPOSIT');
      expect(result.amount).toBe('5000');
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      prisma.treasuryTransaction.findMany.mockResolvedValue([]);
      prisma.treasuryTransaction.count.mockResolvedValue(0);

      const result = await service.getTransactions({ page: 1, pageSize: 20 });
      expect(result.data).toBeDefined();
      expect(result.total).toBe(0);
    });

    it('should filter by txType', async () => {
      prisma.treasuryTransaction.findMany.mockResolvedValue([]);
      prisma.treasuryTransaction.count.mockResolvedValue(0);

      await service.getTransactions({ txType: 'DEPOSIT' });
      expect(prisma.treasuryTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { txType: 'DEPOSIT' } }),
      );
    });
  });
});
