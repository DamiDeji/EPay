import type { PaymentLink, CreatePaymentLinkRequest } from '@epay/types';

import { BaseResource } from './base';

/**
 * Payment Links resource for creating and managing shareable payment links.
 */
export class PaymentLinksResource extends BaseResource {
  /**
   * Create a new payment link.
   */
  async create(request: CreatePaymentLinkRequest & { merchantId: string }): Promise<PaymentLink> {
    return this.client.post<PaymentLink>('/payment-links', request);
  }

  /**
   * Get a payment link by its short code.
   */
  async getByCode(code: string): Promise<PaymentLink> {
    return this.client.get<PaymentLink>(`/payment-links/by-code/${code}`);
  }

  /**
   * List payment links for a merchant.
   */
  async listByMerchant(merchantId: string): Promise<PaymentLink[]> {
    return this.client.get<PaymentLink[]>(`/payment-links/merchant/${merchantId}`);
  }
}
