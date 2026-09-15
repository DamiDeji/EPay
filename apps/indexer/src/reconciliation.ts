import type { PrismaClient } from '@epay/database';

/**
 * Reconciliation between Soroban, the indexer and PostgreSQL.
 *
 * The indexer records every decoded event before the checkpoint moves, so the
 * invariant an operator can check at any moment is:
 *
 * > every ledger below `indexer_state.last_indexed_block` has had all of its
 * > events recorded, and every recorded event has `appliedAt` set.
 *
 * Anything else is a gap to replay.
 */

export interface ReconciliationReport {
  /** Ledger the indexer claims to have finished. */
  lastIndexedBlock: number;
  /** Events written but not yet marked applied. */
  unappliedEvents: number;
  /** Distinct ledgers holding unapplied events. */
  unappliedLedgers: number;
  /** Lowest ledger with unapplied work, if any. */
  oldestUnappliedLedger: number | null;
  /** Total events recorded, for a sanity check against the chain. */
  totalEvents: number;
}

/** Read the durable checkpoint without constructing a full manager. */
export async function readCheckpoint(prisma: PrismaClient): Promise<number> {
  const state = await prisma.indexerState.findUnique({
    where: { key: 'last_indexed_block' },
  });
  const value = state ? Number(state.value) : 0;
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/**
 * Report the indexer's outstanding work.
 *
 * A non-zero `unappliedEvents` after a clean run means a batch crashed between
 * writing events and checkpointing, which the next run replays.
 */
export async function reconcile(prisma: PrismaClient): Promise<ReconciliationReport> {
  const [lastIndexedBlock, totalEvents, unapplied] = await Promise.all([
    readCheckpoint(prisma),
    prisma.indexerEvent.count(),
    prisma.indexerEvent.findMany({
      where: { appliedAt: null },
      select: { ledgerSequence: true },
    }),
  ]);

  const ledgers = new Set(unapplied.map((row) => row.ledgerSequence));

  return {
    lastIndexedBlock,
    unappliedEvents: unapplied.length,
    unappliedLedgers: ledgers.size,
    oldestUnappliedLedger: ledgers.size > 0 ? Math.min(...ledgers) : null,
    totalEvents,
  };
}
