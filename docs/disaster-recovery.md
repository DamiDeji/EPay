# Disaster Recovery

How EPay recovers from data loss, and what we promise about how long that takes.

## Recovery objectives

| Objective                         | Target       | How it is achieved                                                       |
| --------------------------------- | ------------ | ------------------------------------------------------------------------ |
| **RPO** (max data loss)           | **24 hours** | Nightly `pg_dump` at 02:17 UTC (`.github/workflows/backup.yml`)          |
| **RTO** (time to restore service) | **4 hours**  | Restore from the latest archive into a fresh Postgres, then roll the API |
| **Backup retention**              | **30 days**  | `BACKUP_RETENTION_DAYS=30`, pruned by `scripts/backup-postgres.sh`       |
| **Drill cadence**                 | **Monthly**  | `.github/workflows/restore-drill.yml` runs on the 1st at 06:00 UTC       |

### Why RPO is 24 hours and not zero

On-chain state is the source of truth for payments. Funds, payment records, and
settlement state live on Stellar, so the database is a _read-model_ that the
indexer can rebuild from the chain. What is genuinely irreplaceable in Postgres
is off-chain metadata: users, merchant profiles, API keys, audit logs, and
webhook delivery history.

That distinction sets the target: 24 hours of off-chain metadata loss is
tolerable, whereas rebuilding a full indexer backfill takes hours. If you need a
tighter RPO, enable PostgreSQL WAL archiving (PITR) — the backup scripts do not
change, only the restore step does.

## What is backed up

| Asset                      | Mechanism                                | Frequency           | Retention       |
| -------------------------- | ---------------------------------------- | ------------------- | --------------- |
| PostgreSQL (all 23 models) | `pg_dump --format=custom` + SHA-256      | Nightly             | 30 days         |
| Soroban contracts          | Git (WASM rebuildable)                   | Every commit        | —               |
| Kubernetes manifests       | Git (`k8s/`, `helm/epay/`)               | Every commit        | —               |
| Secrets                    | External secret manager / Sealed Secrets | Managed outside Git | Provider policy |
| On-chain state             | Stellar ledger itself                    | Continuous          | Permanent       |

Deliberately **not** backed up: container images (rebuildable from Git), the
Redis queue (transient by design — it holds jobs, not state), and any secret
material (see the compromise runbook below). The indexer needs no backup of its
own: its checkpoint and its event log both live in Postgres, so it resumes from
the last committed batch.

## Failure modes and responses

### 1. Database corruption or accidental destructive query

**Detect:** API readiness fails (`/health/ready`), `EpayDbPoolWaitHigh`, or a
data-integrity alert.
**Respond:** follow [`restore-runbook.md`](./restore-runbook.md). Expected
recovery: under 4 hours for a 100 GB database.

### 2. Full region / cluster loss

**Detect:** all targets down, `up == 0` across every job.
**Respond:**

1. Restore Postgres into a new cluster from the most recent archive.
2. Apply `k8s/manifests.yaml` (or sync the Argo CD Application) into the new
   cluster.
3. Redeploy the contracts if the Stellar network is also affected — the WASM
   hashes in `DEPLOYMENTS.md` let you verify the redeployed contracts match the
   audited builds.
4. Replay the indexer from the last checkpoint; it will converge on the current
   ledger.

**Note:** losing the cluster does not lose funds. Contracts hold state on Stellar,
not in Kubernetes.

### 3. Backup pipeline silently broken

**Detect:** `EpayBackupMissed` alert — `epay_backup_last_success_timestamp_seconds`
has not advanced in 36 hours.
**Respond:** check the `Database Backup` workflow run, verify the OIDC role and
bucket permissions (`s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket`), then
re-run the workflow with `workflow_dispatch`.

### 4. Backup that cannot be restored

**Detect:** `EpayRestoreDrillFailed` — the monthly drill sets
`epay_restore_drill_last_status` to 0.
**Respond:** treat the entire backup chain as unverified. Investigate the drill
log artifact first; if the archive is genuinely corrupt, that is a **critical**
incident — every day since the last good archive is a day of unrecoverable
exposure.

### 5. Compromised secret

**Detect:** anomalous key usage, a leaked credential in Git history, or a
provider notification.
**Respond:** see the dedicated runbook below. Rotation, not restoration, is the
recovery action — a backup does not undo a leaked key.

## Secret-compromise runbook

Secrets are never restored from backup: the archive may predate the leak, and
restoring it would reinstate a compromised credential.

| Secret                  | Rotation                                   | Blast radius if leaked                           | Notes                                           |
| ----------------------- | ------------------------------------------ | ------------------------------------------------ | ----------------------------------------------- |
| `JWT_SECRET`            | Regenerate, roll API pods                  | All sessions invalidated — users re-authenticate | Rotation is a forced global logout; announce it |
| `WEBHOOK_SECRET`        | Regenerate, notify merchants               | Forged webhooks to merchant endpoints            | Coordinate per-merchant                         |
| `METRICS_TOKEN`         | Regenerate, update Prometheus              | Metrics exposure only                            | Low severity, still rotate                      |
| `ANTHROPIC_API_KEY`     | Revoke in console, set new key             | Billing abuse; no data access                    | Check spend anomalies                           |
| `DATABASE_URL` password | `ALTER ROLE epay WITH PASSWORD`, roll pods | Full data read/write                             | Assume data exfiltration; review audit log      |
| AWS backup credentials  | Rotate the OIDC trust / keys               | Backup bucket read — full data copy              | Verify object access logs                       |

### Procedure

1. **Contain** (≤ 1h): revoke the credential at the source. Rotate in the secret
   manager. Do not push a new value through Git.
2. **Assess** (≤ 24h): pull audit logs and provider access logs. Determine what
   the credential could reach and whether it was used. For `DATABASE_URL`, assume
   read access and check for exfiltration.
3. **Rotate dependents**: roll the affected Deployments so no pod holds the old
   value.
4. **Purge**: if the secret reached Git, rotate regardless of whether the commit
   was force-pushed — assume it was harvested. Confirm Gitleaks is clean.
5. **Disclose**: follow [`../SECURITY.md`](../SECURITY.md) if customer data was
   affected.

An unlimited-lifetime credential that has leaked stays leaked. Rotation is the
only remediation.

## Rehearsal

| Cadence   | What                                                        | Evidence                                                            |
| --------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| Nightly   | Backup runs and verifies archive readability                | `Database Backup` workflow, `epay_backup_*` metrics                 |
| Monthly   | Full restore into ephemeral Postgres + integrity assertions | `Restore Drill` workflow artifact, `epay_restore_drill_last_status` |
| Quarterly | Tabletop: region loss, secret compromise                    | Incident review notes                                               |

The monthly drill is automated precisely so it is not skipped. A manual
restore can be rehearsed any time with `scripts/restore-drill.sh` pointed at a
throwaway database.

## Verification

```bash
# Prove the latest backup restores, without touching production.
BACKUP_BUCKET=s3://epay-backups/postgres \
RESTORE_DATABASE_URL=postgresql://epay:epay@localhost:5432/epay_restore \
  ./scripts/restore-drill.sh
```
