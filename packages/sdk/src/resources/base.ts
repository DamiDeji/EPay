import type { EPayClient } from '../client';
import type { PaginatedResponse, PaginationQuery } from '@epay/types';

export class BaseResource {
  constructor(protected readonly client: EPayClient) {}

  protected buildQuery(params?: Record<string, unknown>): string {
    if (!params) return '';
    const parts = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  }
}
