import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { PrismaService } from '../database/prisma.service';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

describe('WebhookService', () => {
  let service: WebhookService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockDelivery = {
    id: 'del_1', merchantId: 'merch_1', eventType: 'payment.completed',
    url: 'https://test.com/webhook', payload: { paymentId: 'pay_1' },
    statusCode: null, response: null, attempts: 0, maxAttempts: 5,
    lastAttemptAt: null, succeededAt: null, failedAt: null, createdAt: mockDate(),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<WebhookService>(WebhookService);
  });

  describe('createDelivery', () => {
    it('should create a webhook delivery', async () => {
      prisma.webhookDelivery.create.mockResolvedValue(mockDelivery);
      const result = await service.createDelivery({
        merchantId: 'merch_1', eventType: 'payment.completed',
        url: 'https://test.com/webhook', payload: { paymentId: 'pay_1' },
      });
      expect(result.id).toBe('del_1');
      expect(result.eventType).toBe('payment.completed');
    });
  });

  describe('listDeliveries', () => {
    it('should return paginated deliveries', async () => {
      prisma.webhookDelivery.findMany.mockResolvedValue([mockDelivery]);
      prisma.webhookDelivery.count.mockResolvedValue(1);
      const result = await service.listDeliveries({});
      expect(result.data).toHaveLength(1);
    });

    it('should filter by merchantId', async () => {
      prisma.webhookDelivery.findMany.mockResolvedValue([]);
      prisma.webhookDelivery.count.mockResolvedValue(0);
      await service.listDeliveries({ merchantId: 'merch_1' });
      expect(prisma.webhookDelivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { merchantId: 'merch_1' } }),
      );
    });
  });

  describe('retryDelivery', () => {
    it('should retry a failed delivery', async () => {
      prisma.webhookDelivery.findUnique.mockResolvedValue({ ...mockDelivery, attempts: 1 });
      prisma.webhookDelivery.update.mockResolvedValue({ ...mockDelivery, attempts: 2 });
      const result = await service.retryDelivery('del_1');
      expect(result.attempts).toBe(2);
    });
  });
});
