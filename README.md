# CIDA Craft — ร้านค้าออนไลน์ ฝ่ายฝึกวิชาชีพผู้ต้องขัง

E-commerce + CMS for **ทัณฑสถานบำบัดพิเศษกลาง / ส่วนพัฒนาผู้ต้องขัง / ฝ่ายฝึกวิชาชีพผู้ต้องขัง** (Central Correctional Institution for Drug Addicts — Inmate Development / Vocational Training Division).

Handicraft produced by vocational workshops (กองงาน) — sold through a public storefront in Apple's structural grammar plus a full admin dashboard. Operating entity is a unit of **กรมราชทัณฑ์ (Department of Corrections)**, **VAT-registered**. **Self-hosted: the same Docker Compose file runs locally and on the VPS.**

> **Bilingual:** `th-TH` primary, `en-US` secondary. Every publishable entity requires both languages. Routes are `/th/...` and `/en/...` with `hreflang`; `/` redirects by `Accept-Language` with cookie override.

---

## Stack

| Layer         | Tech                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| Runtime       | Node 22 LTS (`node:22-alpine` in containers, `pnpm@11.22.0` workspaces)  |
| API           | Hono on `@hono/node-server` · REST `/api/v1` · Zod via `@cida/contracts` |
| DB            | PostgreSQL 16 + Drizzle ORM + `drizzle-kit` forward-only migrations      |
| Storefront    | SvelteKit 2 / Svelte 5 runes · SSR `adapter-node`                        |
| Admin         | Svelte 5 SPA (Vite) — static, served by Caddy                            |
| Storage       | MinIO (S3-compatible) behind `StorageDriver` · `sharp` width ladder      |
| Cache / Queue | Valkey 8 + BullMQ (`apps/worker`, no HTTP)                               |
| PDF           | Gotenberg custom image with **TH Sarabun New** + Anuphan                 |
| Proxy / TLS   | Caddy 2 (only service with host-published ports)                         |
| Notify        | LINE Messaging API · SMTP (Mailpit in dev)                               |
| Types         | TypeScript strict · Zod · `@cida/contracts` single source of truth       |
| Tests         | Vitest · Testcontainers (real Postgres) · Playwright · `fast-check`      |

---

## Architecture

```
caddy :80/:443 ─┬─ /api/*  → api:3000      (Hono)
                ├─ /admin  → /srv/admin     (static SPA)
                └─ /       → web:3001       (SvelteKit SSR)

postgres ─┐
valkey   ─┼─ internal only (never published in prod; admin via SSH tunnel)
minio    ─┤
gotenberg─┘

worker: BullMQ consumers (reconciliation, notify, backup hooks) — no HTTP port
backup: crond pg_dump + MinIO mirror + restic offsite
```

- `infra/compose.yml` — base used by dev **and** prod (pinned tags/digests, `TZ=UTC`, healthchecks, `json-file` rotation, named volumes only).
- `infra/compose.dev.yml` — bind mounts, hot reload, Mailpit `:9025/:1025`, pgweb `:9081`, MinIO console `:9001` (loopback-only), Gotenberg `:3010`.
- `infra/compose.prod.yml` — image tags, restart policies, resource limits.
- `infra/Caddyfile` — `{$SITE_URL}` (scheme-carrying; `http://localhost` stays plain HTTP, prod domain gets ACME).
- Migrations run as a **one-shot service** that must `exit 0` before `api` starts — never from app boot (replicas would race).
- Every container `TZ=UTC`; Postgres `timezone=UTC`; render `Asia/Bangkok` at the edge only.

## Repo layout

```
apps/
  api/        Hono server
  worker/     BullMQ consumers + repeatable schedules
  web/        SvelteKit storefront (SSR /th /en)
  admin/      Svelte 5 SPA
packages/
  db/         Drizzle schema, migrations, seed
  contracts/  Zod schemas + inferred types
  money/      satang math, VAT, allocation — pure
  promptpay/  EMVCo tag-29/30, CRC16, parsers
  storage/    StorageDriver + S3/MinIO
  ui/         shared primitives (minimal)
  config/     tsconfig / eslint / prettier presets
infra/
  compose.yml / compose.dev.yml / compose.prod.yml
  Caddyfile
  gotenberg/Dockerfile
  backup/     crontab + scripts
.opencode/skills/<name>/SKILL.md
PLAN.md       human-readable build plan (one phase = one PR)
AGENTS.md     non-negotiables + domain rules
```

