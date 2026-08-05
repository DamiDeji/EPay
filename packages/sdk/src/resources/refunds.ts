import type {
  Refund, CreateRefundRequest, RefundStatus, PaginatedResponse, PaginationQuery,
} from '@epay/types';
import { BaseResource } from './base';

/**
 * Refunds resource for requesting and managing payment refunds.
 *
 * @example
 * ```ts
 * const refund = await client.refunds.request({
 *   paymentId: 'pay_123',
 *   amount: '500000000',
 *   reason: 'Customer requested partial refund',
 * });
 * ```
 */
export class RefundsResource extends BaseResource {
  /**
   * Request a new refund.
   */
  async request(request: CreateRefundRequest): Promise<Refund> {
    return this.client.post<Refund>('/refunds', request);
  }

  /**
   * Get a refund by ID.
   */
  async getById(id: string): Promise<Refund> {
    return this.client.get<Refund>(`/refunds/${id}`);
  }

  /**
   * List refunds with optional filters.
   */
  async list(params?: PaginationQuery & {
    merchantId?: string;
    paymentId?: string;
    status?: RefundStatus;
  }): Promise<PaginatedResponse<Refund>> {
    return this.client.get<PaginatedResponse<Refund>>(`/refunds${this.buildQuery(params as Record<string, unknown>)}`);
  }

  /**
   * Approve a requested refund.
   */
  async approve(id: string): Promise<Refund> {
    return this.client.patch<Refund>(`/refunds/${id}/approve`);
  }

  /**
   * Process an approved refund with the on-chain transaction hash.
   */
  async process(id: string, txHash: string): Promise<Refund> {
    return this.client.patch<Refund>(`/refunds/${id}/process`, { txHash });
  }

  /**
   * Reject a refund request.
   */
  async reject(id: string): Promise<Refund> {
    return this.client.patch<Refund>(`/refunds/${id}/reject`);
  }
}
