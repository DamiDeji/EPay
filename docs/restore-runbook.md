# Restore Runbook

Step-by-step procedure for restoring EPay's PostgreSQL database from backup.
Target: **recovery within 4 hours** (see [`disaster-recovery.md`](./disaster-recovery.md)).

Read the whole runbook before starting. Decide up front whether you are doing a
**full restore** (new database) or a **partial restore** (specific tables).

---

## 0. Declare the incident

1. Open an incident channel and name an incident commander.
2. Announce a maintenance window if the API will be degraded.
3. **Freeze writes** — stop the API and indexer so nothing mutates the target
   database while you work:

   ```bash
   kubectl -n epay scale deploy/epay-epay-api --replicas=0
   kubectl -n epay scale deploy/epay-epay-indexer --replicas=0
   ```

## 1. Identify the backup to restore

```bash
# S3
aws s3api list-objects-v2 \
  --bucket epay-backups \
  --prefix postgres/epay- \
  --query 'reverse(sort_by(Contents, &LastModified))[:10].[Key,LastModified,Size]' \
  --output table
```

Pick the newest archive whose timestamp predates the incident. If the corruption
is believed to have started earlier, go further back — state the chosen point in
the incident channel.

> **Prefer a partial restore if only some tables are damaged.** `pg_restore`
> supports `--table`, which avoids rolling back unrelated data.

## 2. Download and verify the archive

```bash
WORKDIR="$(mktemp -d)"
aws s3 cp "s3://epay-backups/postgres/<ARCHIVE>.dump" "$WORKDIR/backup.dump"
aws s3 cp "s3://epay-backups/postgres/<ARCHIVE>.dump.sha256" "$WORKDIR/backup.sha256"

cd "$WORKDIR"
sed 's#  .*#  backup.dump#' backup.sha256 | sha256sum --check -
```

**Do not proceed if the checksum fails.** A corrupt archive will produce a
partially restored database that looks fine until it is queried. Try the next
newest archive instead.

## 3. Verify the archive is structurally readable

```bash
pg_restore --list "$WORKDIR/backup.dump" | grep -c 'TABLE DATA'
```

A count of `0` means the archive carries no data — stop and escalate.

## 4. Restore

### 4a. Full restore into a new database (recommended)

```bash
# On the target server.
createdb -O epay epay_restore

pg_restore \
  --dbname="postgresql://epay:<password>@<host>:5432/epay_restore" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "$WORKDIR/backup.dump"

# Bring migrations to head in case the archive predates the current schema.
DATABASE_URL="postgresql://epay:<password>@<host>:5432/epay_restore" \
  pnpm --filter @epay/database exec prisma migrate deploy
```

`--exit-on-error` is not optional: without it `pg_restore` continues past errors
and reports success on a partial restore.

### 4b. Partial restore (specific tables only)

```bash
psql "$TARGET" -c 'CREATE SCHEMA restore_staging;'
pg_restore \
  --dbname="$TARGET" \
  --schema=restore_staging \
  --table=payments \
  --no-owner \
  "$WORKDIR/backup.dump"

# Inspect before promoting, then copy across inside a transaction.
psql "$TARGET" -c 'BEGIN; ... verification ...; COMMIT;'
```

### 4c. Point-in-time recovery (only if WAL archiving is enabled)

Restore the base backup, then replay WAL up to the target timestamp using
`recovery_target_time` in `postgresql.conf` and `pg_ctl promote`.

## 5. Verify integrity — mandatory

```bash
psql "$TARGET" -v ON_ERROR_STOP=1 -f scripts/verify-restore.sql
```

This asserts:

- the database is not empty,
- no payments/invoices/refunds/merchants/milestones have dangling foreign keys,
- required columns (`users.email`, `payments.recipientPublicKey`) are populated,
- `_prisma_migrations` history survived.

Then spot-check business totals:

```sql
SELECT count(*), min("createdAt"), max("createdAt") FROM payments;
SELECT status, count(*) FROM payments GROUP BY status ORDER BY 2 DESC;
```

Compare against the last known-good figures in Grafana (`epay-payment-flow`).

## 6. Cut over

```bash
# Rename the restored database into place.
psql -c 'ALTER DATABASE epay RENAME TO epay_corrupt_<date>;'
psql -c 'ALTER DATABASE epay_restore RENAME TO epay;'

# Resume traffic.
kubectl -n epay scale deploy/epay-epay-api --replicas=3
kubectl -n epay scale deploy/epay-epay-indexer --replicas=1

kubectl -n epay rollout status deploy/epay-epay-api
```

Keep the old database until the incident is closed — it is the only remaining
copy of anything written after the backup.

## 7. Reconcile with the chain

The indexer will resume from its checkpoint. Because Stellar is the source of
truth, any payments that landed between the backup and the outage are recovered
by replay — this is the main reason the 24h RPO is acceptable.

```bash
kubectl -n epay logs -f deploy/epay-epay-indexer
# Watch epay_indexer_ledger_lag return to < 10 in Grafana.
```

Verify payment counts converge:

```sql
SELECT count(*) FROM payments WHERE status = 'COMPLETED';
```

## 8. Close out

- [ ] API `/health/ready` green, error rate back to baseline.
- [ ] `epay_indexer_ledger_lag` back under 10.
- [ ] `scripts/verify-restore.sql` passed on the promoted database.
- [ ] Webhook backlog drained (`epay_queue_waiting_jobs` → 0).
- [ ] Confirm the nightly backup ran successfully after the incident.
- [ ] Post-incident review scheduled; timeline captured in the incident channel.

## Rollback

If verification fails at any point, **do not promote**. Scale the API back down,
rename the restored database aside, and rename the original back:

```bash
psql -c 'ALTER DATABASE epay RENAME TO epay_restore_failed;'
psql -c 'ALTER DATABASE epay_corrupt_<date> RENAME TO epay;'
kubectl -n epay scale deploy/epay-epay-api --replicas=3
```

A failed restore is recoverable; a promoted bad restore is not.

## Escalation

| Situation                                   | Action                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| Checksum fails on all recent archives       | Escalate to critical — treat the backup chain as broken                    |
| `pg_restore` errors on schema objects       | Check the target's PostgreSQL major version matches the source             |
| Restore exceeds 4h                          | Page the platform on-call; consider restoring the previous night's archive |
| Data loss extends beyond the newest archive | Begin indexer rebuild from an earlier ledger checkpoint                    |
