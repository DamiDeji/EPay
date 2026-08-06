import type { PaymentAnalytics, DailyVolume } from '@epay/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMerchantAnalytics(merchantId: string, days: number): Promise<PaymentAnalytics> {
    const since = new Date(Date.now() - days * 86400_000);

    const payments = await this.prisma.payment.findMany({
      where: {
        merchantId,
        createdAt: { gte: since },
      },
    });

    const totalPayments = payments.length;
    const totalVolume = payments.reduce(
      (sum, p) => sum + BigInt(p.amount.toString()),
      BigInt(0),
    );
    const successfulPayments = payments.filter(
      (p) => p.status === 'COMPLETED',
    ).length;
    const refundedPayments = payments.filter(
      (p) => p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED',
    ).length;

    const dailyVolume = this.aggregateDailyVolume(payments, days);
    const assetBreakdown = this.aggregateCurrencyBreakdown(payments);

    return {
      totalPayments,
      totalVolume: totalVolume.toString(),
      averagePaymentSize:
        totalPayments > 0
          ? (totalVolume / BigInt(totalPayments)).toString()
          : '0',
      successRate:
        totalPayments > 0
          ? Number(((successfulPayments / totalPayments) * 100).toFixed(2))
          : 0,
      refundRate:
        totalPayments > 0
          ? Number(((refundedPayments / totalPayments) * 100).toFixed(2))
          : 0,
      assetBreakdown,
      dailyVolume,
    };
  }

  async getMerchantRevenue(merchantId: string, days: number): Promise<{
    totalRevenue: string;
    totalFees: string;
    netRevenue: string;
    daily: DailyVolume[];
  }> {
    const since = new Date(Date.now() - days * 86400_000);

    const payments = await this.prisma.payment.findMany({
      where: {
        merchantId,
        status: 'COMPLETED',
        createdAt: { gte: since },
      },
    });

    const totalRevenue = payments.reduce(
      (sum, p) => sum + BigInt(p.amount.toString()),
      BigInt(0),
    );
    const feeBps = BigInt(50);
    const totalFees =
      (totalRevenue * feeBps) / BigInt(10000);

    return {
      totalRevenue: totalRevenue.toString(),
      totalFees: totalFees.toString(),
      netRevenue: (totalRevenue - totalFees).toString(),
      daily: this.aggregateDailyVolume(payments, days),
    };
  }

  async getPlatformAnalytics(days: number): Promise<{
    totalMerchants: number;
    totalPayments: number;
    totalVolume: string;
    activeMerchants: number;
  }> {
    const since = new Date(Date.now() - days * 86400_000);

    const [totalMerchants, payments, activeMerchants] = await Promise.all([
      this.prisma.merchant.count(),
      this.prisma.payment.findMany({
        where: { createdAt: { gte: since } },
      }),
      this.prisma.merchant.count({
        where: {
          payments: { some: { createdAt: { gte: since } } },
        },
      }),
    ]);

    const totalVolume = payments.reduce(
      (sum, p) => sum + BigInt(p.amount.toString()),
      BigInt(0),
    );

    return {
      totalMerchants,
      totalPayments: payments.length,
      totalVolume: totalVolume.toString(),
      activeMerchants,
    };
  }

  private aggregateDailyVolume(payments: any[], days: number): DailyVolume[] {
    const dailyMap = new Map<string, { amount: bigint; count: number }>();

    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 86400_000);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap.set(dateStr, { amount: BigInt(0), count: 0 });
    }

    for (const payment of payments) {
      const dateStr = payment.createdAt.toISOString().split('T')[0] ?? '';
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.amount += BigInt(payment.amount.toString());
        existing.count += 1;
      }
    }

    return Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        amount: data.amount.toString(),
        count: data.count,
      }));
  }

  private aggregateCurrencyBreakdown(
    payments: any[],
  ): Record<string, number> {
    const breakdown: Record<string, number> = {};

    for (const payment of payments) {
      breakdown[payment.currency] = (breakdown[String(payment.currency)] ?? 0) + 1;
    }

    return breakdown;
  }
}
