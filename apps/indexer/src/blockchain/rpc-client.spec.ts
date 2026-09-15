import { describe, expect, it, vi } from 'vitest';

import { eventRecord } from '../testing/scv';

import { HttpSorobanRpcClient, SorobanRpcError, backoffDelay } from './rpc-client';

const URL = 'https://soroban-testnet.stellar.org';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function rpcResult(result: unknown, status = 200): Response {
  return jsonResponse({ jsonrpc: '2.0', id: 1, result }, status);
}

interface Harness {
  client: HttpSorobanRpcClient;
  fetchMock: ReturnType<typeof vi.fn>;
  sleeps: number[];
}

function harness(
  responses: (Response | Error)[],
  options: { random?: () => number } = {},
): Harness {
  const sleeps: number[] = [];
  const fetchMock = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) {
      fetchMock.mockRejectedValueOnce(response);
    } else {
      fetchMock.mockResolvedValueOnce(response);
    }
  }

  const client = new HttpSorobanRpcClient({
    url: URL,
    fetchImpl: fetchMock as unknown as typeof fetch,
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
    random: options.random ?? (() => 0),
    retryPolicy: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 },
  });

  return { client, fetchMock, sleeps };
}

describe('backoffDelay', () => {
  it('never exceeds the configured ceiling', () => {
    const policy = { maxAttempts: 10, baseDelayMs: 1000, maxDelayMs: 30_000 };
    expect(backoffDelay(0, policy, () => 1)).toBe(1000);
    expect(backoffDelay(20, policy, () => 1)).toBe(30_000);
  });

  it('applies full jitter so replicas do not retry in lockstep', () => {
    const policy = { maxAttempts: 10, baseDelayMs: 1000, maxDelayMs: 30_000 };
    expect(backoffDelay(3, policy, () => 0)).toBe(0);
    expect(backoffDelay(3, policy, () => 0.5)).toBe(4000);
  });
});

describe('HttpSorobanRpcClient.getLatestLedger', () => {
  it('returns the sequence number', async () => {
    const { client } = harness([rpcResult({ sequence: 1234 })]);
    await expect(client.getLatestLedger()).resolves.toBe(1234);
  });

  it('rejects when the payload carries no sequence', async () => {
    const { client } = harness([rpcResult({})]);
    await expect(client.getLatestLedger()).rejects.toThrow(SorobanRpcError);
  });
});

describe('HttpSorobanRpcClient.getEvents', () => {
  it('sends the contract filter and the start ledger on the first page', async () => {
    const { client, fetchMock } = harness([rpcResult({ events: [], latestLedger: 10 })]);

    await client.getEvents({ startLedger: 5, contractIds: ['CABC'], limit: 50 });

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      method: string;
      params: {
        startLedger?: number;
        filters: { contractIds: string[] }[];
        pagination: { limit: number };
      };
    };

    expect(body.method).toBe('getEvents');
    expect(body.params.startLedger).toBe(5);
    expect(body.params.filters).toEqual([{ type: 'contract', contractIds: ['CABC'] }]);
    expect(body.params.pagination).toEqual({ limit: 50 });
  });

  it('omits the start ledger once a cursor is in play', async () => {
    const { client, fetchMock } = harness([rpcResult({ events: [], latestLedger: 10 })]);

    await client.getEvents({ startLedger: 5, contractIds: ['CABC'], cursor: 'abc' });

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      params: { startLedger?: number; pagination: { cursor?: string } };
    };

    expect(body.params.startLedger).toBeUndefined();
    expect(body.params.pagination.cursor).toBe('abc');
  });

  it('returns the events and the reported chain tip', async () => {
    const record = eventRecord({ contractId: 'CABC', eventName: 'payment_created' });
    const { client } = harness([rpcResult({ events: [record], latestLedger: 77 })]);

    const result = await client.getEvents({ startLedger: 1, contractIds: ['CABC'] });

    expect(result.events).toHaveLength(1);
    expect(result.latestLedger).toBe(77);
  });

  it('accepts both numeric and object forms of latestLedger', async () => {
    const objectForm = harness([rpcResult({ events: [], latestLedger: { sequence: 42 } })]);
    await expect(
      objectForm.client.getEvents({ startLedger: 1, contractIds: ['C'] }),
    ).resolves.toMatchObject({ latestLedger: 42 });

    const numericForm = harness([rpcResult({ events: [], latestLedger: 43 })]);
    await expect(
      numericForm.client.getEvents({ startLedger: 1, contractIds: ['C'] }),
    ).resolves.toMatchObject({ latestLedger: 43 });
  });

  it('reports zero when the tip is unusable, rather than guessing', async () => {
    const { client } = harness([rpcResult({ events: [], latestLedger: 'nonsense' })]);
    await expect(client.getEvents({ startLedger: 1, contractIds: ['C'] })).resolves.toMatchObject({
      latestLedger: 0,
    });
  });
});

