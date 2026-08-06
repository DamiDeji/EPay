import { generateId } from '@epay/shared';
import type { Subscription, PaginatedResponse } from '@epay/types';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import type { CreateSubscriptionDto } from './dto/create-subscription.dto';

const INTERVAL_SECONDS: Record<string, number> = {
  DAILY: 86400,
  WEEKLY: 604800,
  MONTHLY: 2592000,
  QUARTERLY: 7776000,
  ANNUALLY: 31536000,
};

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubscriptionDto): Promise<Subscription> {
    const subscriptionId = generateId('sub');
    const intervalSeconds = INTERVAL_SECONDS[dto.interval] ?? 2592000;
    const now = new Date();
    const trialEnd = dto.trialDays
      ? new Date(now.getTime() + dto.trialDays * 86400_000)
      : null;

    const subscription = await this.prisma.subscription.create({
      data: {
        subscriptionId,
        merchantId: dto.merchantId,
        customerId: dto.customerId,
        planName: dto.planName,
        amount: BigInt(dto.amount),
        assetCode: dto.assetCode,
        assetIssuer: dto.assetIssuer,
        interval: dto.interval,
        status: trialEnd ? 'TRIAL' : 'ACTIVE',
        trialEndDate: trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + intervalSeconds * 1000),
        nextBillingDate: trialEnd ?? new Date(now.getTime() + intervalSeconds * 1000),
        maxPayments: dto.maxPayments ?? null,
        metadata: (dto.metadata ?? {}) as any,
      },
    });

    return this.sanitizeSubscription(subscription);
  }

  async getById(id: string): Promise<Subscription | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: { payments: true },
    });
    return subscription ? this.sanitizeSubscription(subscription) : null;
  }

  async list(params: {
    merchantId?: string;
    customerId?: string;
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<PaginatedResponse<Subscription>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.merchantId) where.merchantId = params.merchantId;
    if (params.customerId) where.customerId = params.customerId;
    if (params.status) where.status = params.status;

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      data: subscriptions.map((s) => this.sanitizeSubscription(s)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    };
  }

  async pause(id: string): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (!['ACTIVE', 'TRIAL'].includes(subscription.status)) {
      throw new BadRequestException('Cannot pause subscription in current state');
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: { status: 'PAUSED' },
    });

    return this.sanitizeSubscription(updated);
  }

  async resume(id: string): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (subscription.status !== 'PAUSED') {
      throw new BadRequestException('Subscription is not paused');
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        nextBillingDate: new Date(Date.now() + 86400_000),
      },
    });

    return this.sanitizeSubscription(updated);
  }

  async cancel(id: string): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } });
    if (!subscription) throw new NotFoundException('Subscription not found');

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    return this.sanitizeSubscription(updated);
  }

  private sanitizeSubscription(subscription: any): Subscription {
    return {
      ...subscription,
      amount: subscription.amount.toString(),
      metadata: subscription.metadata ?? {},
    };
  }
}
