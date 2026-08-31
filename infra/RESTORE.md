# CIDA Craft — Restore Drill (wiped-VPS reconstitution)

Rehearsal for the P10 acceptance criterion: a wiped VPS + the repo + `.env` + the latest
backup must fully reconstitute the system, with **no host dependencies beyond Docker**.

## What the backup contains

The `backup` service (`infra/backup/`) runs nightly from crond (02:17 UTC, see `crontab`) and
writes three layers:

| Layer   | Location                                           | Artefact                                                              | Restores         |
| ------- | -------------------------------------------------- | --------------------------------------------------------------------- | ---------------- |
| DB dump | `backup_data` volume, `/backups/db/cida-<TS>.dump` | `pg_dump --format=custom` (compressed, `--no-owner --no-acl`)         | Postgres         |
| Media   | `backup_data` volume, `/backups/media`             | `mc mirror` of the MinIO bucket (S3 objects)                          | MinIO            |
| Offsite | configured `RESTIC_REPOSITORY`                     | restic snapshot of `/backups` (retained daily×7, weekly×4, monthly×6) | all of the above |

Backups are idempotent and fail loudly (JSON log lines). The local `backup_data` volume keeps
`KEEP_LOCAL` dumps pruned; the offsite restic repo is the durable source of truth for a
wiped-VPS restore.

## Prerequisites to restore

1. The **repo** (a clean clone is sufficient — same compose files run on the VPS).
2. The **`.env`** with all production values (never in the repo). Without it, compose refuses
   to boot (`${KEY:?set in .env}`) — that is by design.
3. Access to the **offsite restic snapshot** (the `RESTIC_REPOSITORY` its `RESTIC_PASSWORD`),
   and the MinIO credentials needed to re-apply the media mirror.

## Procedure

### 1. Provision a fresh VPS

- Install Docker Engine + Compose v2. **Nothing else** — no `apt install` of postgres/redis/etc.
- No files outside named volumes; only `caddy` publishes ports (`80`/`443`).

### 2. Bring the repo + environment up

```bash
git clone <repo> cida-craft && cd cida-craft
cp .env.example .env   # fill ALL production values; never commit
# SITE_URL=https://<prod-domain> and ACME_EMAIL set for TLS
docker compose -f infra/compose.yml -f infra/compose.prod.yml up -d --build
docker compose -f infra/compose.yml -f infra/compose.prod.yml ps   # caddy/api/web/worker/backup healthy
```

Do **not** run `migrate` yet — the dump will be restored over a fresh-but-schema-matched DB
below. (If the backup predates the current schema, run `migrate` first, then restore over it.)

### 3. Restore the database dump

The dump is `pg_dump --format=custom`. Options A or B both work; A is preferred (pg_restore
replays in the exact dump order):

```bash
# Identify the latest snapshot in the offsite repo (or the local volume, if it survived).
# From any machine with restic + the repo password:
restic -r "$RESTIC_REPOSITORY" snapshots --latest
# Extract /backups/db and /backups/media to a working dir:
restic -r "$RESTIC_REPOSITORY" restore latest --target /tmp/restore

# A) pg_restore into the running container:
docker compose -f infra/compose.yml -f infra/compose.prod.yml cp /tmp/restore/backups/db/cida-<TS>.dump postgres:/tmp/restore.dump
docker compose -f infra/compose.yml -f infra/compose.prod.yml exec postgres \
  pg_restore --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/restore.dump

# B) Or reload the dump the exact way pg_dump captured it:
docker compose -f infra/compose.yml -f infra/compose.prod.yml exec -T postgres \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /tmp/restore/backups/db/cida-<TS>.dump
```

### 4. Restore the media (MinIO) objects

Re-apply the mirrored objects into a freshly-created bucket:

```bash
docker compose -f infra/compose.yml -f infra/compose.prod.yml exec minio sh -c 'mc --version' >/dev/null 2>&1 \
  || docker run --rm --network cida-craft_default -e MINIO_ENDPOINT=http://minio:9000 \
       -e MINIO_ACCESS_KEY -e MINIO_SECRET_KEY \
       minio/mc mirror /tmp/restore/backups/media/ minio/<MINIO_BUCKET>
```

> Prefer a throwaway container with `mc` on the same compose network rather than installing
> anything on the host (no host dependencies). Run `mc mb minio/<MINIO_BUCKET>` first if the
> bucket does not exist.

### 5. Verify the reconstitution

```bash
# Health + readiness (DB, Valkey, MinIO all reachable):
curl -fsS http://localhost/api/v1/healthz
curl -fsS http://localhost/api/v1/readyz

# Spot-check data survived (order/payment/inventory counters must match the pre-wipe state):
#   - latest invoice number (locked counter row) is gapless and continuous
#   - a sample product and its images render on the storefront
#   - one recent order and its payment row are intact
#   - audit_log still present (auditors demand it)

# Then confirm the backup service continues to run on schedule:
docker compose -f infra/compose.yml -f infra/compose.prod.yml logs -f backup
```

## Acceptance checklist (run this every release / at go-live)

- [ ] Fresh Docker-only VPS, no extra host packages.
- [ ] Repo + `.env` boot `caddy/api/web/worker/backup` all healthy.
- [ ] `pg_restore` of the latest dump succeeds with identical row counts.
- [ ] MinIO mirror re-applied; a known image URL resolves.
- [ ] `/readyz` reports DB + Valkey + MinIO healthy through a cold boot.
- [ ] Gapless invoice counter and a sample order/payment verified end-to-end.
- [ ] Nightly backup cron still fires and writes a fresh snapshot + offsite snapshot.

> Rehearse this drill from a wiped VPS at least once before go-live and after any migration
> that changes schema, so the "dump → restore over fresh schema" path is proven.
