-- Indexer checkpointing and idempotent event replay.
--
-- `apps/indexer` previously called `prisma.indexerState.*`, but no such model
-- existed, so it could never persist a checkpoint: every restart re-scanned from
-- `INDEXER_START_LEDGER` and every crash lost its position. `indexer_state` is
-- the missing table.
--
-- `indexer_events` is the append-only log of decoded events. It is written
-- before the projection, keyed by the Soroban event id, so a retried job or a
-- re-scanned range cannot double-apply a payment, refund or settlement.

CREATE TABLE "indexer_state" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexer_state_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "indexer_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "contractName" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "ledgerSequence" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "applyAttempts" INTEGER NOT NULL DEFAULT 0,
    "applyError" TEXT,

    CONSTRAINT "indexer_events_pkey" PRIMARY KEY ("id")
);

-- One row per on-chain event. This is the idempotency guarantee: replaying a
-- ledger cannot insert the same event twice.
CREATE UNIQUE INDEX "indexer_events_eventId_key" ON "indexer_events"("eventId");

-- Replays walk the range in order, and gap detection scans for the lowest
-- unapplied ledger.
CREATE INDEX "indexer_events_ledgerSequence_idx" ON "indexer_events"("ledgerSequence");

-- Reconciliation starts from a transaction hash from the chain explorer.
CREATE INDEX "indexer_events_txHash_idx" ON "indexer_events"("txHash");

-- Operators filter the log by contract/event when tracing a projection bug.
CREATE INDEX "indexer_events_contractName_eventName_idx" ON "indexer_events"("contractName", "eventName");

-- "What work is still owed" is a partial scan of unapplied rows.
CREATE INDEX "indexer_events_appliedAt_idx" ON "indexer_events"("appliedAt");
