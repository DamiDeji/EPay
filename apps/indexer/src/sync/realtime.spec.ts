import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CheckpointManager } from '../checkpoint';
import type { IndexerConfig } from '../config';
import { chainTipLedger, lastProcessedLedger, ledgerLag } from '../metrics';
import { fakePrisma, fakeScanner, parsedEvent } from '../testing/doubles';

import { RealtimeSync } from './realtime';

function config(overrides: Partial<IndexerConfig> = {}): IndexerConfig {
  return {
    stellarNetwork: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    databaseUrl: 'postgresql://localhost:5432/epay',
    pollIntervalMs: 1000,
    batchSize: 10,
    confirmationLedgers: 2,
    historicalStartLedger: 0,
    realtimeEnabled: true,
    historicalEnabled: true,
    metricsPort: 4100,
    metricsEnabled: false,
    contractIds: [],
    ...overrides,
  };
}

function checkpointStore(initial = 0) {
  const finalized: number[] = [];
  return {
    finalized,
    store: {
      getLastIndexedBlock: async () => initial,
      setLastIndexedBlock: async (block: number) => {
        finalized.push(block);
      },
    },
  };
}

function build(options: {
  chainTip: number;
  initialBlock?: number;
  results?: NonNullable<Parameters<typeof fakeScanner>[0]>['results'];
  errors?: (Error | null)[];
  config?: Partial<IndexerConfig>;
}) {
  const prisma = fakePrisma();
  const { store, finalized } = checkpointStore(options.initialBlock ?? 0);
  const scanner = fakeScanner({
    chainTip: options.chainTip,
    ...(options.results ? { results: options.results } : {}),
    ...(options.errors ? { errors: options.errors } : {}),
  });
  const sync = new RealtimeSync({
    config: config(options.config),
    scanner,
    checkpoint: new CheckpointManager(store),
    prisma: prisma.client,
  });
  return { prisma, scanner, finalized, sync };
}

beforeEach(() => {
  chainTipLedger.reset();
  ledgerLag.reset();
  lastProcessedLedger.reset();
});

describe('RealtimeSync.poll', () => {
  it('processes the newly confirmed range and commits it', async () => {
    const { prisma, scanner, finalized, sync } = build({
      chainTip: 20,
      results: [{ events: [parsedEvent({ eventId: 'e1', ledgerSequence: 19 })] }],
    });

    await sync.poll();

    expect(scanner.scanCalls).toEqual([{ fromLedger: 1, toLedger: 18 }]);
    expect(finalized).toEqual([18]);
    expect(prisma.events).toHaveLength(1);
    expect(lastProcessedLedger.get()).toBe(18);
    expect(chainTipLedger.get()).toBe(20);
    expect(ledgerLag.get()).toBe(2);
  });

  it('does not scan when the confirmed range has not moved', async () => {
    const { scanner, finalized, sync } = build({ chainTip: 5, initialBlock: 10 });

    await sync.poll();

    expect(scanner.scanCalls).toHaveLength(0);
    expect(finalized).toEqual([]);
    expect(ledgerLag.get()).toBe(0);
  });

  it('leaves the checkpoint untouched when the RPC fails', async () => {
    const onError = vi.fn();
    const prisma = fakePrisma();
    const { store, finalized } = checkpointStore(0);
    const scanner = fakeScanner({ chainTip: 20, errors: [new Error('rpc down')] });
    const sync = new RealtimeSync({
      config: config(),
      scanner,
      checkpoint: new CheckpointManager(store),
      prisma: prisma.client,
      onError,
    });

    await sync.poll();

    expect(finalized).toEqual([]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(sync.getStatus().consecutiveErrors).toBe(1);
    expect(prisma.events).toHaveLength(0);
  });

  it('clears the error counter after a successful poll', async () => {
    const prisma = fakePrisma();
    const { store } = checkpointStore(0);
    const scanner = fakeScanner({
      chainTip: 20,
      errors: [new Error('rpc down'), null],
    });
    const sync = new RealtimeSync({
      config: config(),
      scanner,
      checkpoint: new CheckpointManager(store),
      prisma: prisma.client,
    });

    await sync.poll();
    expect(sync.getStatus().consecutiveErrors).toBe(1);

    await sync.poll();
    expect(sync.getStatus().consecutiveErrors).toBe(0);
  });

  it('does not commit when an event cannot be recorded', async () => {
    const prisma = fakePrisma();
    prisma.failNextCreate(new Error('database down'));
    const { store, finalized } = checkpointStore(0);
    const scanner = fakeScanner({
      chainTip: 20,
      results: [{ events: [parsedEvent({ ledgerSequence: 19 })] }],
    });
    const sync = new RealtimeSync({
      config: config(),
      scanner,
      checkpoint: new CheckpointManager(store),
      prisma: prisma.client,
    });

    await sync.poll();

    expect(finalized).toEqual([]);
    expect(sync.getStatus().consecutiveErrors).toBe(1);
  });
});

describe('RealtimeSync backoff', () => {
  it('polls at the configured interval while healthy', () => {
    const { sync } = build({ chainTip: 1 });
    expect(sync.nextDelayMs()).toBe(1000);
  });

  it('backs off exponentially as errors accumulate', async () => {
    const { sync } = build({
      chainTip: 20,
      errors: [new Error('x'), new Error('x'), new Error('x')],
    });

    await sync.poll();
    expect(sync.nextDelayMs()).toBe(2000);

    await sync.poll();
    expect(sync.nextDelayMs()).toBe(4000);

    await sync.poll();
    expect(sync.nextDelayMs()).toBe(8000);
  });

  it('caps the backoff so recovery stays prompt', async () => {
    const { sync } = build({
      chainTip: 20,
      errors: Array.from({ length: 20 }, () => new Error('x')),
    });

    for (let attempt = 0; attempt < 9; attempt++) {
      await sync.poll();
    }

    expect(sync.nextDelayMs()).toBe(120_000);
  });
});

describe('RealtimeSync status', () => {
  it('reports the cached tip rather than calling the network per probe', async () => {
    const { scanner, sync } = build({ chainTip: 33 });

    await sync.poll();
    const callsAfterPoll = scanner.tipCalls;

    const status = sync.getStatus();

    expect(status.chainTip).toBe(33);
    // The indexer deliberately stops `confirmationLedgers` (2) short of the tip,
    // so steady-state lag equals the buffer, not zero.
    expect(status.lag).toBe(2);
    expect(scanner.tipCalls).toBe(callsAfterPoll);
  });
});

describe('RealtimeSync lifecycle', () => {
  it('does not start when realtime is disabled', async () => {
    const { sync, scanner } = build({ chainTip: 10, config: { realtimeEnabled: false } });

    await sync.start();

    expect(sync.running).toBe(false);
    expect(scanner.scanCalls).toHaveLength(0);
  });

  it('stops cleanly and cancels the pending poll', async () => {
    vi.useFakeTimers();
    try {
      const { sync, scanner } = build({ chainTip: 1 });

      await sync.start();
      expect(sync.running).toBe(true);

      await sync.stop();
      const callsAtStop = scanner.tipCalls;

      await vi.advanceTimersByTimeAsync(10_000);

      expect(scanner.tipCalls).toBe(callsAtStop);
      expect(sync.running).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
