import { createChildLogger } from './logger';

const log = createChildLogger('checkpoint');

/** Storage the checkpoint persists through. Narrowed so tests need no database. */
export interface CheckpointStore {
  getLastIndexedBlock: () => Promise<number>;
  setLastIndexedBlock: (block: number) => Promise<void>;
}

/** The slice of the Prisma client the checkpoint needs. */
export interface IndexerStatePrismaClient {
  indexerState: {
    findUnique: (args: { where: { key: string } }) => Promise<{ value: string } | null>;
    upsert: (args: {
      where: { key: string };
      update: { value: string };
      create: { key: string; value: string };
    }) => Promise<unknown>;
  };
}

export const LAST_INDEXED_BLOCK_KEY = 'last_indexed_block';

/**
 * Tracks the highest ledger whose events have been fully projected.
 *
 * The value is persisted after each successful batch, so a crash or restart
 * resumes from the last committed ledger rather than replaying from genesis or
 * skipping ahead.
 */
export class CheckpointManager {
  private currentBlock: number;
  private lastFinalizedBlock: number;
  private readonly fallbackBlock: number;
  private readonly db: CheckpointStore;
  private loaded = false;

  constructor(db: CheckpointStore, fallbackBlock = 0) {
    this.currentBlock = fallbackBlock;
    this.lastFinalizedBlock = fallbackBlock;
    this.fallbackBlock = fallbackBlock;
    this.db = db;
  }

  /**
   * Load the last committed ledger.
   *
   * A corrupted or nonsensical stored value (non-numeric, negative, beyond
   * `Number.MAX_SAFE_INTEGER`) is treated as "no checkpoint" and reported, rather
   * than propagated into arithmetic that would produce `NaN` ledger ranges.
   */
  async load(): Promise<number> {
    const stored = await this.db.getLastIndexedBlock();

    if (!Number.isSafeInteger(stored) || stored < 0) {
      log.error(
        { stored, fallbackBlock: this.fallbackBlock },
        'Corrupted checkpoint value; falling back to the configured start ledger',
      );
      this.currentBlock = this.fallbackBlock;
      this.lastFinalizedBlock = this.fallbackBlock;
      this.loaded = true;
      return this.fallbackBlock;
    }

    this.currentBlock = stored;
    this.lastFinalizedBlock = stored;
    this.loaded = true;
    log.info({ block: stored }, 'Checkpoint loaded');
    return stored;
  }

  /**
   * Load the checkpoint if it has not been loaded yet.
   *
   * The sync engines call this so a caller that forgets to `load()` first cannot
   * silently restart the scan from the configured start ledger and re-read the
   * whole chain. It is memoised, so a long-running poll loop pays for it once.
   */
  async ensureLoaded(): Promise<number> {
    if (!this.loaded) return this.load();
    return this.currentBlock;
  }

  /** Highest ledger the scanner has read (may be ahead of the checkpoint). */
  getCurrentBlock(): number {
    return this.currentBlock;
  }

  /** Highest ledger durably committed. */
  getLastFinalizedBlock(): number {
    return this.lastFinalizedBlock;
  }

  /** Record the ledger the scanner has read, without committing it. */
  advance(block: number): void {
    this.currentBlock = block;
  }

  /**
   * Commit a ledger as fully projected.
   *
   * @throws {Error} when `block` moves the checkpoint backwards. Stellar commits
   * finality quickly and the indexer only scans the confirmed region, so a
   * backwards move means either a corrupted caller or a reorg deeper than
   * `INDEXER_CONFIRMATION_LEDGERS`. Both need an operator decision: rewinding
   * silently would re-project ledgers whose events are already applied.
   */
  async finalize(block: number, options: { allowRewind?: boolean } = {}): Promise<void> {
    if (block < this.lastFinalizedBlock && !options.allowRewind) {
      throw new Error(
        `Refusing to move the checkpoint backwards (${String(this.lastFinalizedBlock)} -> ${String(block)}). ` +
          'Pass allowRewind after investigating a reorg.',
      );
    }

    await this.db.setLastIndexedBlock(block);
    this.lastFinalizedBlock = block;
    if (block > this.currentBlock) this.currentBlock = block;
    log.debug({ block }, 'Checkpoint finalized');
  }

  /** How many ledgers behind the chain tip the indexer is. */
  getLag(chainTip: number): number {
    return Math.max(0, chainTip - this.currentBlock);
  }
}

/** Build a checkpoint manager backed by the `indexer_state` table. */
export function createCheckpointManager(
  prisma: IndexerStatePrismaClient,
  fallbackBlock = 0,
): CheckpointManager {
  return new CheckpointManager(
    {
      getLastIndexedBlock: async () => {
        const state = await prisma.indexerState.findUnique({
          where: { key: LAST_INDEXED_BLOCK_KEY },
        });
        return state ? Number(state.value) : fallbackBlock;
      },
      setLastIndexedBlock: async (block: number) => {
        await prisma.indexerState.upsert({
          where: { key: LAST_INDEXED_BLOCK_KEY },
          update: { value: String(block) },
          create: { key: LAST_INDEXED_BLOCK_KEY, value: String(block) },
        });
      },
    },
    fallbackBlock,
  );
}
