import type { PaymentAnalytics } from '@epay/types';

import { BaseResource } from './base';

/**
 * Analytics resource for merchant and platform analytics.
 */
export class AnalyticsResource extends BaseResource {
  /**
   * Get analytics for a specific merchant.
   */
  async getMerchantAnalytics(
    merchantId: string,
    days?: number,
  ): Promise<PaymentAnalytics> {
    const qs = days !== undefined ? `?days=${String(days)}` : '';
    return this.client.get<PaymentAnalytics>(`/analytics/merchant/${merchantId}${qs}`);
  }

  /**
   * Get merchant revenue breakdown.
   */
  async getMerchantRevenue(merchantId: string, days?: number): Promise<{
    totalRevenue: string;
    totalFees: string;
    netRevenue: string;
    daily: { date: string; amount: string; count: number }[];
  }> {
    const qs = days !== undefined ? `?days=${String(days)}` : '';
    return this.client.get(`/analytics/merchant/${merchantId}/revenue${qs}`);
  }

  /**
   * Get platform-wide analytics (admin only).
   */
  async getPlatformAnalytics(days?: number): Promise<{
    totalMerchants: number;
    totalPayments: number;
    totalVolume: string;
    activeMerchants: number;
  }> {
    const qs = days !== undefined ? `?days=${String(days)}` : '';
    return this.client.get(`/analytics/platform${qs}`);
  }
}
