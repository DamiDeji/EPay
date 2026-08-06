import type { BlockScanner } from '../blockchain/scanner';
import type { CheckpointManager } from '../checkpoint';
import type { IndexerConfig } from '../config';
import { dispatchEvent } from '../handlers/dispatcher';
import { createChildLogger } from '../logger';

const log = createChildLogger('sync:historical');

export interface HistoricalSyncOptions {
  config: IndexerConfig;
  scanner: BlockScanner;
  checkpoint: CheckpointManager;
  prisma: any;
  onProgress?: (scanned: number, total: number) => void;
}

/**
 * Historical sync engine that processes blocks from the last checkpoint
 * up to the current chain tip.
 */
export class HistoricalSync {
  private readonly config: IndexerConfig;
  private readonly scanner: BlockScanner;
  private readonly checkpoint: CheckpointManager;
  private readonly prisma: any;
  private readonly onProgress?: (scanned: number, total: number) => void;
  private isRunning = false;
  private stopRequested = false;
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures = 5;
  private totalFailures = 0;

  constructor(options: HistoricalSyncOptions) {
    this.config = options.config;
    this.scanner = options.scanner;
    this.checkpoint = options.checkpoint;
    this.prisma = options.prisma;
    this.onProgress = options.onProgress;
  }

  async run(): Promise<{
    blocksProcessed: number;
    eventsFound: number;
    durationMs: number;
    batchesFailed: number;
  }> {
    if (!this.config.historicalEnabled) {
      log.info('Historical sync disabled, skipping');
      return { blocksProcessed: 0, eventsFound: 0, durationMs: 0, batchesFailed: 0 };
    }

    this.isRunning = true;
    const startedAt = Date.now();
    let totalEvents = 0;
    let totalBlocks = 0;

    try {
      const fromBlock = this.checkpoint.getCurrentBlock();
      const chainTip = await this.scanner.getChainTip();

      if (fromBlock >= chainTip) {
        log.info({ fromBlock, chainTip }, 'Already at chain tip, no historical sync needed');
        return { blocksProcessed: 0, eventsFound: 0, durationMs: 0, batchesFailed: 0 };
      }

      const confirmationBuffer = this.config.confirmationLedgers;
      const toBlock = Math.max(fromBlock, chainTip - confirmationBuffer);

      log.info({ fromBlock, toBlock, chainTip, confirmationBuffer }, 'Starting historical sync');

      const batchSize = this.config.batchSize;
      for (let batchStart = fromBlock; batchStart <= toBlock; batchStart += batchSize) {
        if (this.stopRequested) {
          log.info('Historical sync stop requested');
          break;
        }

        const batchEnd = Math.min(batchStart + batchSize - 1, toBlock);

        try {
          const { events } = await this.scanner.scanRange(batchStart, batchEnd);

          for (const event of events) {
            await dispatchEvent(event, this.prisma);
          }

          totalEvents += events.length;
          totalBlocks += batchEnd - batchStart + 1;

          await this.checkpoint.finalize(batchEnd);
          this.consecutiveFailures = 0;
          this.onProgress?.(batchEnd - fromBlock + 1, toBlock - fromBlock + 1);

          log.debug(
            { batchStart, batchEnd, eventsInBatch: events.length, totalEvents },
            'Historical batch processed',
          );
        } catch (error) {
          this.consecutiveFailures++;
          this.totalFailures++;
          log.error(
            {
              batchStart,
              batchEnd,
              error,
              consecutiveFailures: this.consecutiveFailures,
              maxConsecutiveFailures: this.maxConsecutiveFailures,
            },
            'Failed to process historical batch',
          );

          if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
            log.error(
              { consecutiveFailures: this.consecutiveFailures },
              'Too many consecutive batch failures, aborting historical sync',
            );
            throw new Error(
              `Historical sync aborted after ${this.consecutiveFailures} consecutive batch failures`,
            );
          }
          // Otherwise continue with next batch for resilience
        }
      }

      const durationMs = Date.now() - startedAt;
      log.info(
        { blocksProcessed: totalBlocks, eventsFound: totalEvents, durationMs, batchesFailed: this.totalFailures },
        'Historical sync completed',
      );

      return { blocksProcessed: totalBlocks, eventsFound: totalEvents, durationMs, batchesFailed: this.totalFailures };
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
