-- Post-restore verification.
--
-- Run against a freshly restored database:
--   psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/verify-restore.sql
--
-- Any failure raises and aborts the drill. The checks are deliberately about
-- *structural* integrity (orphans, required columns) plus a minimum row count,
-- not about matching a moving production number — a drill must be stable enough
-- to run monthly without a human tuning thresholds.

\set ON_ERROR_STOP on

DO $$
DECLARE
  orphan_count      bigint;
  required_count    bigint;
  total_users       bigint;
  total_merchants   bigint;
  total_payments    bigint;
BEGIN
  -- 1. The restore must not be empty.
  SELECT count(*) INTO total_users FROM users;
  SELECT count(*) INTO total_merchants FROM merchants;
  SELECT count(*) INTO total_payments FROM payments;

  RAISE NOTICE 'restored rows — users=%, merchants=%, payments=%',
    total_users, total_merchants, total_payments;

  IF total_users = 0 AND total_merchants = 0 AND total_payments = 0 THEN
    RAISE EXCEPTION 'restore produced an empty database (no users, merchants, or payments)';
  END IF;

  -- 2. Referential integrity: every payment belongs to a merchant.
  SELECT count(*) INTO orphan_count
  FROM payments p
  LEFT JOIN merchants m ON m.id = p."merchantId"
  WHERE m.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'referential integrity: % payments reference a missing merchant', orphan_count;
  END IF;

  -- 3. Every invoice belongs to a merchant.
  SELECT count(*) INTO orphan_count
  FROM invoices i
  LEFT JOIN merchants m ON m.id = i."merchantId"
  WHERE m.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'referential integrity: % invoices reference a missing merchant', orphan_count;
  END IF;

  -- 4. Every refund points at a real payment.
  SELECT count(*) INTO orphan_count
  FROM refunds r
  LEFT JOIN payments p ON p.id = r."paymentId"
  WHERE p.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'referential integrity: % refunds reference a missing payment', orphan_count;
  END IF;

  -- 5. Every merchant belongs to a real user.
  SELECT count(*) INTO orphan_count
  FROM merchants m
  LEFT JOIN users u ON u.id = m."userId"
  WHERE u.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'referential integrity: % merchants reference a missing user', orphan_count;
  END IF;

  -- 6. Escrow milestones must reach their parent escrow.
  SELECT count(*) INTO orphan_count
  FROM milestones ms
  LEFT JOIN escrows e ON e.id = ms."escrowId"
  WHERE e.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'referential integrity: % milestones reference a missing escrow', orphan_count;
  END IF;

  -- 7. Values that the application cannot function without must be present.
  SELECT count(*) INTO required_count FROM users WHERE email IS NULL OR email = '';
  IF required_count > 0 THEN
    RAISE EXCEPTION 'NOT NULL integrity: % users have an empty email', required_count;
  END IF;

  SELECT count(*) INTO required_count
  FROM payments WHERE "recipientPublicKey" IS NULL OR "recipientPublicKey" = '';
  IF required_count > 0 THEN
    RAISE EXCEPTION 'NOT NULL integrity: % payments have no recipient public key', required_count;
  END IF;

  -- 8. Schema version must be present and readable, otherwise we cannot tell
  --    which migrations the restored data has.
  SELECT count(*) INTO required_count FROM _prisma_migrations WHERE finished_at IS NOT NULL;
  IF required_count = 0 THEN
    RAISE EXCEPTION 'restore lost _prisma_migrations history; migrations cannot be reasoned about';
  END IF;

  RAISE NOTICE 'restore verification passed (applied migrations: %)', required_count;
END
$$;
