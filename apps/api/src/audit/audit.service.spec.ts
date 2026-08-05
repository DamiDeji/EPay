import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../database/prisma.service';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockLog = {
    id: 'log_1', userId: 'user_1', action: 'CREATE', resource: 'PAYMENT',
    resourceId: 'pay_1', changes: { amount: '1000' },
    ipAddress: '127.0.0.1', userAgent: 'TestAgent', createdAt: mockDate(),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<AuditService>(AuditService);
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      prisma.auditLog.create.mockResolvedValue(mockLog);
      const result = await service.log({
        userId: 'user_1', action: 'CREATE', resource: 'PAYMENT',
        resourceId: 'pay_1', changes: { amount: '1000' },
      });
      expect(result.id).toBe('log_1');
      expect(result.action).toBe('CREATE');
    });

    it('should handle anonymous user', async () => {
      prisma.auditLog.create.mockResolvedValue({ ...mockLog, userId: null });
      const result = await service.log({
        action: 'READ', resource: 'INVOICE',
      });
      expect(result.userId).toBeNull();
    });
  });

  describe('list', () => {
    it('should return paginated logs', async () => {
      prisma.auditLog.findMany.mockResolvedValue([mockLog]);
      prisma.auditLog.count.mockResolvedValue(1);
      const result = await service.list({});
      expect(result.data).toHaveLength(1);
    });

    it('should filter by action', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await service.list({ action: 'CREATE' });
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { action: 'CREATE' } }),
      );
    });
  });

  describe('getById', () => {
    it('should return log by id', async () => {
      prisma.auditLog.findUnique.mockResolvedValue(mockLog);
      const result = await service.getById('log_1');
      expect(result?.id).toBe('log_1');
    });

    it('should return null if not found', async () => {
      prisma.auditLog.findUnique.mockResolvedValue(null);
      expect(await service.getById('bad')).toBeNull();
    });
  });
});
