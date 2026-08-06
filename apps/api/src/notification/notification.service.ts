import type { Notification, PaginatedResponse } from '@epay/types';
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    userId: string;
    type: string;
    title: string;
    message: string;
    channel?: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        channel: (params.channel as any) ?? 'IN_APP',
        link: params.link ?? null,
        metadata: (params.metadata ?? {}) as any,
      },
    });

    return this.sanitizeNotification(notification);
  }

  async list(params: {
    userId: string;
    page?: number;
    pageSize?: number;
    isRead?: boolean;
  }): Promise<PaginatedResponse<Notification>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = { userId: params.userId };
    if (params.isRead !== undefined) where.isRead = params.isRead;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications.map((n) => this.sanitizeNotification(n)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    };
  }

  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) throw new NotFoundException('Notification not found');

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return this.sanitizeNotification(updated);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  private sanitizeNotification(notification: any): Notification {
    return {
      ...notification,
      metadata: notification.metadata ?? {},
    };
  }
}
