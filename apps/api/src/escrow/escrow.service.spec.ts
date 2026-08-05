import { Test, TestingModule } from '@nestjs/testing';
import { EscrowService } from './escrow.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

describe('EscrowService', () => {
  let service: EscrowService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockEscrow = {
    id: 'esc_1', escrowId: 'esc_abc', merchantId: 'merch_1', customerId: 'cust_1',
    amount: BigInt(5000000000), currency: 'TON', status: 'CREATED',
    contractAddress: 'pending', txHash: null, currentMilestone: 0,
    disputedAt: null, resolvedAt: null, metadata: {}, createdAt: mockDate(), updatedAt: mockDate(),
    milestones: [
      { id: 'mil_1', escrowId: 'esc_1', index: 0, description: 'Design', amount: BigInt(2500000000), status: 'PENDING', completedAt: null, releasedAt: null, releaseTxHash: null },
      { id: 'mil_2', escrowId: 'esc_1', index: 1, description: 'Development', amount: BigInt(2500000000), status: 'PENDING', completedAt: null, releasedAt: null, releaseTxHash: null },
    ],
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [EscrowService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<EscrowService>(EscrowService);
  });

  describe('create', () => {
    it('should create escrow with milestones', async () => {
      prisma.escrow.create.mockResolvedValue(mockEscrow);
      const result = await service.create({
        merchantId: 'merch_1', customerId: 'cust_1', currency: 'TON',
        milestones: [
          { description: 'Design', amount: '2500000000' },
          { description: 'Development', amount: '2500000000' },
        ],
      });
      expect(result.escrowId).toMatch(/^esc_/);
      expect(result.milestones).toHaveLength(2);
    });
  });

  describe('fund', () => {
    it('should fund a created escrow', async () => {
      prisma.escrow.findUnique.mockResolvedValue(mockEscrow);
      prisma.escrow.update.mockResolvedValue({ ...mockEscrow, status: 'FUNDED', txHash: '0xabc' });
      const result = await service.fund('esc_1', '0xabc');
      expect(result.status).toBe('FUNDED');
    });

    it('should throw if not in CREATED state', async () => {
      prisma.escrow.findUnique.mockResolvedValue({ ...mockEscrow, status: 'FUNDED' });
      await expect(service.fund('esc_1', '0xabc')).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeMilestone', () => {
    it('should complete a milestone', async () => {
      const funded = { ...mockEscrow, status: 'FUNDED' };
      prisma.escrow.findUnique.mockResolvedValueOnce(funded);
      prisma.milestone.update.mockResolvedValue({});
      prisma.escrow.update.mockResolvedValue({ ...funded, status: 'IN_PROGRESS', currentMilestone: 1 });

      const result = await service.completeMilestone('esc_1', 0);
      expect(result.status).toBe('IN_PROGRESS');
    });
  });

  describe('dispute', () => {
    it('should dispute an escrow', async () => {
      prisma.escrow.findUnique.mockResolvedValue({ ...mockEscrow, status: 'FUNDED' });
      prisma.escrow.update.mockResolvedValue({ ...mockEscrow, status: 'DISPUTED' });
      const result = await service.dispute('esc_1');
      expect(result.status).toBe('DISPUTED');
    });
  });

  describe('resolve', () => {
    it('should resolve a disputed escrow', async () => {
      prisma.escrow.findUnique.mockResolvedValue({ ...mockEscrow, status: 'DISPUTED' });
      prisma.escrow.update.mockResolvedValue({ ...mockEscrow, status: 'RESOLVED' });
      const result = await service.resolve('esc_1');
      expect(result.status).toBe('RESOLVED');
    });

    it('should throw if not disputed', async () => {
      prisma.escrow.findUnique.mockResolvedValue({ ...mockEscrow, status: 'FUNDED' });
      await expect(service.resolve('esc_1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel a created escrow', async () => {
      prisma.escrow.findUnique.mockResolvedValue(mockEscrow);
      prisma.escrow.update.mockResolvedValue({ ...mockEscrow, status: 'CANCELLED' });
      const result = await service.cancel('esc_1');
      expect(result.status).toBe('CANCELLED');
    });
  });
});
