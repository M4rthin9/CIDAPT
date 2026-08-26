# CIDA Craft — ร้านค้าออนไลน์ ฝ่ายฝึกวิชาชีพผู้ต้องขัง

E-commerce + CMS for **ทัณฑสถานบำบัดพิเศษกลาง / ส่วนพัฒนาผู้ต้องขัง / ฝ่ายฝึกวิชาชีพผู้ต้องขัง**.
Sells handicraft produced by inmate vocational workshops (กองงาน). Public storefront in the
visual grammar of apple.com; full admin dashboard for products, orders, content, banners,
news, events.

Repo: `cida-craft` · **Bilingual th-TH / en-US, Thai primary** · Operating entity is a unit of
**กรมราชทัณฑ์ (Department of Corrections)** and is **VAT-registered** ·
**Self-hosted: Docker Compose locally, the same compose file on a VPS.**

---

## Read this first

This file is always loaded. Detailed rules live in **skills**, loaded on demand through the
`skill` tool. Load the matching skill before writing code in that area — do not guess.

| Working on…                                    | `skill({ name })` |
| ---------------------------------------------- | ----------------- |
| Build order, phase scope, acceptance criteria  | `build-plan`      |
| Docker, compose, deploy, backups, TLS          | `ops`             |
| DB schema, migrations, Drizzle/Postgres        | `data-model`      |
| Hono routes, validation, errors, auth, RBAC    | `api`             |
| PromptPay QR, slips, reconciliation            | `payments`        |
| VAT, ใบกำกับภาษี, PDF, numbering, refunds      | `tax-and-finance` |
| Background jobs, queues, schedules             | `jobs`            |
| Storefront design system, tokens, motion, i18n | `design-system`   |
| Admin SPA patterns, tables, bilingual forms    | `admin`           |

**Load `build-plan` at the start of every session** and state which phase you are in before
touching code. `PLAN.md` at the repo root is the human-readable master copy; the skill is the
index into it.

Skills live in `.opencode/skills/<name>/SKILL.md`. Each needs YAML frontmatter with `name`
(matching its directory) and `description`.

---

## Agent setup

- **Primary agents** — use `plan` for phase planning and design passes, `build` for
  implementation. Tab switches between them.
- **Subagents** — `@payments-review` before merging Phase 5 or 6, `@schema-review` on any
  migration, `@bilingual-review` on any publishable content or UI component. All three are
  read-only by configuration.
- **`@explore`** for finding things in the codebase; **`@scout`** for reading upstream
  library source. Prefer these over guessing at an API surface.
- Permissions in `opencode.json` are guardrails, not suggestions. If a command is denied,
  do not route around it with a different shell invocation — say why you wanted it and stop.

---

## Stack

Everything runs in containers. **Dev on Docker Desktop and prod on the VPS run the same
`compose.yml`**, differing only by an overlay file. If it only works outside Docker, it is broken.

- **Runtime** — Node 22 LTS
- **API** — Hono on `@hono/node-server`
- **DB** — **PostgreSQL 16** + Drizzle ORM + `drizzle-kit` migrations
- **Storefront** — SvelteKit 2 / Svelte 5, SSR via `@sveltejs/adapter-node`
- **Admin** — Svelte 5 SPA (Vite), static build served by Caddy
- **Object storage** — **MinIO** (S3-compatible) behind a `StorageDriver` interface
- **Cache / rate limit / queue backend** — **Valkey**
- **Background jobs & schedules** — **BullMQ** in a dedicated `worker` container
- **HTML → PDF** — **Gotenberg** with Thai fonts baked into a custom image
- **Reverse proxy + TLS** — **Caddy**
- **Images** — `sharp` at upload time, generating a fixed width ladder
- **Notify** — LINE Messaging API; email via SMTP (Mailpit in dev)
- **Types** — TypeScript strict, Zod, shared `@cida/contracts`