describe('retry behaviour', () => {
  it('retries a rate limit and then succeeds', async () => {
    const { client, fetchMock, sleeps } = harness([
      jsonResponse({ error: { code: -32000 } }, 429),
      rpcResult({ sequence: 3 }),
    ]);

    await expect(client.getLatestLedger()).resolves.toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toHaveLength(1);
  });

  it('retries a 503', async () => {
    const { client, fetchMock } = harness([
      jsonResponse({ error: {} }, 503),
      rpcResult({ sequence: 9 }),
    ]);

    await expect(client.getLatestLedger()).resolves.toBe(9);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a transport failure', async () => {
    const { client, fetchMock } = harness([
      new TypeError('fetch failed'),
      rpcResult({ sequence: 5 }),
    ]);

    await expect(client.getLatestLedger()).resolves.toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a JSON-RPC error object', async () => {
    const { client, fetchMock } = harness([
      jsonResponse({ jsonrpc: '2.0', error: { code: -32603, message: 'internal' } }),
      rpcResult({ sequence: 6 }),
    ]);

    await expect(client.getLatestLedger()).resolves.toBe(6);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a client error', async () => {
    const { client, fetchMock, sleeps } = harness([jsonResponse({ error: {} }, 400)]);

    await expect(client.getLatestLedger()).rejects.toMatchObject({
      name: 'SorobanRpcError',
      retryable: false,
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleeps).toHaveLength(0);
  });

  it('does not retry a response with no result', async () => {
    const { client, fetchMock } = harness([jsonResponse({ jsonrpc: '2.0', id: 1 })]);

    await expect(client.getLatestLedger()).rejects.toThrow(/returned no result/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the configured number of attempts', async () => {
    const { client, fetchMock, sleeps } = harness([
      jsonResponse({ error: {} }, 500),
      jsonResponse({ error: {} }, 500),
      jsonResponse({ error: {} }, 500),
    ]);

    await expect(client.getLatestLedger()).rejects.toBeInstanceOf(SorobanRpcError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleeps).toHaveLength(2);
  });

  it('backs off exponentially between attempts', async () => {
    const { client, sleeps } = harness(
      [
        jsonResponse({ error: {} }, 500),
        jsonResponse({ error: {} }, 500),
        rpcResult({ sequence: 1 }),
      ],
      { random: () => 1 },
    );

    await client.getLatestLedger();

    // baseDelayMs 100: attempt 1 → min(1000, 100 * 2) = 200, attempt 2 → 400.
    expect(sleeps).toEqual([200, 400]);
  });

  it('retries a non-JSON body', async () => {
    const { client, fetchMock } = harness([
      new Response('<html>gateway</html>', { status: 200 }),
      rpcResult({ sequence: 2 }),
    ]);

    await expect(client.getLatestLedger()).resolves.toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('attaches a timeout signal to every request', async () => {
    const { client, fetchMock } = harness([rpcResult({ sequence: 1 })]);

    await client.getLatestLedger();

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
