import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { IndexerConfig } from '../config';
import { fakeRpc, type FakeRpc } from '../testing/doubles';
import { eventRecord, u64 } from '../testing/scv';

import type { SorobanEventRecord } from './contracts';
import { SorobanRpcError } from './rpc-client';
import { BlockScanner } from './scanner';

const ROUTER = 'CDPAYMENTROUTER';

function config(overrides: Partial<IndexerConfig> = {}): IndexerConfig {
  return {
    stellarNetwork: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    databaseUrl: 'postgresql://localhost:5432/epay',
    pollIntervalMs: 1000,
    batchSize: 2,
    confirmationLedgers: 1,
    historicalStartLedger: 0,
    realtimeEnabled: true,
    historicalEnabled: true,
    metricsPort: 4100,
    metricsEnabled: true,
    contractIds: [ROUTER],
    ...overrides,
  };
}

function record(overrides: Partial<SorobanEventRecord> = {}): SorobanEventRecord {
  return {
    ...eventRecord({
      contractId: ROUTER,
      eventName: 'payment_created',
      data: [u64(1n)],
      ledger: 100,
    }),
    ...overrides,
  };
}

let rpc: FakeRpc;

beforeEach(() => {
  process.env.PAYMENT_ROUTER_CONTRACT_ID = ROUTER;
});

afterEach(() => {
  delete process.env.PAYMENT_ROUTER_CONTRACT_ID;
});

describe('BlockScanner.scanRange', () => {
  it('decodes events returned by the RPC', async () => {
    rpc = fakeRpc([{ events: [record()], latestLedger: 200 }]);
    const scanner = new BlockScanner(config(), rpc);

    const result = await scanner.scanRange(100, 100);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      eventName: 'payment_created',
      contractName: 'PaymentRouter',
      ledgerSequence: 100,
    });
    expect(result.latestLedger).toBe(200);
    expect(result.pagesFetched).toBe(1);
    expect(result.decodeFailures).toEqual([]);
  });

  it('subscribes only to the configured contract ids', async () => {
    rpc = fakeRpc([{ events: [], latestLedger: 1 }]);
    const scanner = new BlockScanner(config(), rpc);

    await scanner.scanRange(10, 20);

    expect(rpc.calls[0]?.contractIds).toEqual([ROUTER]);
    expect(rpc.calls[0]?.startLedger).toBe(10);
  });

  it('ignores decoded events above the requested range', async () => {
    rpc = fakeRpc([
      {
        events: [
          record({ id: 'e-100', ledger: 100 }),
          record({ id: 'e-101', ledger: 101 }),
          record({ id: 'e-500', ledger: 500 }),
        ],
        latestLedger: 500,
      },
    ]);
    const scanner = new BlockScanner(config(), rpc);

    const result = await scanner.scanRange(100, 101);

    expect(result.events.map((event) => event.eventId)).toEqual(['e-100', 'e-101']);
  });

  it('reports undecodable events instead of throwing or dropping them', async () => {
    rpc = fakeRpc([
      {
        events: [record({ id: 'bad-1', value: 'not-xdr' }), record({ id: 'good-1', ledger: 100 })],
        latestLedger: 100,
      },
    ]);
    const scanner = new BlockScanner(config(), rpc);

    const result = await scanner.scanRange(100, 100);

    expect(result.events.map((event) => event.eventId)).toEqual(['good-1']);
    expect(result.decodeFailures).toHaveLength(1);
    expect(result.decodeFailures[0]?.recordId).toBe('bad-1');
  });

  it('follows the cursor to page through a range', async () => {
    rpc = fakeRpc([
      { events: [record({ id: 'e-1', ledger: 1 })], latestLedger: 3, cursor: 'next' },
      { events: [record({ id: 'e-2', ledger: 2 })], latestLedger: 3 },
    ]);
    const scanner = new BlockScanner(config(), rpc);

    const result = await scanner.scanRange(1, 2);

    expect(result.pagesFetched).toBe(2);
    expect(result.events.map((event) => event.eventId)).toEqual(['e-1', 'e-2']);
    expect(rpc.calls[0]?.cursor).toBeUndefined();
    expect(rpc.calls[1]?.cursor).toBe('next');
  });

  it('does not advance any checkpoint while scanning', async () => {
    // There is no checkpoint in the signature at all: the scanner cannot move it.
    rpc = fakeRpc([{ events: [record()], latestLedger: 100 }]);
    const scanner = new BlockScanner(config(), rpc);

    await scanner.scanRange(100, 100);

    expect(Object.keys(scanner)).not.toContain('checkpoint');
  });

  it('skips the RPC entirely for an inverted range', async () => {
    rpc = fakeRpc([]);
    const scanner = new BlockScanner(config(), rpc);

    const result = await scanner.scanRange(10, 9);

    expect(result.events).toEqual([]);
    expect(result.pagesFetched).toBe(0);
    expect(rpc.calls).toHaveLength(0);
  });

  it('returns nothing when no contracts are configured', async () => {
    delete process.env.PAYMENT_ROUTER_CONTRACT_ID;
    rpc = fakeRpc([], 555);
    const scanner = new BlockScanner(config({ contractIds: [] }), rpc);

    const result = await scanner.scanRange(1, 10);

    expect(result.events).toEqual([]);
    expect(rpc.calls).toHaveLength(0);
    expect(result.latestLedger).toBe(555);
  });

  it('propagates an RPC failure rather than returning a partial range', async () => {
    const failing: FakeRpc = {
      calls: [],
      getEvents: async () => {
        throw new SorobanRpcError('rpc down', { method: 'getEvents', retryable: true });
      },
      getLatestLedger: async () => 1,
    };
    const scanner = new BlockScanner(config(), failing);

    await expect(scanner.scanRange(1, 10)).rejects.toThrow(SorobanRpcError);
  });
});

describe('BlockScanner.getChainTip', () => {
  it('reports the RPC tip', async () => {
    rpc = fakeRpc([], 4242);
    const scanner = new BlockScanner(config(), rpc);

    await expect(scanner.getChainTip()).resolves.toBe(4242);
  });

  it('propagates an outage instead of inventing a height', async () => {
    const failing: FakeRpc = {
      calls: [],
      getEvents: async () => ({ events: [], latestLedger: 0 }),
      getLatestLedger: async () => {
        throw new SorobanRpcError('unreachable', { method: 'getLatestLedger', retryable: true });
      },
    };
    const scanner = new BlockScanner(config(), failing);

    await expect(scanner.getChainTip()).rejects.toThrow(SorobanRpcError);
  });
});
