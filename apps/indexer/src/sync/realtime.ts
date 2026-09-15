import type { PrismaClient } from '@epay/database';

import type { BlockScanner } from '../blockchain/scanner';
import type { CheckpointManager } from '../checkpoint';
import type { IndexerConfig } from '../config';
import { dispatchEvent } from '../handlers/dispatcher';
import { createChildLogger } from '../logger';
import {
  batchDuration,
  chainTipLedger,
  decodeFailures,
  lastProcessedLedger,
  ledgerLag,
  scanDuration,
} from '../metrics';

const log = createChildLogger('sync:realtime');

export interface RealtimeSyncOptions {
  config: IndexerConfig;
  scanner: BlockScanner;
  checkpoint: CheckpointManager;
  prisma: PrismaClient;
  onBlockProcessed?: (block: number, eventCount: number) => void;
  onError?: (error: Error, block: number) => void;
}

export interface RealtimeStatus {
  running: boolean;
  currentBlock: number;
  chainTip: number;
  lag: number;
  consecutiveErrors: number;
}

/**
 * Continuously polls the chain tip and processes newly confirmed ledgers.
 *
 * A poll failure never advances the checkpoint, so a transient RPC outage
 * delays progress instead of losing a ledger. Consecutive failures widen the
 * poll interval (bounded exponential backoff) so a prolonged outage does not
 * hammer the RPC endpoint from every replica at once.
 */
export class RealtimeSync {
  private readonly config: IndexerConfig;
  private readonly scanner: BlockScanner;
  private readonly checkpoint: CheckpointManager;
  private readonly prisma: PrismaClient;
  private readonly onBlockProcessed?: (block: number, eventCount: number) => void;
  private readonly onError?: (error: Error, block: number) => void;
  private isRunning = false;
  private stopRequested = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private consecutiveErrors = 0;
  private chainTip = 0;
  private readonly maxBackoffMs = 120_000;

  constructor(options: RealtimeSyncOptions) {
    this.config = options.config;
    this.scanner = options.scanner;
    this.checkpoint = options.checkpoint;
    this.prisma = options.prisma;
    this.onBlockProcessed = options.onBlockProcessed;
    this.onError = options.onError;
  }

  /** Start the poll loop. Resolves after the first poll, not the whole loop. */
  async start(): Promise<void> {
    if (!this.config.realtimeEnabled) {
      log.info('Real-time sync disabled, skipping');
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    await this.checkpoint.ensureLoaded();
    log.info({ pollIntervalMs: this.config.pollIntervalMs }, 'Starting real-time sync');

    await this.poll();
    this.scheduleNextPoll();
  }

  /**
   * Delay before the next poll.
   *
   * Healthy runs poll on the configured interval; failures back off
   * exponentially, capped so a long outage still recovers promptly.
   */
  nextDelayMs(): number {
    if (this.consecutiveErrors === 0) return this.config.pollIntervalMs;
    // Double per consecutive failure, then clamp. The exponent is not bounded
    // separately: `2 ** n` saturates at Infinity and the clamp handles it.
    return Math.min(this.maxBackoffMs, this.config.pollIntervalMs * 2 ** this.consecutiveErrors);
  }

  private scheduleNextPoll(): void {
    if (this.stopRequested) return;

    this.pollTimer = setTimeout(() => {
      void (async () => {
        try {
          await this.poll();
        } catch (error) {
          log.error({ error }, 'Unhandled error in poll cycle');
        }
        this.scheduleNextPoll();
      })();
    }, this.nextDelayMs());
  }

  async poll(): Promise<void> {
    this.inFlight = this.processOnce();
    return this.inFlight;
  }

  private async processOnce(): Promise<void> {
    const startedAt = Date.now();

    try {
      await this.checkpoint.ensureLoaded();
      const fromBlock = this.checkpoint.getCurrentBlock() + 1;
      const tip = await this.scanner.getChainTip();
      this.chainTip = tip;
      chainTipLedger.set({}, tip);

      const targetBlock = Math.max(
        this.checkpoint.getCurrentBlock(),
        tip - this.config.confirmationLedgers,
      );

      if (targetBlock < fromBlock) {
        ledgerLag.set({}, Math.max(0, tip - this.checkpoint.getCurrentBlock()));
        return;
      }

      const scan = await this.scanner.scanRange(fromBlock, targetBlock);
      scanDuration.observe({}, (Date.now() - startedAt) / 1000);

      for (const event of scan.events) {
        await dispatchEvent(event, this.prisma);
      }

      if (scan.decodeFailures.length > 0) {
        decodeFailures.inc({}, scan.decodeFailures.length);
      }

      // Commit only after every event in the range is durable.
      await this.checkpoint.finalize(targetBlock);

      this.consecutiveErrors = 0;
      const lag = Math.max(0, tip - targetBlock);
      ledgerLag.set({}, lag);
      lastProcessedLedger.set({}, targetBlock);
      batchDuration.observe({}, (Date.now() - startedAt) / 1000);

      if (scan.events.length > 0 || lag > 20) {
        log.info(
          { block: targetBlock, events: scan.events.length, chainTip: tip, lag },
          'Real-time blocks processed',
        );
      }

      this.onBlockProcessed?.(targetBlock, scan.events.length);
    } catch (error) {
      this.consecutiveErrors++;
      const err = error instanceof Error ? error : new Error(String(error));
      this.onError?.(err, this.checkpoint.getCurrentBlock());

      log.error(
        {
          error: err.message,
          consecutiveErrors: this.consecutiveErrors,
          nextDelayMs: this.nextDelayMs(),
        },
        'Real-time poll error; checkpoint not advanced',
      );
    }
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.inFlight) {
      try {
        await this.inFlight;
      } catch {
        // Poll errors are already logged; ignore during shutdown.
      }
      this.inFlight = null;
    }

    log.info('Real-time sync stopped');
  }

  /**
   * Current state for the health endpoint.
   *
   * Uses the last observed chain tip rather than issuing an RPC call, so a
   * liveness probe on a slow network cannot itself time out and cause a restart.
   */
  getStatus(): RealtimeStatus {
    const currentBlock = this.checkpoint.getCurrentBlock();
    return {
      running: this.isRunning,
      currentBlock,
      chainTip: this.chainTip,
      lag: this.chainTip > 0 ? Math.max(0, this.chainTip - currentBlock) : 0,
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  get running(): boolean {
    return this.isRunning;
  }
}
