#!/bin/sh
# CIDA Craft backup: pg_dump + MinIO mirror + restic offsite.
# Runs on a schedule from crond. Every step is idempotent and fails loudly,
# logging JSON-ish lines to stdout (captured by docker logging).
set -eu

log() {
  echo "{\"level\":\"${2:-info}\",\"msg\":\"${1}\"}"
}

TS=$(date -u +%Y%m%dT%H%M%SZ)

# /backups is a named volume: on a restored host it may be mounted empty, so
# the layout the image ships must be re-asserted before pg_dump writes to it.
mkdir -p /backups/db /backups/media

# --- 1. Database dump (pg_dump) -----------------------------------------------
log "backup_db_start"
if ! PGPASSWORD="$PGPASSWORD" pg_dump \
    -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" \
    --format=custom --no-owner --no-acl \
    -f "/backups/db/cida-${TS}.dump"; then
  log "backup_db_failed" error
  exit 1
fi
# Keep N most recent local dumps; prune the rest. Busybox find has no -printf,
# so ordering comes from `ls -1t` (newest first) - dump names are timestamped
# and contain no whitespace, so this is safe here.
ls -1t /backups/db/cida-*.dump 2>/dev/null |
  tail -n +$((${KEEP_LOCAL:-7} + 1)) | xargs -r rm -f
log "backup_db_done"

# --- 2. MinIO mirror (media objects) ------------------------------------------
log "backup_mirror_start"
if [ -n "${MINIO_ENDPOINT:-}" ]; then
  if ! mc alias set minio "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null 2>&1; then
    log "backup_mirror_alias_failed" error
    exit 1
  fi
  if ! mc mirror --overwrite --remove "minio/${MINIO_BUCKET}" /backups/media; then
    log "backup_mirror_failed" error
    exit 1
  fi
fi
log "backup_mirror_done"

# --- 3. restic offsite ---------------------------------------------------------
log "backup_restic_start"
if [ -n "${RESTIC_REPOSITORY:-}" ]; then
  export RESTIC_PASSWORD
  if ! restic -r "$RESTIC_REPOSITORY" backup /backups \
      --tag "host=$(hostname)" --tag "ts=${TS}"; then
    log "backup_restic_failed" error
    exit 1
  fi
  # Retention: keep daily for 7, weekly for 4, monthly for 6.
  restic -r "$RESTIC_REPOSITORY" forget \
    --keep-daily "${RESTIC_KEEP_DAILY:-7}" \
    --keep-weekly "${RESTIC_KEEP_WEEKLY:-4}" \
    --keep-monthly "${RESTIC_KEEP_MONTHLY:-6}" \
    --prune
  log "backup_restic_done"
else
  log "backup_restic_skipped"
fi

log "backup_complete"
