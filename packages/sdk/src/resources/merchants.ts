import type {
  Merchant, MerchantOnboardingRequest, MerchantStatus, PaginatedResponse, PaginationQuery,
} from '@epay/types';

import { BaseResource } from './base';

/**
 * Merchants resource for managing merchant accounts.
 */
export class MerchantsResource extends BaseResource {
  /**
   * Register a new merchant account.
   */
  async register(request: MerchantOnboardingRequest): Promise<Merchant> {
    return this.client.post<Merchant>('/merchants', request);
  }

  /**
   * Get the authenticated user's own merchant account.
   */
  async getMyMerchant(): Promise<Merchant> {
    return this.client.get<Merchant>('/merchants/me');
  }

  /**
   * Get a merchant by ID.
   */
  async getById(id: string): Promise<Merchant> {
    return this.client.get<Merchant>(`/merchants/${id}`);
  }

  /**
   * List merchants (admin only).
   */
  async list(params?: PaginationQuery & {
    status?: MerchantStatus;
  }): Promise<PaginatedResponse<Merchant>> {
    return this.client.get<PaginatedResponse<Merchant>>(`/merchants${this.buildQuery(params as Record<string, unknown>)}`);
  }

  /**
   * Update merchant profile.
   */
  async update(id: string, data: Partial<MerchantOnboardingRequest>): Promise<Merchant> {
    return this.client.put<Merchant>(`/merchants/${id}`, data);
  }

  /**
   * Verify a merchant (admin/verifier only).
   */
  async verify(id: string, approve: boolean, level?: string): Promise<Merchant> {
    return this.client.patch<Merchant>(`/merchants/${id}/verify`, { approve, level });
  }
}