---

## Prerequisites

- Docker Desktop (or Docker Engine) + Compose v2
- Node 22 LTS (`22.23.x`) and `pnpm` 11.22.0 (`corepack prepare pnpm@11.22.0 --activate`)
  - PowerShell on Windows blocks `pnpm.ps1` — invoke as `pnpm.cmd` (see `AGENTS.md` D1).
- No other host dependencies — no `apt install` beyond Docker, no files outside named volumes.

---

## Quick start (development)

```bash
git clone <repo> cida-craft && cd cida-craft

# 1. Environment — copy template and fill values (never commit .env)
cp .env.example .env
# compose reads .env from the repo root; every required key is documented
# in .env.example with no secret values in the repo.
# Required at minimum: POSTGRES_USER, POSTGRES_PASSWORD, DATABASE_URL,
# VALKEY_PASSWORD, VALKEY_URL, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD,
# S3_ENDPOINT, GOTENBERG_URL, SESSION_SECRET, SITE_URL, etc.
# See "Configuration" below — leave ACME_EMAIL empty in dev.

# 2. Install + checks (outside Docker — fast feedback)
pnpm.cmd install                # or pnpm install on macOS/Linux
pnpm.cmd -r typecheck
pnpm.cmd -r lint
pnpm.cmd -r test                # units; integration via Testcontainers

# 3. Bring up full stack
docker compose -f infra/compose.yml -f infra/compose.dev.yml up -d --build
docker compose -f infra/compose.yml -f infra/compose.dev.yml ps   # all healthy
docker compose -f infra/compose.yml -f infra/compose.dev.yml logs -f

# 4. Migrations + seed (one-shot services)
docker compose -f infra/compose.yml -f infra/compose.dev.yml run --rm migrate
docker compose -f infra/compose.yml -f infra/compose.dev.yml --profile tools run --rm seed

# 5. Open
#  web:        http://localhost          (Caddy → web)
#  api:        http://localhost/api/v1/healthz
#  admin:      http://localhost/admin
#  Mailpit:    http://localhost:9025
#  pgweb:      http://localhost:9081
#  MinIO:      http://localhost:9001
#  Gotenberg:  http://localhost:3010
```

Health endpoints: `GET /healthz` (liveness), `GET /readyz` (readiness, DB/Valkey/MinIO).

Stopping:

```bash
docker compose -f infra/compose.yml -f infra/compose.dev.yml down
# add -v to drop named volumes (destroys DB/media) — only for a clean reset
```

---

## Production

Same base file, prod overlay. Only `caddy` publishes `80`/`443`; `postgres`/`valkey`/`minio`/`gotenberg` publish nothing. Administer DB via SSH tunnel.

```bash
# on the VPS — repo + .env + latest backup are sufficient to reconstitute
cp .env.example .env   # fill production values on the host; never commit
# SITE_URL must be https://<prod-domain> for Caddy ACME; set ACME_EMAIL
docker compose -f infra/compose.yml -f infra/compose.prod.yml up -d --build
docker compose -f infra/compose.yml -f infra/compose.prod.yml ps
docker compose -f infra/compose.yml -f infra/compose.prod.yml run --rm migrate
```

- Multi-stage builds, `node:22-alpine` runtime, non-root uid, pinned digests (no `:latest`), `SIGTERM` drain, resource limits on every prod service.
- Logs: JSON to stdout with rotation (`max-size: 10m`, `max-file: 5`).
- See `PLAN.md` P10 and `infra/backup/` for the restore drill.

---

## Configuration

All config comes from environment variables, parsed **once at boot through a Zod schema that crashes the container on invalid values**. No scattered `process.env` reads.

Documented keys live in `.env.example` (no values committed). Selected keys:

