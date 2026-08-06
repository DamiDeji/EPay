import type {
  Settlement, SettlementStatus, PaginatedResponse, PaginationQuery,
} from '@epay/types';

import { BaseResource } from './base';

/**
 * Settlements resource for managing periodic settlement of funds.
 */
export class SettlementsResource extends BaseResource {
  /**
   * Create a new settlement for a merchant.
   */
  async create(merchantId: string): Promise<Settlement> {
    return this.client.post<Settlement>('/settlements', { merchantId });
  }

  /**
   * Get a settlement by ID.
   */
  async getById(id: string): Promise<Settlement> {
    return this.client.get<Settlement>(`/settlements/${id}`);
  }

  /**
   * List settlements with optional filters.
   */
  async list(params?: PaginationQuery & {
    merchantId?: string;
    status?: SettlementStatus;
  }): Promise<PaginatedResponse<Settlement>> {
    return this.client.get<PaginatedResponse<Settlement>>(
      `/settlements${this.buildQuery(params as Record<string, unknown>)}`,
    );
  }

  /**
   * Process a pending settlement with transaction hash.
   */
  async process(id: string, txHash: string, settlementPublicKey: string): Promise<Settlement> {
    return this.client.patch<Settlement>(`/settlements/${id}/process`, {
      txHash,
      settlementPublicKey,
    });
  }
}
