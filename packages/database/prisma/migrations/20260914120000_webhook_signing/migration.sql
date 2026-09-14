-- Webhook signing, retry scheduling, and dead-lettering.
--
-- Adds the columns the delivery dispatcher needs to sign payloads, schedule the
-- 30s/2m/10m/30m/2h/6h backoff, and park a delivery in the dead-letter state once
-- the schedule is exhausted. `maxAttempts` default moves from 5 to 7 to match
-- WEBHOOK_MAX_ATTEMPTS in packages/shared/src/webhook-signature.ts.

ALTER TABLE "webhook_deliveries" ADD COLUMN "eventId" TEXT;
ALTER TABLE "webhook_deliveries" ADD COLUMN "signature" TEXT;
ALTER TABLE "webhook_deliveries" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "webhook_deliveries" ADD COLUMN "deadLetteredAt" TIMESTAMP(3);
ALTER TABLE "webhook_deliveries" ALTER COLUMN "maxAttempts" SET DEFAULT 7;

-- Idempotency: one delivery per (merchant, event). A retry reuses the same row,
-- and a replayed enqueue cannot fan out into duplicate webhooks.
CREATE UNIQUE INDEX "webhook_deliveries_merchantId_eventId_key"
  ON "webhook_deliveries"("merchantId", "eventId");

-- The retry worker scans for due deliveries; without this index that becomes a
-- full table scan on every tick.
CREATE INDEX "webhook_deliveries_nextAttemptAt_idx" ON "webhook_deliveries"("nextAttemptAt");

-- Operators need to find dead-lettered deliveries quickly.
CREATE INDEX "webhook_deliveries_deadLetteredAt_idx" ON "webhook_deliveries"("deadLetteredAt");
