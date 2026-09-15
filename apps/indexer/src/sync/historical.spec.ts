import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CheckpointManager } from '../checkpoint';
import type { IndexerConfig } from '../config';
import { decodeFailures } from '../metrics';
import { fakePrisma, fakeScanner, parsedEvent } from '../testing/doubles';

import { HistoricalSync } from './historical';

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

const noSleep = async (): Promise<void> => undefined;

beforeEach(() => {
  decodeFailures.reset();
});

describe('HistoricalSync.run', () => {
  it('returns immediately when disabled', async () => {
    const prisma = fakePrisma();
    const scanner = fakeScanner({ chainTip: 100 });
    const sync = new HistoricalSync({
      config: config({ historicalEnabled: false }),
      scanner,
      checkpoint: new CheckpointManager(checkpointStore().store),
      prisma: prisma.client,
      sleep: noSleep,
    });

    const result = await sync.run();

    expect(result.blocksProcessed).toBe(0);
    expect(scanner.scanCalls).toHaveLength(0);
  });

  it('stops at the confirmation buffer, not the raw chain tip', async () => {
    const prisma = fakePrisma();
    const scanner = fakeScanner({ chainTip: 12 });
    const sync = new HistoricalSync({
      config: config({ batchSize: 100, confirmationLedgers: 2 }),
      scanner,
      checkpoint: new CheckpointManager(checkpointStore().store),
      prisma: prisma.client,
      sleep: noSleep,
    });

    await sync.run();

    expect(scanner.scanCalls[0]).toEqual({ fromLedger: 0, toLedger: 10 });
  });

  it('does nothing when already at the chain tip', async () => {
    const prisma = fakePrisma();
    const scanner = fakeScanner({ chainTip: 50 });
    const sync = new HistoricalSync({
      config: config(),
      scanner,
      checkpoint: new CheckpointManager(checkpointStore(50).store),
      prisma: prisma.client,
      sleep: noSleep,
    });

    const result = await sync.run();

    expect(result.blocksProcessed).toBe(0);
    expect(scanner.scanCalls).toHaveLength(0);
  });

  it('records events and commits the checkpoint for each batch', async () => {
    const prisma = fakePrisma();
    const { store, finalized } = checkpointStore(0);
    const scanner = fakeScanner({
      chainTip: 25,
      results: [
        { events: [parsedEvent({ eventId: 'a', ledgerSequence: 1 })] },
        { events: [parsedEvent({ eventId: 'b', ledgerSequence: 14 })] },
        { events: [] },
      ],
    });
    const sync = new HistoricalSync({
      config: config({ batchSize: 10, confirmationLedgers: 1 }),
      scanner,
      checkpoint: new CheckpointManager(store),
      prisma: prisma.client,
      sleep: noSleep,
    });

    const result = await sync.run();

    // toBlock = 25 - 1 = 24, so batches are 0-9, 10-19, 20-24.
    expect(scanner.scanCalls).toEqual([
      { fromLedger: 0, toLedger: 9 },
      { fromLedger: 10, toLedger: 19 },
      { fromLedger: 20, toLedger: 24 },
    ]);
    expect(finalized).toEqual([9, 19, 24]);
    expect(result.blocksProcessed).toBe(25);
    expect(result.eventsFound).toBe(2);
    expect(prisma.events.map((row) => row.eventId)).toEqual(['a', 'b']);
  });

  it('retries a failed batch in place instead of skipping its ledgers', async () => {
    const prisma = fakePrisma();
    const { store, finalized } = checkpointStore(0);
    const scanner = fakeScanner({
      chainTip: 11,
      errors: [new Error('rpc dropped'), null],
      results: [{ events: [] }, { events: [] }],
    });
    const sync = new HistoricalSync({
      config: config({ batchSize: 10, confirmationLedgers: 1 }),
      scanner,
      checkpoint: new CheckpointManager(store),
      prisma: prisma.client,
      sleep: noSleep,
    });

    const result = await sync.run();

    // The retry re-scans the same range.
    expect(scanner.scanCalls[0]).toEqual({ fromLedger: 0, toLedger: 9 });
    expect(scanner.scanCalls[1]).toEqual({ fromLedger: 0, toLedger: 9 });
    expect(result.batchesRetried).toBe(1);
    expect(finalized).toEqual([9, 10]);
  });

  it('aborts rather than advancing the checkpoint past a batch it never processed', async () => {
    const prisma = fakePrisma();
    const { store, finalized } = checkpointStore(0);
    // Every attempt for the second batch fails.
    const scanner = fakeScanner({
      chainTip: 11,
      errors: [
        null,
        new Error('permanent'),
        new Error('permanent'),
        new Error('permanent'),
        new Error('permanent'),
        new Error('permanent'),
      ],
    });
    const sync = new HistoricalSync({
      config: config({ batchSize: 10, confirmationLedgers: 1 }),
      scanner,
      checkpoint: new CheckpointManager(store),
      prisma: prisma.client,
      sleep: noSleep,
    });

    await expect(sync.run()).rejects.toThrow(/aborted/);

    // Only the first batch was committed; the checkpoint is left exactly at the
    // last contiguous good ledger so a restart resumes there.
    expect(finalized).toEqual([9]);
  });

  it('does not commit a batch whose event failed to be recorded', async () => {
    const prisma = fakePrisma();
    const { store, finalized } = checkpointStore(0);
    prisma.failNextCreate(new Error('database unavailable'));
    prisma.failNextCreate(new Error('database unavailable'));
    prisma.failNextCreate(new Error('database unavailable'));
    prisma.failNextCreate(new Error('database unavailable'));
    prisma.failNextCreate(new Error('database unavailable'));
    const scanner = fakeScanner({
      chainTip: 5,
      results: [{ events: [parsedEvent({ ledgerSequence: 1 })] }],
    });
    const sync = new HistoricalSync({
      config: config({ batchSize: 10, confirmationLedgers: 0 }),
      scanner,
      checkpoint: new CheckpointManager(store),
      prisma: prisma.client,
      sleep: noSleep,
    });

    await expect(sync.run()).rejects.toThrow();

    expect(finalized).toEqual([]);
  });

  it('counts undecodable events without failing the batch', async () => {
    const prisma = fakePrisma();
    const { store, finalized } = checkpointStore(0);
    const scanner = fakeScanner({
      chainTip: 3,
      results: [
        {
          events: [],
          decodeFailures: [{ recordId: 'x', reason: 'bad xdr' }],
        },
      ],
    });
    const sync = new HistoricalSync({
      config: config({ batchSize: 10, confirmationLedgers: 0 }),
      scanner,
      checkpoint: new CheckpointManager(store),
      prisma: prisma.client,
      sleep: noSleep,
    });

    const result = await sync.run();

    expect(result.decodeFailures).toBe(1);
    expect(decodeFailures.get()).toBe(1);
    // The batch still commits: a malformed event is recorded as a failure, not
    // treated as a reason to stall the whole chain.
    expect(finalized).toEqual([3]);
  });

  it('stops on request and leaves the checkpoint at the last good batch', async () => {
    const prisma = fakePrisma();
    const { store, finalized } = checkpointStore(0);
    const onProgress = vi.fn();
    let scanner: ReturnType<typeof fakeScanner>;
    const sync = new HistoricalSync({
      config: config({ batchSize: 10, confirmationLedgers: 0 }),
      scanner: (scanner = fakeScanner({ chainTip: 30 })),
      checkpoint: new CheckpointManager(store),
      prisma: prisma.client,
      sleep: noSleep,
      onProgress: (scanned, total) => {
        onProgress(scanned, total);
        sync.stop();
      },
    });

    await sync.run();

    expect(finalized).toEqual([9]);
    expect(scanner.scanCalls).toHaveLength(1);
    // 10 of the 31 ledgers below the chain tip are done (0..9 inclusive).
    expect(onProgress).toHaveBeenCalledWith(10, 31);
  });
});
