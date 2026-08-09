import type { BlockScanner } from '../blockchain/scanner';
import type { CheckpointManager } from '../checkpoint';
import type { IndexerConfig } from '../config';
import { dispatchEvent } from '../handlers/dispatcher';
import { createChildLogger } from '../logger';

const log = createChildLogger('sync:realtime');

export interface RealtimeSyncOptions {
  config: IndexerConfig;
  scanner: BlockScanner;
  checkpoint: CheckpointManager;
  prisma: any;
  onBlockProcessed?: (block: number, eventCount: number) => void;
  onError?: (error: Error, block: number) => void;
}

/**
 * Real-time sync engine that continuously polls the Stellar blockchain
 * for new blocks and processes relevant events.
 */
export class RealtimeSync {
  private readonly config: IndexerConfig;
  private readonly scanner: BlockScanner;
  private readonly checkpoint: CheckpointManager;
  private readonly prisma: any;
  private readonly onBlockProcessed?: (block: number, eventCount: number) => void;
  private readonly onError?: (error: Error, block: number) => void;
  private isRunning = false;
  private stopRequested = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private currentPoll: Promise<void> | null = null;
  private consecutiveErrors = 0;
  private readonly maxConsecutiveErrors = 10;

  constructor(options: RealtimeSyncOptions) {
    this.config = options.config;
    this.scanner = options.scanner;
    this.checkpoint = options.checkpoint;
    this.prisma = options.prisma;
    this.onBlockProcessed = options.onBlockProcessed;
    this.onError = options.onError;
  }

  async start(): Promise<void> {
    if (!this.config.realtimeEnabled) {
      log.info('Real-time sync disabled, skipping');
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    log.info({ pollIntervalMs: this.config.pollIntervalMs }, 'Starting real-time sync');

    await this.poll();
    this.scheduleNextPoll();
  }

  private scheduleNextPoll(): void {
    if (this.stopRequested) return;

    this.pollTimer = setTimeout(() => { void (async () => {
      try {
        await this.poll();
      } catch (error) {
        log.error({ error }, 'Unhandled error in poll cycle');
      }

      if (!this.stopRequested) {
        this.scheduleNextPoll();
      }
    })(); }, this.config.pollIntervalMs);
  }

  private async poll(): Promise<void> {
    this.currentPoll = this._poll();
    return this.currentPoll;
  }

  private async _poll(): Promise<void> {
    try {
      const currentBlock = this.checkpoint.getCurrentBlock();
      const chainTip = await this.scanner.getChainTip();
      const confirmationBuffer = this.config.confirmationLedgers;
      const targetBlock = Math.max(currentBlock, chainTip - confirmationBuffer);

      if (targetBlock <= currentBlock) {
        log.debug({ currentBlock, chainTip, lag: chainTip - currentBlock }, 'No new blocks to process');
        return;
      }

      log.debug({ fromBlock: currentBlock + 1, toBlock: targetBlock }, 'Polling new blocks');

      const { events } = await this.scanner.scanRange(currentBlock + 1, targetBlock);

      for (const event of events) {
        await dispatchEvent(event, this.prisma);
      }

      await this.checkpoint.finalize(targetBlock);
      this.consecutiveErrors = 0;

      const lag = this.checkpoint.getLag(chainTip);
      if (events.length > 0 || lag > 20) {
        log.info(
          { block: targetBlock, events: events.length, chainTip, lag },
          'Real-time blocks processed',
        );
      }

      this.onBlockProcessed?.(targetBlock, events.length);
    } catch (error) {
      this.consecutiveErrors++;
      const err = error instanceof Error ? error : new Error(String(error));
      this.onError?.(err, this.checkpoint.getCurrentBlock());

      log.error(
        { error: err.message, consecutiveErrors: this.consecutiveErrors },
        'Real-time poll error',
      );

      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        log.error({ consecutiveErrors: this.consecutiveErrors }, 'Too many consecutive errors, pausing');
        await this.sleep(Math.min(this.config.pollIntervalMs * 4, 120_000));
      }
    }
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Await the current in-flight poll if one is running
    if (this.currentPoll) {
      try {
        await this.currentPoll;
      } catch {
        // Poll errors are already logged; ignore during shutdown
      }
      this.currentPoll = null;
    }

    log.info('Real-time sync stopped');
  }

  async getStatus(): Promise<{
    running: boolean;
    currentBlock: number;
    chainTip: number;
    lag: number;
    consecutiveErrors: number;
  }> {
    let chainTip = 0;
    try {
      chainTip = await this.scanner.getChainTip();
    } catch {
      // Ignore
    }

    return {
      running: this.isRunning,
      currentBlock: this.checkpoint.getCurrentBlock(),
      chainTip,
      lag: this.checkpoint.getLag(chainTip),
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  get running(): boolean {
    return this.isRunning;
  }
}
