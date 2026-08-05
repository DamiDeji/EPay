import { createChildLogger } from './logger';

const log = createChildLogger('checkpoint');

/**
 * Manages checkpoint tracking so the indexer can recover from the
 * last successfully processed block after a restart.
 *
 * Uses a simple in-memory store backed by the database for persistence.
 */
export class CheckpointManager {
  private currentBlock: number;
  private lastFinalizedBlock: number;
  private db: { getLastIndexedBlock: () => Promise<number>; setLastIndexedBlock: (block: number) => Promise<void> };

  constructor(
    db: {
      getLastIndexedBlock: () => Promise<number>;
      setLastIndexedBlock: (block: number) => Promise<void>;
    },
    fallbackBlock = 0,
  ) {
    this.currentBlock = fallbackBlock;
    this.lastFinalizedBlock = fallbackBlock;
    this.db = db;
  }

  /**
   * Load the last processed block from the database.
   */
  async load(): Promise<number> {
    const block = await this.db.getLastIndexedBlock();
    this.currentBlock = block;
    this.lastFinalizedBlock = block;
    log.info({ block }, 'Checkpoint loaded');
    return block;
  }

  /**
   * Get the current block height the indexer is at.
   */
  getCurrentBlock(): number {
    return this.currentBlock;
  }

  /**
   * Get the last finalized/saved block.
   */
  getLastFinalizedBlock(): number {
    return this.lastFinalizedBlock;
  }

  /**
   * Update the in-memory current block (called while scanning).
   */
  advance(block: number): void {
    this.currentBlock = block;
  }

  /**
   * Persist the last finalized block to the database.
   */
  async finalize(block: number): Promise<void> {
    await this.db.setLastIndexedBlock(block);
    this.lastFinalizedBlock = block;
    log.debug({ block }, 'Checkpoint finalized');
  }

  /**
   * Get how many blocks behind we are from the latest known chain tip.
   */
  getLag(chainTip: number): number {
    return Math.max(0, chainTip - this.currentBlock);
  }
}

/**
 * Database-backed checkpoint persistence using Prisma.
 */
export async function createCheckpointManager(
  prisma: any,
  fallbackBlock = 0,
): Promise<CheckpointManager> {
  return new CheckpointManager(
    {
      getLastIndexedBlock: async () => {
        const state = await prisma.indexerState.findUnique({
          where: { key: 'last_indexed_block' },
        });
        return state ? Number(state.value) : fallbackBlock;
      },
      setLastIndexedBlock: async (block: number) => {
        await prisma.indexerState.upsert({
          where: { key: 'last_indexed_block' },
          update: { value: String(block) },
          create: { key: 'last_indexed_block', value: String(block) },
        });
      },
    },
    fallbackBlock,
  );
}
