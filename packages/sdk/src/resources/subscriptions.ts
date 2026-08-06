import type {
  Subscription, CreateSubscriptionRequest, SubscriptionStatus,
  PaginatedResponse, PaginationQuery,
} from '@epay/types';

import { BaseResource } from './base';

/**
 * Subscriptions resource for managing recurring billing plans.
 *
 * @example
 * ```ts
 * const sub = await client.subscriptions.create({
 *   merchantId: 'merch_123',
 *   customerId: 'cust_456',
 *   planName: 'Premium Plan',
 *   amount: '1000000000',
 *   currency: 'TON',
 *   interval: 'MONTHLY',
 *   trialDays: 7,
 * });
 * ```
 */
export class SubscriptionsResource extends BaseResource {
  /**
   * Create a new subscription.
   */
  async create(request: CreateSubscriptionRequest): Promise<Subscription> {
    return this.client.post<Subscription>('/subscriptions', request);
  }

  /**
   * Get a subscription by ID.
   */
  async getById(id: string): Promise<Subscription> {
    return this.client.get<Subscription>(`/subscriptions/${id}`);
  }

  /**
   * List subscriptions with optional filters.
   */
  async list(params?: PaginationQuery & {
    merchantId?: string;
    customerId?: string;
    status?: SubscriptionStatus;
  }): Promise<PaginatedResponse<Subscription>> {
    return this.client.get<PaginatedResponse<Subscription>>(
      `/subscriptions${this.buildQuery(params as Record<string, unknown>)}`,
    );
  }

  /**
   * Pause an active subscription.
   */
  async pause(id: string): Promise<Subscription> {
    return this.client.patch<Subscription>(`/subscriptions/${id}/pause`);
  }

  /**
   * Resume a paused subscription.
   */
  async resume(id: string): Promise<Subscription> {
    return this.client.patch<Subscription>(`/subscriptions/${id}/resume`);
  }

  /**
   * Cancel a subscription.
   */
  async cancel(id: string): Promise<Subscription> {
    return this.client.patch<Subscription>(`/subscriptions/${id}/cancel`);
  }
}
