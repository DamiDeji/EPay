#!/usr/bin/env bash
#
# Nightly logical backup of the EPay PostgreSQL database.
#
#   DATABASE_URL=postgresql://... \
#   BACKUP_STORAGE=s3 \
#   BACKUP_BUCKET=s3://epay-backups/postgres \
#   ./scripts/backup-postgres.sh
#
# Produces `epay-<UTC timestamp>.dump` in PostgreSQL's custom format (restorable
# selectively with pg_restore), plus a SHA-256 sidecar. Fails loudly — a backup
# that did not verify is worse than no backup, because it creates false
# confidence.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required (e.g. s3://epay-backups/postgres)}"

BACKUP_STORAGE="${BACKUP_STORAGE:-s3}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILENAME="epay-${TIMESTAMP}.dump"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "==> pg_dump → ${FILENAME}"
# --format=custom: compressed, and restorable table-by-table.
# --no-owner/--no-privileges: the restore target may have different roles.
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --dbname="$DATABASE_URL" \
  --file="${WORKDIR}/${FILENAME}"

echo "==> verifying archive is readable"
# A dump that pg_restore cannot list is not a backup.
TABLE_COUNT="$(pg_restore --list "${WORKDIR}/${FILENAME}" | grep -c 'TABLE DATA' || true)"
if [ "$TABLE_COUNT" -eq 0 ]; then
  echo "ERROR: archive contains no table data — refusing to upload" >&2
  exit 1
fi
echo "    archive lists ${TABLE_COUNT} table(s) with data"

echo "==> checksums"
( cd "$WORKDIR" && sha256sum "$FILENAME" > "${FILENAME}.sha256" )

SIZE_BYTES="$(wc -c <"${WORKDIR}/${FILENAME}" | tr -d ' ')"
echo "    ${SIZE_BYTES} bytes"

echo "==> uploading to ${BACKUP_BUCKET}"
case "$BACKUP_STORAGE" in
  s3)
    aws s3 cp "${WORKDIR}/${FILENAME}" "${BACKUP_BUCKET}/${FILENAME}" --no-progress
    aws s3 cp "${WORKDIR}/${FILENAME}.sha256" "${BACKUP_BUCKET}/${FILENAME}.sha256" --no-progress
    echo "==> pruning backups older than ${RETENTION_DAYS} days"
    CUTOFF="$(date -u -d "-${RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
      || date -u -v-"${RETENTION_DAYS}"d +%Y-%m-%dT%H:%M:%SZ)"
    # Best-effort prune; a failure here must not fail the backup itself.
    set +e
    OLD_KEYS="$(aws s3api list-objects-v2 \
      --bucket "$(echo "$BACKUP_BUCKET" | sed -E 's#^s3://([^/]+).*#\1#')" \
      --prefix "$(echo "$BACKUP_BUCKET" | sed -E 's#^s3://[^/]+/?##')epay-" \
      --query "Contents[?LastModified<='${CUTOFF}'].Key" \
      --output text)"
    for key in $OLD_KEYS; do
      aws s3api delete-object --bucket "$(echo "$BACKUP_BUCKET" | sed -E 's#^s3://([^/]+).*#\1#')" --key "$key" >/dev/null
      echo "    pruned $key"
    done
    set -e
    ;;
  gcs)
    gcloud storage cp "${WORKDIR}/${FILENAME}" "${BACKUP_BUCKET}/${FILENAME}"
    gcloud storage cp "${WORKDIR}/${FILENAME}.sha256" "${BACKUP_BUCKET}/${FILENAME}.sha256"
    ;;
  *)
    echo "ERROR: unsupported BACKUP_STORAGE '${BACKUP_STORAGE}' (expected s3 or gcs)" >&2
    exit 1
    ;;
esac

# Heartbeat for the EpayBackupMissed alert.
if [ -n "${PUSHGATEWAY_URL:-}" ]; then
  echo "==> pushing heartbeat"
  cat <<EOF | curl --fail --silent --show-error --data-binary @- "${PUSHGATEWAY_URL}/metrics/job/epay-backup"
# TYPE epay_backup_last_success_timestamp_seconds gauge
epay_backup_last_success_timestamp_seconds $(date -u +%s)
# TYPE epay_backup_size_bytes gauge
epay_backup_size_bytes ${SIZE_BYTES}
# TYPE epay_backup_tables_total gauge
epay_backup_tables_total ${TABLE_COUNT}
EOF
fi

echo "==> backup complete: ${FILENAME} (${TABLE_COUNT} tables, ${SIZE_BYTES} bytes)"