```
apps/
  api/        Hono HTTP server — REST under /api/v1
  worker/     BullMQ consumers + repeatable schedules
  web/        SvelteKit storefront (SSR, /th and /en)
  admin/      Svelte 5 SPA dashboard (static)
packages/
  db/         Drizzle schema + migrations + seed
  contracts/  Zod schemas + inferred types (single source of truth)
  money/      satang, VAT, rounding, allocation — pure, heavily tested
  promptpay/  EMVCo tag-29 + tag-30 builders, CRC16, parsers
  storage/    StorageDriver interface + S3/MinIO implementation
  ui/         shared primitives (minimal — do not over-abstract)
  config/     tsconfig, eslint, prettier presets
infra/
  compose.yml            base — used by dev and prod
  compose.dev.yml        bind mounts, hot reload, Mailpit, pgweb, bull-board
  compose.prod.yml       image tags, restart policies, resource limits, backups
  Caddyfile
  gotenberg/Dockerfile   Gotenberg + TH Sarabun New + Anuphan
  backup/                pg_dump + restic scripts
  .env.example
.opencode/
  skills/<name>/SKILL.md
  agents/*.md
  prompts/*.md
```

### Containers

| Service     | Image                    | Exposed          | Notes                                               |
| ----------- | ------------------------ | ---------------- | --------------------------------------------------- |
| `caddy`     | `caddy:2`                | **80, 443 only** | TLS, serves `admin` static, proxies `web` and `api` |
| `web`       | built                    | internal         | SvelteKit node server                               |
| `api`       | built                    | internal         | Hono                                                |
| `worker`    | built                    | internal         | BullMQ; no HTTP port                                |
| `postgres`  | `postgres:16-alpine`     | internal         | **never** published to the host in prod             |
| `valkey`    | `valkey/valkey:8-alpine` | internal         | password-protected                                  |
| `minio`     | `minio/minio`            | internal         | console proxied in dev only                         |
| `gotenberg` | built                    | internal         | stateless PDF rendering                             |
| `backup`    | built                    | —                | cron: `pg_dump` + MinIO mirror + restic offsite     |

`caddy` is the only service with published ports. In prod, no database port reaches the
internet — administer via an SSH tunnel.

---

## Non-negotiables

Violating any of these is a bug, not a style choice.

1. **Money is `bigint` satang.** Never float, never `numeric`, never a decimal column.
   `฿1,250.00` → `125000`. Format only at the render edge via `formatTHB()`.
2. **Timestamps are `bigint` Unix seconds, UTC.** Column name always `*_at`. Every container
   runs `TZ=UTC`; Postgres initialised `UTC`. Render `Asia/Bangkok` at the edge only.
   No `timestamptz`, no ISO strings in the DB, no `Date` in row types.
3. **Payments are idempotent.** `UNIQUE` on `payments.trans_ref` and on
   `(rail, external_ref)`. A duplicate insert returns the existing row — not an error.
4. **A slip image or its mini-QR is NEVER proof of payment.** The mini-QR CRC is
   error-detection only and is trivially forgeable. Settlement comes _only_ from a provider
   lookup keyed on `trans_ref`, or a matched bank statement line. Slips may be _attached_ for
   audit; they may not _settle_ an order.
5. **Displayed prices are VAT-inclusive.** VAT is derived, never added at checkout.
6. **Invoice numbers are gapless and immutable.** Use a locked counter row, **not a Postgres
   `SEQUENCE`** — sequences leave gaps on rollback and สรรพากร does not accept gaps.
   Corrections go through ใบลดหนี้ / ใบเพิ่มหนี้, never by editing or deleting.
7. **The system never moves money out.** Refunds are recorded and approved here; the actual
   disbursement is executed offline by กรมราชทัณฑ์ finance. No refund API calls, ever.
8. **Zero code edits per deployment.** Anything an operator might change lives in the typed
   **Settings Registry**, editable from the dashboard.
9. **Every mutating admin action writes an `audit_log` row.** Assume an auditor from สตง.
   will read it.
10. **Stock changes only via the inventory ledger.** Never `UPDATE stock_on_hand` directly.
11. **PDPA.** Collect the minimum. Consent recorded with timestamp + version. **No inmate
    personal data anywhere in the system.** Products are attributed to a **กองงาน**, never to a
    named individual, not even in internal fields.
12. **Both languages or it doesn't publish.** Thai and English both required on any published
    product, page, news item, or event.
13. **No host dependencies.** No `apt install` on the VPS beyond Docker. No files outside a
    named volume. A wiped VPS plus the repo plus `.env` plus the latest backup must fully
    reconstitute the system.

---

## Domain vocabulary

