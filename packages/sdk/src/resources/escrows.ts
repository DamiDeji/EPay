import type {
  Escrow, CreateEscrowRequest, EscrowStatus, PaginatedResponse, PaginationQuery,
} from '@epay/types';
import { BaseResource } from './base';

/**
 * Escrows resource for milestone-based secure transactions.
 *
 * @example
 * ```ts
 * const escrow = await client.escrows.create({
 *   merchantId: 'merch_123',
 *   customerId: 'cust_456',
 *   currency: 'TON',
 *   milestones: [
 *     { description: 'Design phase', amount: '2500000000' },
 *     { description: 'Development', amount: '2500000000' },
 *   ],
 * });
 * ```
 */
export class EscrowsResource extends BaseResource {
  /**
   * Create a new escrow with milestones.
   */
  async create(request: CreateEscrowRequest): Promise<Escrow> {
    return this.client.post<Escrow>('/escrows', request);
  }

  /**
   * Get an escrow by ID.
   */
  async getById(id: string): Promise<Escrow> {
    return this.client.get<Escrow>(`/escrows/${id}`);
  }

  /**
   * List escrows with optional filters.
   */
  async list(params?: PaginationQuery & {
    merchantId?: string;
    customerId?: string;
    status?: EscrowStatus;
  }): Promise<PaginatedResponse<Escrow>> {
    return this.client.get<PaginatedResponse<Escrow>>(`/escrows${this.buildQuery(params as Record<string, unknown>)}`);
  }

  /**
   * Mark an escrow as funded with a transaction hash.
   */
  async fund(id: string, txHash: string): Promise<Escrow> {
    return this.client.patch<Escrow>(`/escrows/${id}/fund`, { txHash });
  }

  /**
   * Complete a milestone in an escrow.
   */
  async completeMilestone(
    id: string,
    milestoneIndex: number,
    releaseTxHash?: string,
  ): Promise<Escrow> {
    return this.client.patch<Escrow>(
      `/escrows/${id}/milestones/${milestoneIndex}/complete`,
      { releaseTxHash },
    );
  }

  /**
   * File a dispute on an escrow.
   */
  async dispute(id: string): Promise<Escrow> {
    return this.client.patch<Escrow>(`/escrows/${id}/dispute`);
  }

  /**
   * Resolve a dispute on an escrow (admin only).
   */
  async resolve(id: string): Promise<Escrow> {
    return this.client.patch<Escrow>(`/escrows/${id}/resolve`);
  }

  /**
   * Cancel an escrow.
   */
  async cancel(id: string): Promise<Escrow> {
    return this.client.patch<Escrow>(`/escrows/${id}/cancel`);
  }
}
