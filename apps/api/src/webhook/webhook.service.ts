import type { WebhookDelivery, PaginatedResponse } from '@epay/types';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createDelivery(params: {
    merchantId: string;
    eventType: string;
    url: string;
    payload: Record<string, unknown>;
  }): Promise<WebhookDelivery> {
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        merchantId: params.merchantId,
        eventType: params.eventType,
        url: params.url,
        payload: params.payload as any,
      },
    });

    this.logger.log(`Webhook delivery created: ${delivery.id} for event ${params.eventType}`);
    return this.sanitizeDelivery(delivery);
  }

  async listDeliveries(params: {
    merchantId?: string;
    eventType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<WebhookDelivery>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.merchantId) where.merchantId = params.merchantId;
    if (params.eventType) where.eventType = params.eventType;

    const [deliveries, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.webhookDelivery.count({ where }),
    ]);

    return {
      data: deliveries.map((d) => this.sanitizeDelivery(d)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    };
  }

  async getDelivery(id: string): Promise<WebhookDelivery | null> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id },
    });
    return delivery ? this.sanitizeDelivery(delivery) : null;
  }

  async retryDelivery(id: string): Promise<WebhookDelivery> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id },
    });

    if (!delivery) throw new NotFoundException('Webhook delivery not found');
    if (delivery.attempts >= delivery.maxAttempts) {
      throw new NotFoundException('Max retry attempts reached');
    }

    const updated = await this.prisma.webhookDelivery.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });

    return this.sanitizeDelivery(updated);
  }

  private sanitizeDelivery(delivery: any): WebhookDelivery {
    return {
      ...delivery,
      payload: delivery.payload ?? {},
    };
  }
}