| Thai                 | Code term     | Notes                                             |
| -------------------- | ------------- | ------------------------------------------------- |
| กองงาน               | `division`    | Top level of the catalog                          |
| กองงานไฟเบอร์กลาส    | `fiberglass`  | ผลิตภัณฑ์ไฟเบอร์กลาส / ไม้ / เรซิ่น               |
| กองงานเย็บปักถักร้อย | `needlework`  | เสื้อเย็บปักลาย                                   |
| กองงานดอกไม้ประดิษฐ์ | `florals`     | พวงมาลา / พวงหรีด — **enquiry only**              |
| หมวดหมู่             | `category`    | Under a division                                  |
| เลขที่คำสั่งซื้อ     | `order_no`    | `CIDA-YYMM-NNNNN`, also the bill-payment Ref1     |
| ใบกำกับภาษี          | `tax_invoice` | Sequential, gapless, immutable                    |
| ใบลดหนี้             | `credit_note` | The only way to correct an issued invoice         |
| สลิป                 | `slip`        | Attachment only, never settlement                 |
| ผู้ต้องขัง           | —             | **Never** appears as data. Facility context only. |

Catalog seed:

```
fiberglass  ไฟเบอร์กลาส   → fiberglass-products, wood-products, resin-products    [cart]
needlework  เย็บปักถักร้อย  → embroidered-shirts                                    [cart]
florals     ดอกไม้ประดิษฐ์  → memorial-wreaths (พวงมาลา), funeral-wreaths (พวงหรีด)  [enquiry]
```

### Purchase modes

Every product carries `purchase_mode`:

- **`cart`** — normal add-to-cart → checkout → online payment.
- **`enquiry`** — no cart, no self-serve checkout. The PDP shows
  **"ติดต่อเจ้าหน้าที่เพื่อสั่งซื้อ"** with an enquiry form (ribbon text, delivery date/time, venue,
  contact) plus phone and LINE. Submitting creates a `product_enquiries` row and notifies
  staff. An officer then builds a **manual order** and sends a payment link carrying that
  order's own Ref1. The cart **API** rejects enquiry products — hiding the button is not enough.

พวงหรีด and พวงมาลา are funeral products. Their PDP, enquiry form, and every message must be
plain and respectful — no exclamation marks, no "ขอบคุณที่ช้อป", no promotional badges, no
parallax, no confetti, no "สินค้าขายดี" ribbons.

---

## Payments — three rails

Load the `payments` skill before touching any of this.

| Rail                       | Code                | EMVCo      | Reconciled by                          | Preference  |
| -------------------------- | ------------------- | ---------- | -------------------------------------- | ----------- |
| PromptPay Bill Payment     | `promptpay_billpay` | tag **30** | `Ref1 = order_no` on the statement     | **Primary** |
| PromptPay eWallet transfer | `promptpay_ewallet` | tag **29** | `trans_ref` provider lookup            | Secondary   |
| Bank transfer              | `bank_transfer`     | —          | `trans_ref` lookup, else manual verify | Fallback    |

Bill Payment is the default whenever a biller comp code is configured, because the order number
rides in Ref1 and matching is deterministic with no customer input. All three converge on one
`payments` table and one state machine; adding a rail must not touch order logic.

**Postgres note:** `trans_ref` is nullable (a bill-payment order has none until settlement) and
`UNIQUE`. Postgres treats NULLs as distinct, so many pending rows coexist — that is intended.
Add `CHECK (status <> 'verified' OR trans_ref IS NOT NULL)`.

---

## Roles

Enforced server-side on every route. Hiding a button is not access control.

| Role         | Thai label        | Can                                                                                                                           |
| ------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `superadmin` | ผู้ดูแลระบบสูงสุด | Everything: settings, admin users, manual payment override, credit notes, audit log, data export                              |
| `admin`      | ผู้ดูแลระบบ       | Catalog, content, orders, shipping, coupons, reports, enquiries, verify payments. **Not** settings, users, or manual override |
| `officer`    | เจ้าหน้าที่       | Orders, inventory, enquiries, packing and shipping, contact messages. Read-only catalog and reports                           |

Manual payment verification is **`superadmin` only**, requires a typed reason, and is flagged
red in the audit log.

---

## Conventions

**Naming** — DB `snake_case`; TS `camelCase`; files `kebab-case`; Svelte components
`PascalCase.svelte`; route params `[slug]`.

**Bilingual content** — parallel columns `name_th` / `name_en`, `body_th` / `body_en`.
Both required to publish. JSON only for UI string catalogues.

**URLs** — `/th/...` and `/en/...` both fully routed. `/` redirects by `Accept-Language` with a
cookie override. Slugs per language, ASCII, immutable after publish — a change means a
`redirects` row. `hreflang` on every page.

