import type {
  Payment, CreatePaymentRequest, PaymentStatus, PaginatedResponse, PaginationQuery,
} from '@epay/types';
import { BaseResource } from './base';

/**
 * Payments resource for creating, retrieving, and managing payments.
 *
 * @example
 * ```ts
 * const payment = await client.payments.create({
 *   merchantId: 'merch_123',
 *   amount: '1000000000',
 *   currency: 'TON',
 *   recipientAddress: 'EQD...',
 * });
 * ```
 */
export class PaymentsResource extends BaseResource {
  /**
   * Create a new payment.
   */
  async create(request: CreatePaymentRequest): Promise<Payment> {
    return this.client.post<Payment>('/payments', request);
  }

  /**
   * Get a payment by its database ID.
   */
  async getById(id: string): Promise<Payment> {
    return this.client.get<Payment>(`/payments/${id}`);
  }

  /**
   * List payments with optional filters.
   */
  async list(params?: PaginationQuery & {
    merchantId?: string;
    status?: PaymentStatus;
  }): Promise<PaginatedResponse<Payment>> {
    return this.client.get<PaginatedResponse<Payment>>(`/payments${this.buildQuery(params as Record<string, unknown>)}`);
  }

  /**
   * Confirm a payment with a blockchain transaction hash.
   */
  async confirm(id: string, txHash: string): Promise<Payment> {
    return this.client.patch<Payment>(`/payments/${id}/confirm`, { txHash });
  }

  /**
   * Mark a payment as completed.
   */
  async complete(id: string): Promise<Payment> {
    return this.client.patch<Payment>(`/payments/${id}/complete`);
  }

  /**
   * Mark a payment as failed.
   */
  async fail(id: string): Promise<Payment> {
    return this.client.patch<Payment>(`/payments/${id}/fail`);
  }

  /**
   * Cancel a pending payment.
   */
  async cancel(id: string): Promise<Payment> {
    return this.client.patch<Payment>(`/payments/${id}/cancel`);
  }
}
