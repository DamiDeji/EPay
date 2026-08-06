import { AnalyticsResource } from './resources/analytics';
import { EscrowsResource } from './resources/escrows';
import { InvoicesResource } from './resources/invoices';
import { MerchantsResource } from './resources/merchants';
import { PaymentLinksResource } from './resources/payment-links';
import { PaymentsResource } from './resources/payments';
import { RefundsResource } from './resources/refunds';
import { SettlementsResource } from './resources/settlements';
import { SubscriptionsResource } from './resources/subscriptions';
import { EPayError } from './utils';

export interface EPayClientConfig {
  apiUrl?: string;
  apiKey?: string;
  accessToken?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export class EPayClient {
  readonly config: Required<EPayClientConfig>;
  private token: string | null = null;

  readonly payments: PaymentsResource;
  readonly paymentLinks: PaymentLinksResource;
  readonly invoices: InvoicesResource;
  readonly escrows: EscrowsResource;
  readonly refunds: RefundsResource;
  readonly subscriptions: SubscriptionsResource;
  readonly merchants: MerchantsResource;
  readonly settlements: SettlementsResource;
  readonly analytics: AnalyticsResource;

  constructor(config: EPayClientConfig = {}) {
    this.config = {
      apiUrl: 'http://localhost:4000',
      apiKey: '',
      accessToken: '',
      maxRetries: 3,
      retryDelayMs: 1000,
      timeoutMs: 30000,
      ...config,
    };

    if (config.apiKey) this.token = config.apiKey;
    if (config.accessToken) this.token = config.accessToken;

    this.payments = new PaymentsResource(this);
    this.paymentLinks = new PaymentLinksResource(this);
    this.invoices = new InvoicesResource(this);
    this.escrows = new EscrowsResource(this);
    this.refunds = new RefundsResource(this);
    this.subscriptions = new SubscriptionsResource(this);
    this.merchants = new MerchantsResource(this);
    this.settlements = new SettlementsResource(this);
    this.analytics = new AnalyticsResource(this);
  }

  /**
   * Set the API key for authentication.
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.token = apiKey;
  }

  /**
   * Set the JWT access token for authentication.
   */
  setAccessToken(token: string): void {
    this.config.accessToken = token;
    this.token = token;
  }

  /**
   * Clear authentication.
   */
  clearAuth(): void {
    this.token = null;
    this.config.apiKey = '';
    this.config.accessToken = '';
  }

  /**
   * Send an authenticated request to the EPay API.
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    retries = 0,
  ): Promise<T> {
    const url = `${this.config.apiUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      if (this.config.accessToken) {
        // eslint-disable-next-line @typescript-eslint/dot-notation
        headers['Authorization'] = `Bearer ${this.token}`;
      } else {
        // eslint-disable-next-line @typescript-eslint/dot-notation
        headers['x-api-key'] = this.token;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 401 && retries < this.config.maxRetries) {
        await this.delay(this.config.retryDelayMs * (retries + 1));
        return this.request<T>(method, path, body, retries + 1);
      }

      if (!response.ok) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        throw EPayError.fromResponse(response.status, errorBody);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof EPayError) throw error;

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new EPayError('Request timed out', 408);
      }

      if (retries < this.config.maxRetries) {
        await this.delay(this.config.retryDelayMs * (retries + 1));
        return this.request<T>(method, path, body, retries + 1);
      }

      throw error;
    }
  }

  /**
   * Convenience: GET request.
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  /**
   * Convenience: POST request.
   */
  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  /**
   * Convenience: PATCH request.
   */
  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  /**
   * Convenience: PUT request.
   */
  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  /**
   * Convenience: DELETE request.
   */
  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
