import type { PrismaClient } from '@epay/database';

import type { BlockScanner } from '../blockchain/scanner';
import type { CheckpointManager } from '../checkpoint';
import type { IndexerConfig } from '../config';
import { dispatchEvent } from '../handlers/dispatcher';
import { createChildLogger } from '../logger';
import { batchDuration, decodeFailures, scanDuration } from '../metrics';

const log = createChildLogger('sync:historical');

export interface HistoricalSyncOptions {
  config: IndexerConfig;
  scanner: BlockScanner;
  checkpoint: CheckpointManager;
  prisma: PrismaClient;
  onProgress?: (scanned: number, total: number) => void;
  /** Injected so tests need not wait out real backoff delays. */
  sleep?: (ms: number) => Promise<void>;
}

export interface HistoricalSyncResult {
  blocksProcessed: number;
  eventsFound: number;
  durationMs: number;
  /** Batches that failed at least once before succeeding (retried). */
  batchesRetried: number;
  /** Events that could not be decoded; recorded, never silently dropped. */
  decodeFailures: number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Walks ledgers from the checkpoint up to the confirmed chain tip, once.
 *
 * Two properties matter more than throughput here:
 *
 * 1. **Contiguity.** The checkpoint only ever advances over a range that was
 *    fully fetched and recorded. A batch that fails is retried in place, and if
 *    it never succeeds the run aborts rather than stepping over it — the
 *    previous implementation logged a failed batch and moved on, so the next
 *    successful `finalize` silently skipped those ledgers forever.
 * 2. **Idempotency.** Every write is keyed by the on-chain event id, so a retry
 *    of a partially-applied batch cannot double-apply anything.
 */
export class HistoricalSync {
  private readonly config: IndexerConfig;
  private readonly scanner: BlockScanner;
  private readonly checkpoint: CheckpointManager;
  private readonly prisma: PrismaClient;
  private readonly onProgress?: (scanned: number, total: number) => void;
  private readonly sleep: (ms: number) => Promise<void>;
  private isRunning = false;
  private stopRequested = false;
  private batchesRetried = 0;
  private decodeFailureCount = 0;
  private readonly maxAttemptsPerBatch = 5;

  constructor(options: HistoricalSyncOptions) {
    this.config = options.config;
    this.scanner = options.scanner;
    this.checkpoint = options.checkpoint;
    this.prisma = options.prisma;
    this.onProgress = options.onProgress;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async run(): Promise<HistoricalSyncResult> {
    if (!this.config.historicalEnabled) {
      log.info('Historical sync disabled, skipping');
      return emptyResult();
    }

    this.isRunning = true;
    const startedAt = Date.now();
    let totalEvents = 0;
    let totalBlocks = 0;

    try {
      const fromBlock = await this.checkpoint.ensureLoaded();
      const chainTip = await this.scanner.getChainTip();

      if (fromBlock >= chainTip) {
        log.info({ fromBlock, chainTip }, 'Already at chain tip, no historical sync needed');
        return emptyResult();
      }

      const confirmationBuffer = this.config.confirmationLedgers;
      const toBlock = Math.max(fromBlock, chainTip - confirmationBuffer);
      const batchSize = this.config.batchSize;

      log.info({ fromBlock, toBlock, chainTip, confirmationBuffer }, 'Starting historical sync');

      for (let batchStart = fromBlock; batchStart <= toBlock; batchStart += batchSize) {
        if (this.stopRequested) {
          log.info({ batchStart }, 'Historical sync stop requested');
          break;
        }

        const batchEnd = Math.min(batchStart + batchSize - 1, toBlock);
        const batchStartedAt = Date.now();

        let applied = false;
        let retried = false;
        let lastError: unknown;

        for (
          let attempt = 1;
          attempt <= this.maxAttemptsPerBatch && !this.stopRequested;
          attempt++
        ) {
          try {
            const scannedAt = Date.now();
            const scan = await this.scanner.scanRange(batchStart, batchEnd);
            scanDuration.observe({}, (Date.now() - scannedAt) / 1000);

            for (const event of scan.events) {
              await dispatchEvent(event, this.prisma);
            }

            if (scan.decodeFailures.length > 0) {
              this.decodeFailureCount += scan.decodeFailures.length;
              decodeFailures.inc({}, scan.decodeFailures.length);
            }

            // Only now — after every event in the range is durable — is the
            // checkpoint allowed to move.
            await this.checkpoint.finalize(batchEnd);

            totalEvents += scan.events.length;
            totalBlocks += batchEnd - batchStart + 1;
            this.onProgress?.(batchEnd - fromBlock + 1, toBlock - fromBlock + 1);
            batchDuration.observe({}, (Date.now() - batchStartedAt) / 1000);
            applied = true;

            log.debug(
              { batchStart, batchEnd, eventsInBatch: scan.events.length, totalEvents, attempt },
              'Historical batch processed',
            );
            break;
          } catch (error) {
            lastError = error;
            if (attempt < this.maxAttemptsPerBatch && !retried) {
              retried = true;
              this.batchesRetried++;
            }
            const delay = Math.min(30_000, 1000 * 2 ** (attempt - 1));
            log.error(
              { batchStart, batchEnd, attempt, delayMs: delay, error },
              'Failed to process historical batch; retrying in place',
            );
            if (attempt < this.maxAttemptsPerBatch) await this.sleep(delay);
          }
        }

        if (!applied) {
          // Aborting keeps the checkpoint on the last contiguous good batch, so
          // a restart resumes exactly here instead of skipping the range.
          throw new Error(
            `Historical sync aborted: batch ${String(batchStart)}-${String(batchEnd)} failed ${String(this.maxAttemptsPerBatch)} times`,
            { cause: lastError },
          );
        }
      }

      const durationMs = Date.now() - startedAt;
      const result: HistoricalSyncResult = {
        blocksProcessed: totalBlocks,
        eventsFound: totalEvents,
        durationMs,
        batchesRetried: this.batchesRetried,
        decodeFailures: this.decodeFailureCount,
      };

      log.info(result, 'Historical sync completed');
      return result;
    } catch (error) {
      log.error({ error }, 'Historical sync failed');
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  stop(): void {
    this.stopRequested = true;
    log.info('Historical sync stop requested');
  }

  get running(): boolean {
    return this.isRunning;
  }
}

function emptyResult(): HistoricalSyncResult {
  return {
    blocksProcessed: 0,
    eventsFound: 0,
    durationMs: 0,
    batchesRetried: 0,
    decodeFailures: 0,
  };
}