| Key                                           | Purpose                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `SITE_URL`                                    | Caddy site address — `http://localhost` in dev (plain HTTP), `https://…` in prod (ACME) |
| `HTTP_PORT`                                   | Host port Caddy binds (default `80`)                                                    |
| `DATABASE_URL`                                | `postgres://…@postgres:5432/…` (inside compose network)                                 |
| `VALKEY_URL`                                  | `redis://:…@valkey:6379`                                                                |
| `S3_ENDPOINT`, `S3_BUCKET`                    | MinIO endpoint + bucket (`cida-media`)                                                  |
| `GOTENBERG_URL`                               | `http://gotenberg:3000`                                                                 |
| `SMTP_*`, `LINE_*`                            | Mail + LINE Messaging API (Mailpit in dev)                                              |
| `RECONCILIATION_PROVIDER`, `BILLER_COMP_CODE` | Payments — `fake` in dev/test                                                           |
| `SESSION_SECRET`, `ADMIN_BOOTSTRAP_*`         | Admin session + seed superadmin (rotate after first login)                              |

`.gitignore` excludes `.env` and `.env.*` (except `.env.example`). Never commit a real `.env`.

---

## Database & migrations

- Drizzle ORM — schema in `packages/db`. Money columns `bigint` satang; timestamps `bigint` Unix seconds `*_at` (no `timestamptz`, no ISO strings, no `Date` in row types).
- Forward-only migrations via `drizzle-kit` — never edit a migration that has run anywhere beyond a laptop.
- `POSTGRES_INITDB_ARGS=--encoding=UTF8`, `TZ=UTC` everywhere.
- Seed: divisions / categories per `AGENTS.md` (กองงาน ไฟเบอร์กลาส / เย็บปักถักร้อย / ดอกไม้ประดิษฐ์).

---

## Catalog domain

| กองงาน         | Code         | Categories                                            | Mode      |
| -------------- | ------------ | ----------------------------------------------------- | --------- |
| ไฟเบอร์กลาส    | `fiberglass` | fiberglass-products, wood-products, resin-products    | `cart`    |
| เย็บปักถักร้อย | `needlework` | embroidered-shirts                                    | `cart`    |
| ดอกไม้ประดิษฐ์ | `florals`    | memorial-wreaths (พวงมาลา), funeral-wreaths (พวงหรีด) | `enquiry` |

- `cart` — add-to-cart → checkout → online payment.
- `enquiry` — PDP shows **"ติดต่อเจ้าหน้าที่เพื่อสั่งซื้อ"** with form (ribbon text, delivery date/time, venue, contact) + phone/LINE; cart API **rejects** enquiry products server-side. Floral PDPs: plain respectful tone, no exclamation / promo badges / parallax / confetti / motion.

## Payments — three rails

| Rail                   | Code                | EMVCo  | Reconciled by                                                         | Pref      |
| ---------------------- | ------------------- | ------ | --------------------------------------------------------------------- | --------- |
| PromptPay Bill Payment | `promptpay_billpay` | tag 30 | `Ref1 = order_no (CIDA-YYMM-NNNNN)` on statement                      | Primary   |
| PromptPay eWallet      | `promptpay_ewallet` | tag 29 | `trans_ref` provider lookup                                           | Secondary |
| Bank transfer          | `bank_transfer`     | —      | `trans_ref` lookup else manual (superadmin + typed reason, red audit) | Fallback  |

One `payments` table + one state machine. Adding a rail must not touch order logic. Idempotent ingestion: `UNIQUE(trans_ref)` (nullable — many `NULL` pending rows intentionally coexist) + `UNIQUE(rail, external_ref)` + `CHECK(status <> 'verified' OR trans_ref IS NOT NULL)`. **A slip/mini-QR never settles an order** — settlement only via provider lookup (`trans_ref`) or matched statement line (`Ref1`).

## Roles (server-enforced on every route)

| Role         | Thai              | Capabilities                                                                                                              |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `superadmin` | ผู้ดูแลระบบสูงสุด | everything incl. settings, admin users, manual payment override, credit notes, audit log, export                          |
| `admin`      | ผู้ดูแลระบบ       | catalog, content, orders, shipping, coupons, reports, enquiries, verify payments — **not** settings/users/manual override |
| `officer`    | เจ้าหน้าที่       | orders, inventory, enquiries, packing/shipping, contact messages — read-only catalog/reports                              |

UI hiding is not access control.

---

## Non-negotiables (summary — see `AGENTS.md`)

