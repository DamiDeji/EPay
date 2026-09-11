#!/usr/bin/env bash
#
# Monthly restore drill: prove that the latest backup can actually be restored.
#
#   BACKUP_BUCKET=s3://epay-backups/postgres \
#   RESTORE_DATABASE_URL=postgresql://epay:epay@localhost:5432/epay_restore \
#   ./scripts/restore-drill.sh
#
# A backup that has never been restored is a hypothesis, not a recovery plan.
# This script downloads the newest archive, restores it into an *ephemeral*
# database, runs scripts/verify-restore.sql, and reports the outcome. It never
# touches the production database.
set -euo pipefail

: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required (must NOT be production)}"

BACKUP_STORAGE="${BACKUP_STORAGE:-s3}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

report() {
  local status="$1" message="$2"
  echo "[drill] status=${status} ${message}"
  if [ -n "${PUSHGATEWAY_URL:-}" ]; then
    cat <<EOF | curl --fail --silent --show-error --data-binary @- "${PUSHGATEWAY_URL}/metrics/job/epay-restore-drill" || true
# TYPE epay_restore_drill_last_status gauge
epay_restore_drill_last_status ${status}
# TYPE epay_restore_drill_last_run_timestamp_seconds gauge
epay_restore_drill_last_run_timestamp_seconds $(date -u +%s)
EOF
  fi
}

echo "==> locating the most recent backup in ${BACKUP_BUCKET}"
case "$BACKUP_STORAGE" in
  s3)
    BUCKET="$(echo "$BACKUP_BUCKET" | sed -E 's#^s3://([^/]+).*#\1#')"
    PREFIX="$(echo "$BACKUP_BUCKET" | sed -E 's#^s3://[^/]+/?##')"
    LATEST_KEY="$(aws s3api list-objects-v2 \
      --bucket "$BUCKET" \
      --prefix "${PREFIX}epay-" \
      --query 'reverse(sort_by(Contents, &LastModified))[?ends_with(Key, `.dump`)].Key | [0]' \
      --output text)"
    [ -n "$LATEST_KEY" ] && [ "$LATEST_KEY" != "None" ] || {
      report 0 "no backup archive found in ${BACKUP_BUCKET}"
      exit 1
    }
    echo "    latest: ${LATEST_KEY}"
    aws s3 cp "s3://${BUCKET}/${LATEST_KEY}" "${WORKDIR}/latest.dump" --no-progress
    aws s3 cp "s3://${BUCKET}/${LATEST_KEY}.sha256" "${WORKDIR}/latest.dump.sha256" --no-progress || true
    ;;
  gcs)
    LATEST_URI="$(gcloud storage ls -l "${BACKUP_BUCKET}/epay-*.dump" | sort -k2 | tail -1 | awk '{print $NF}')"
    [ -n "$LATEST_URI" ] || {
      report 0 "no backup archive found in ${BACKUP_BUCKET}"
      exit 1
    }
    echo "    latest: ${LATEST_URI}"
    gcloud storage cp "$LATEST_URI" "${WORKDIR}/latest.dump"
    ;;
  *)
    echo "ERROR: unsupported BACKUP_STORAGE '${BACKUP_STORAGE}'" >&2
    exit 1
    ;;
esac

echo "==> verifying checksum"
if [ -f "${WORKDIR}/latest.dump.sha256" ]; then
  ( cd "$WORKDIR" && mv latest.dump.sha256 latest.dump.sha256.orig \
    && sed 's#  .*#  latest.dump#' latest.dump.sha256.orig > latest.dump.sha256 \
    && sha256sum --check latest.dump.sha256 )
else
  echo "    no checksum sidecar found; skipping (set BACKUP_REQUIRE_CHECKSUM=1 to enforce)"
  [ "${BACKUP_REQUIRE_CHECKSUM:-0}" = "1" ] && { report 0 "checksum sidecar missing"; exit 1; }
fi

echo "==> resetting the throwaway database"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'

echo "==> restoring"
# --exit-on-error: a partial restore must fail the drill, not silently "succeed".
pg_restore \
  --dbname="$RESTORE_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "${WORKDIR}/latest.dump"

echo
echo "==> running integrity assertions"
if psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/verify-restore.sql; then
  report 1 "restore verified successfully from ${LATEST_KEY:-$LATEST_URI}"
  echo "[drill] PASS"
  exit 0
else
  report 0 "integrity assertions failed"
  echo "[drill] FAIL" >&2
  exit 1
fi