**API shape** — `/api/v1/...`. Success `{ data, meta? }`. Error
`{ error: { code, message_th, message_en, details? } }` with a stable machine `code`.
Validate every input with a Zod schema from `@cida/contracts` — never inline.

**Config** — everything from env vars, parsed once at boot through a Zod schema that
**crashes the container on invalid config**. No scattered `process.env` reads.

**Errors** — never leak SQL, stack traces, connection strings, or container names. Log with
`pino` as JSON including a request id; return the request id to the user for support.

**Testing** — Vitest units; integration tests against a **real Postgres in Testcontainers**;
Playwright for checkout and reconciliation paths. `packages/money` and `packages/promptpay`
need property-based tests. Every bug fixed gets a regression test in the same commit.

**Commits** — Conventional Commits. One phase = one PR.

---

## Docker rules

- **Multi-stage builds.** Runtime stage `node:22-alpine`, no dev dependencies, no build toolchain.
- **Non-root.** Every service runs as a dedicated uid.
- **Healthchecks on every service.** `api` and `web` expose `/healthz` and `/readyz`.
  Compose `depends_on` uses `condition: service_healthy`.
- **Migrations run as a separate one-shot service** that must exit 0 before `api` starts.
  Never run migrations from application boot — two replicas would race.
- **Graceful shutdown.** Handle `SIGTERM`: stop accepting, drain, close the pool.
- **Named volumes only** for state. Bind mounts are dev-only.
- **Pin versions.** No `:latest` anywhere, including base images.
- **Log to stdout** as JSON, with rotation configured in compose.
- Resource limits on every prod service.

---

## Design direction

Load the `design-system` skill for full tokens.

Apple's _structural grammar_: full-bleed hero sections, one idea per screen, generous negative
space, product photography carrying all the colour, sticky translucent nav, scroll-triggered
reveals, huge tight-tracked headlines. Not Apple's identity — this is a craft workshop:

- **Palette** — `--ink #121213`, `--paper #FFFFFF`, `--mist #F1F0ED` (warm, not Apple's cool
  grey), `--slate #6B6B70`, `--line #E2E0DB`, one accent only: `--marigold #D99000`, from the
  ดอกไม้ประดิษฐ์ workshop. Accent is for links and primary CTAs. Nothing else.
- **Type** — Anuphan (Thai) + Inter (Latin) for UI and body; Inter Display at
  `letter-spacing: -0.025em` for headlines; **IBM Plex Mono** for SKUs, lot codes, order
  numbers, Ref1/Ref2, invoice numbers, and prices in tables.
- **Official documents are different.** ใบกำกับภาษี, ใบลดหนี้, and packing slips use
  **TH Sarabun New**, the Thai government standard document face — not Anuphan. The font must
  be installed in the Gotenberg image or the PDF renders as tofu.
- **Thai typography** — `line-height: 1.75` minimum for Thai body so วรรณยุกต์ and สระบน/ล่าง
  don't collide. Never below 15px. Never `text-transform: uppercase` on Thai.
- **Bilingual layout discipline** — English runs ~15–25% longer than Thai in nav and buttons.
  Test every component at 360px in **both** languages before calling it done.
- **Signature element** — the _workshop plate_: a mono-set stamped block on every PDP giving
  กองงาน, lot code, material, hand-finish note. The one bold thing; keep the rest quiet.
- **Motion** — one orchestrated scroll reveal per section, `cubic-bezier(.22,.61,.36,1)`,
  ≤400ms. Respect `prefers-reduced-motion`. No motion on florals PDPs.

**Quality floor, always:** responsive to 360px, visible keyboard focus, real `<button>`/`<a>`
semantics, `aria-live` on cart and form errors, contrast ≥ 4.5:1, LCP image preloaded, no
layout shift on font swap.

---

## Working agreements

- Load `build-plan` and the relevant skill before coding. State which phase you're in.
- Prefer editing an existing file over creating one. No new abstraction until the third repeat.
- No dependency without a justification in the PR.
- **Never commit `.env` or any secret.** `.env.example` documents every key.
- Migrations are forward-only. Never edit a migration that has run anywhere but a laptop.
- **When a requirement touches money, tax, or government policy and is ambiguous — stop and
  ask.** Do not invent a VAT rule, an invoice format, or a refund term.
