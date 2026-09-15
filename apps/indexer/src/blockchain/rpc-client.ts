import { createChildLogger } from '../logger';

import type { SorobanEventRecord } from './contracts';

const log = createChildLogger('soroban-rpc');

/** JSON-RPC error codes worth retrying, plus the HTTP statuses we treat the same way. */
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface SorobanRpcErrorOptions {
  method: string;
  /** JSON-RPC error code, when the failure came back as a JSON-RPC error object. */
  code?: number;
  /** HTTP status, when the failure came back as a non-2xx response. */
  status?: number;
  /** Whether retrying the same request could plausibly succeed. */
  retryable: boolean;
  cause?: unknown;
}

/** A failed Soroban RPC call. */
export class SorobanRpcError extends Error {
  readonly method: string;
  readonly code: number | undefined;
  readonly status: number | undefined;
  readonly retryable: boolean;

  constructor(message: string, options: SorobanRpcErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'SorobanRpcError';
    this.method = options.method;
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

export interface GetEventsParams {
  startLedger: number;
  contractIds: string[];
  /** RPC caps this at 10 000; the client clamps rather than letting RPC reject it. */
  limit?: number;
  /** Opaque pagination cursor from a previous page. */
  cursor?: string;
}

export interface GetEventsResult {
  events: SorobanEventRecord[];
  /** Chain tip as reported alongside the page, so callers need not re-poll. */
  latestLedger: number;
  cursor?: string;
}

/**
 * The subset of Soroban RPC the indexer depends on.
 *
 * Declared as an interface so the sync engines can be tested against a fake
 * without a network or a live chain.
 */
export interface SorobanRpcClient {
  getEvents(params: GetEventsParams): Promise<GetEventsResult>;
  getLatestLedger(): Promise<number>;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
};

export interface HttpSorobanRpcClientOptions {
  url: string;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injected so tests need not wait out real backoff delays. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected so jitter is deterministic under test. */
  random?: () => number;
  retryPolicy?: RetryPolicy;
  requestTimeoutMs?: number;
}

interface JsonRpcResponse {
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

/**
 * Exponential backoff with full jitter.
 *
 * Full jitter (rather than a fixed multiplier) matters here because every
 * indexer replica polls the same RPC endpoint: identical backoff schedules would
 * re-synchronise them into a thundering herd straight after an outage.
 */
export function backoffDelay(
  attempt: number,
  policy: RetryPolicy,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
  return Math.floor(random() * exponential);
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUSES.has(status);
}

/** JSON-RPC 2.0 client for Soroban RPC, with retries on transient failures. */
export class HttpSorobanRpcClient implements SorobanRpcClient {
  private readonly url: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly retryPolicy: RetryPolicy;
  private readonly requestTimeoutMs: number;
  private nextRequestId = 1;

  constructor(options: HttpSorobanRpcClientOptions) {
    this.url = options.url;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error('HttpSorobanRpcClient requires a fetch implementation');
    }
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
    this.retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 20_000;
  }

  async getLatestLedger(): Promise<number> {
    const result = await this.call<{ sequence?: number }>('getLatestLedger', {});
    const sequence = result.sequence;
    if (typeof sequence !== 'number') {
      throw new SorobanRpcError('getLatestLedger returned no sequence', {
        method: 'getLatestLedger',
        retryable: false,
      });
    }
    return sequence;
  }

  async getEvents(params: GetEventsParams): Promise<GetEventsResult> {
    const result = await this.call<{
      events?: SorobanEventRecord[];
      latestLedger?: number | { sequence?: number };
      cursor?: string;
    }>('getEvents', {
      // Soroban RPC rejects a request that carries both `startLedger` and a
      // `cursor`, so the ledger is only sent on the first page.
      ...(params.cursor ? {} : { startLedger: params.startLedger }),
      filters: [{ type: 'contract', contractIds: params.contractIds }],
      pagination: params.cursor
        ? { cursor: params.cursor, limit: params.limit ?? 200 }
        : { limit: params.limit ?? 200 },
    });

    return {
      events: result.events ?? [],
      latestLedger: normalizeLatestLedger(result.latestLedger),
      ...(result.cursor ? { cursor: result.cursor } : {}),
    };
  }

  private async call<T>(method: string, params: Record<string, unknown>): Promise<T> {
    let lastError: SorobanRpcError | undefined;

    for (let attempt = 0; attempt < this.retryPolicy.maxAttempts; attempt++) {
      if (attempt > 0) {
        const delay = backoffDelay(attempt, this.retryPolicy, this.random);
        log.warn(
          { method, attempt, delayMs: delay, error: lastError?.message },
          'Retrying Soroban RPC call',
        );
        await this.sleep(delay);
      }

      try {
        return await this.callOnce<T>(method, params);
      } catch (error) {
        lastError = toSorobanRpcError(error, method);
        if (!lastError.retryable) throw lastError;
      }
    }

    throw (
      lastError ??
      new SorobanRpcError(`Soroban RPC call ${method} exhausted all attempts`, {
        method,
        retryable: false,
      })
    );
  }

  private async callOnce<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: this.nextRequestId++,
      method,
      params,
    });

    let response: Response;
    try {
      response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      // Network failures and timeouts are transient by nature.
      throw new SorobanRpcError(`Soroban RPC ${method} request failed`, {
        method,
        retryable: true,
        cause: error,
      });
    }

    if (!response.ok) {
      throw new SorobanRpcError(`Soroban RPC ${method} returned HTTP ${String(response.status)}`, {
        method,
        status: response.status,
        retryable: isRetryableStatus(response.status),
      });
    }

    let payload: JsonRpcResponse;
    try {
      payload = (await response.json()) as JsonRpcResponse;
    } catch (error) {
      throw new SorobanRpcError(`Soroban RPC ${method} returned a non-JSON body`, {
        method,
        retryable: true,
        cause: error,
      });
    }

    if (payload.error) {
      throw new SorobanRpcError(
        payload.error.message ?? `Soroban RPC ${method} returned an error`,
        {
          method,
          ...(payload.error.code === undefined ? {} : { code: payload.error.code }),
          retryable: true,
        },
      );
    }

    if (payload.result === undefined) {
      throw new SorobanRpcError(`Soroban RPC ${method} returned no result`, {
        method,
        retryable: false,
      });
    }

    return payload.result as T;
  }
}

function normalizeLatestLedger(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const sequence = (value as { sequence?: unknown }).sequence;
    if (typeof sequence === 'number') return sequence;
  }
  return 0;
}

function toSorobanRpcError(error: unknown, method: string): SorobanRpcError {
  if (error instanceof SorobanRpcError) return error;
  return new SorobanRpcError(error instanceof Error ? error.message : String(error), {
    method,
    retryable: false,
    cause: error,
  });
}