Money `bigint` satang; timestamps `bigint` UTC `*_at`; payments idempotent; slip ≠ proof; prices VAT-inclusive (VAT derived); invoice numbers gapless via locked counter row (not `SEQUENCE`); no outbound money movement — refunds recorded offline; zero code edits per deploy via Settings Registry; every mutating admin action → `audit_log`; stock only via `inventory_ledger`; PDPA minimum + **no inmate personal data** (products attributed to กองงาน only); both languages or no publish; no host dependencies.

---

## Design system

Apple's structural grammar (one idea per screen, full-bleed hero, generous negative space, sticky translucent nav, scroll reveals `cubic-bezier(.22,.61,.36,1)` ≤400 ms, `prefers-reduced-motion` respected — no motion on florals PDPs). Palette `--ink #121213`, `--paper #FFFFFF`, `--mist #F1F0ED`, `--slate #6B6B70`, `--line #E2E0DB`, accent `--marigold #D99000`. Type: Anuphan + Inter (UI), Inter Display `tracking -0.025em` (headlines), **IBM Plex Mono** for SKUs/order/invoice/Ref codes, **TH Sarabun New** for ใบกำกับภาษี/ใบลดหนี้/packing slips (baked into Gotenberg). Thai body `≥15px`, `line-height ≥1.75`, never `uppercase` on Thai. Workshop plate (mono stamped block) is the signature PDP element.

Quality floor: 360 px responsive in both languages, visible focus, real `<button>`/`<a>`, `aria-live` on cart/form errors, contrast ≥4.5:1, LCP preloaded, no layout shift on font swap.

---

## Testing

```bash
pnpm.cmd -r typecheck
pnpm.cmd -r lint          # eslint + prettier --check
pnpm.cmd -r test          # vitest units; packages/money & promptpay include fast-check prop tests
# integration: real Postgres via Testcontainers (P2+)
```

Storefront e2e (Playwright) runs against a live API + seeded database — it asserts the
P8 acceptance criteria (360 px in both languages, a11y floor, Thai typography, the
enquiry-only rule, slug redirects), so an empty catalogue makes it meaningless:

```bash
pnpm.cmd --filter @cida/db migrate
pnpm.cmd --filter @cida/db seed        # divisions, categories and the sample catalogue
pnpm.cmd --filter @cida/api dev        # API on :3000 (leave running)
pnpm.cmd --filter @cida/web test:e2e   # starts the storefront itself

# Override the ports when 5173/3000 are taken:
#   WEB_PORT=5199 E2E_API_URL=http://localhost:3000 pnpm.cmd --filter @cida/web test:e2e
```

Every bug fix ships with a regression test in the same commit.

---

## API conventions

`REST /api/v1/...` · Success `{ data, meta? }` · Error `{ error: { code, message_th, message_en, details? } }` (stable `code`) — validated by `@cida/contracts` Zod, never inline. `pino` JSON logs with request id returned to caller. Never leak SQL / stacks / connection strings / container names.

---

## Backup & restore

`backup` service: `crond` → `pg_dump` + MinIO mirror + `restic` offsite (see `infra/backup/`). A wiped VPS + repo + `.env` + latest backup must fully reconstitute the system (rehearsed per `PLAN.md` P10).

---

## Build plan

`PLAN.md` is the human-readable master plan (P0–P10). One phase = one PR, Conventional Commits, blocking gates: `@schema-review` on any migration, `@payments-review` before P5/P6, `@bilingual-review` on publishable UI/content. Load the matching skill (`skill({ name })`) before coding in that area — see `AGENTS.md` table.

---

## Security notes

- Never commit `.env` — `.env.example` documents keys only.
- `.gitignore` covers `.env`, `node_modules`, `dist/build/.svelte-kit`, coverage, `.DS_Store`.
- `POSTGRES_PASSWORD`, `VALKEY_PASSWORD`, `MINIO_ROOT_PASSWORD`, `SESSION_SECRET`, `LINE_CHANNEL_*`, `SMTP_*`, `BILLER_COMP_CODE` are injected via `.env` and validated at boot — no defaults, no fallbacks, no values in the repo.
- Report credential leaks immediately and rotate the affected secret.

---

_Generated for CIDA Craft. For operator documentation (go-live checklist, restore drill) see `PLAN.md` P10 and `infra/backup/`._
