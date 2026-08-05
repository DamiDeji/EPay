import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { createMockPrismaService, mockDate } from '../../test/mocks/prisma.mock';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockNotif = {
    id: 'notif_1', userId: 'user_1', type: 'payment.received', title: 'Payment Received',
    message: 'You received 100 TON', channel: 'IN_APP', isRead: false,
    link: null, metadata: {}, createdAt: mockDate(),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<NotificationService>(NotificationService);
  });

  describe('create', () => {
    it('should create a notification', async () => {
      prisma.notification.create.mockResolvedValue(mockNotif);
      const result = await service.create({
        userId: 'user_1', type: 'payment.received',
        title: 'Payment Received', message: 'You received 100 TON',
      });
      expect(result.id).toBe('notif_1');
      expect(result.isRead).toBe(false);
    });
  });

  describe('list', () => {
    it('should return user notifications', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotif]);
      prisma.notification.count.mockResolvedValue(1);
      const result = await service.list({ userId: 'user_1' });
      expect(result.data).toHaveLength(1);
    });

    it('should filter by read status', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);
      await service.list({ userId: 'user_1', isRead: true });
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user_1', isRead: true } }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      prisma.notification.findUnique.mockResolvedValue(mockNotif);
      prisma.notification.update.mockResolvedValue({ ...mockNotif, isRead: true });
      const result = await service.markAsRead('notif_1');
      expect(result.isRead).toBe(true);
    });

    it('should throw if not found', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.markAsRead('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });
      await service.markAllAsRead('user_1');
      expect(prisma.notification.updateMany).toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      prisma.notification.count.mockResolvedValue(5);
      const result = await service.getUnreadCount('user_1');
      expect(result).toBe(5);
    });
  });
});
