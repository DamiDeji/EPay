import type {
  Invoice, CreateInvoiceRequest, InvoiceStatus, PaginatedResponse, PaginationQuery,
} from '@epay/types';

import { BaseResource } from './base';

/**
 * Invoices resource for the complete invoice lifecycle.
 *
 * @example
 * ```ts
 * const invoice = await client.invoices.create({
 *   merchantId: 'merch_123',
 *   currency: 'XLM',
 *   items: [{ description: 'Service', quantity: 1, unitPrice: '5000000000' }],
 * });
 * await client.invoices.issue(invoice.id);
 * ```
 */
export class InvoicesResource extends BaseResource {
  /**
   * Create a new draft invoice.
   */
  async create(request: CreateInvoiceRequest): Promise<Invoice> {
    return this.client.post<Invoice>('/invoices', request);
  }

  /**
   * Get an invoice by ID.
   */
  async getById(id: string): Promise<Invoice> {
    return this.client.get<Invoice>(`/invoices/${id}`);
  }

  /**
   * List invoices with optional filters.
   */
  async list(params?: PaginationQuery & {
    merchantId?: string;
    status?: InvoiceStatus;
  }): Promise<PaginatedResponse<Invoice>> {
    return this.client.get<PaginatedResponse<Invoice>>(`/invoices${this.buildQuery(params as Record<string, unknown>)}`);
  }

  /**
   * Issue a draft invoice (make it available for payment).
   */
  async issue(id: string): Promise<Invoice> {
    return this.client.patch<Invoice>(`/invoices/${id}/issue`);
  }

  /**
   * Mark an invoice as paid with a payment reference.
   */
  async markPaid(id: string, paymentId: string): Promise<Invoice> {
    return this.client.patch<Invoice>(`/invoices/${id}/mark-paid`, { paymentId });
  }

  /**
   * Cancel an invoice.
   */
  async cancel(id: string): Promise<Invoice> {
    return this.client.patch<Invoice>(`/invoices/${id}/cancel`);
  }
}
