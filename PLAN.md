# CIDA Craft — Build Plan

Human-readable master copy of the build plan. The `build-plan` skill is an index into this file.
Rules and non-negotiables live in `AGENTS.md` and are **not** duplicated here — they apply to
every phase by reference.

---

## How to use

- One phase = one PR. Do not start a phase until every gate of the previous phase passes.
- Before touching code in any session: state the current phase.
- Update the **Status** marker of a phase as work progresses:
  `pending` → `in-progress` → `in-review` → `done`.
- Review gates are blocking subagents: `@schema-review` (any migration),
  `@payments-review` (before merging P5/P6), `@bilingual-review` (any publishable content/UI).
- Area skills (`api`, `data-model`, `payments`, `tax-and-finance`, `ops`, `jobs`,
  `design-system`, `admin`) are authored just-in-time when their phase starts.

## Decisions log

| #   | Decision                                                                                                                       | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | pnpm workspaces for the monorepo                                                                                               | Fast installs, workspace protocol. PowerShell execution policy blocks `pnpm.ps1`; invoke as `pnpm.cmd`.                                                                                                                                                                                                                                                                                                                             |
| D2  | GitHub Actions CI on every PR                                                                                                  | Fits one-phase-one-PR; runs lint + typecheck + unit + Testcontainers integration.                                                                                                                                                                                                                                                                                                                                                   |
| D3  | Payments reconcile via abstract `ReconciliationProvider` interface                                                             | Real PSP/bank not yet chosen. Implement `FakeProvider` for tests; wire real credentials later without touching order logic.                                                                                                                                                                                                                                                                                                         |
| D4  | Node 22 LTS pinned everywhere (host has 22.23.2)                                                                               | Matches AGENTS.md runtime; containers pin `node:22-alpine` with digest.                                                                                                                                                                                                                                                                                                                                                             |
| D5  | Skills authored just-in-time per phase                                                                                         | Keeps planning light; each area's rules written when first needed.                                                                                                                                                                                                                                                                                                                                                                  |
| D6  | Dev overlay publishes loopback-only convenience ports (Gotenberg :3010, MinIO console :9001, Mailpit :9025/:1025, pgweb :9081) | Prod shape keeps them internal per AGENTS.md; loopback binding keeps dev testable without violating the edge rule. Site address is scheme-carrying `SITE_URL` so `http://localhost` stays plain HTTP while prod domains get ACME. :8025/:8081 were relocated to :9025/:9081 because they fall inside the Windows Hyper-V excluded port range (7907–8106) on the primary dev host, which made `docker compose up` fail to bind them. |

---

## Phase status overview

| Phase | Name                   | Status      |
| ----- | ---------------------- | ----------- |
| P0    | Repo foundation        | done        |
| P1    | Infra skeleton         | done        |
| P2    | Data model             | done        |
| P3    | Pure packages          | done        |
| P4    | API core               | done        |
| P5    | Orders & payments      | done        |
| P6    | Tax & finance          | done        |
| P7    | Worker & notifications | done        |
| P8    | Storefront             | done        |
| P9    | Admin SPA              | done        |
| P10   | Ops hardening & launch | in-progress |

---

## P0 — Repo foundation

**Goal:** clean clone boots tooling; nothing app-specific yet.

**Scope**

- pnpm workspace root matching the AGENTS.md tree (`apps/{api,worker,web,admin}`, `packages/*`, `infra/`).
- `packages/config`: shared tsconfig (strict), eslint flat config, prettier.
- Root scripts: `typecheck`, `lint`, `test`, `dev` passthroughs.
- `.gitignore`, `.editorconfig`, `.env.example` (documented keys only, no values).
- Conventional Commits discipline; PR template with phase + gates checklist.
- GitHub Actions workflow: install → lint → typecheck → unit tests (integration suites join in P2+).

**Acceptance criteria**

- [x] Fresh clone: `pnpm.cmd i && pnpm -r typecheck && pnpm -r lint && pnpm -r test` green.
- [x] CI green on first pushed PR (workflow committed; branch protection set when remote exists).
- [x] No application code yet — scaffolding only.

**Gates:** none (no migrations, payments, or publishable UI).

---

## P1 — Infra skeleton

**Goal:** `docker compose up` brings up the whole stack healthy, dev and prod shapes identical.

**Scope**

- `infra/compose.yml` base: postgres:16-alpine, valkey:8-alpine, minio (pinned), caddy:2, gotenberg (custom image), backup (stub service OK at this stage). All images pinned by tag/digest — no `:latest`.
- `infra/compose.dev.yml`: bind mounts, Mailpit, pgweb, bull-board, MinIO console proxy.
- `infra/gotenberg/Dockerfile`: Gotenberg + TH Sarabun New + Anuphan fonts baked in.
- Healthchecks on every service; `depends_on` uses `condition: service_healthy`.
- One-shot migration service pattern defined (runs in P2 once migrations exist); `api` depends on it exiting 0.
- `Caddyfile`: `/api/*` → api, `/admin` → static admin, `/` → web; caddy publishes the only host ports (80/443; dev adds what Mailpit/pgweb need).
- Every container `TZ=UTC`; Postgres initialised UTC.
- `.env.example` completed for all compose variables.

**Acceptance criteria**

- [x] `docker compose -f infra/compose.yml -f infra/compose.dev.yml up -d` → all services healthy.
- [x] In prod overlay shape, postgres/valkey/minio/gotenberg publish no ports.
- [x] Gotenberg renders a Thai test HTML → PDF with correct glyphs (no tofu).
- [x] Log rotation configured; JSON logs to stdout where applicable.

**Gates:** none formal; infra review in PR description.

---

## P2 — Data model

**Goal:** complete forward-only Drizzle schema encoding every non-negotiable.

**Scope**

- `packages/db` schema: admin_users, sessions; divisions, categories; products (name/body th+en, `purchase_mode`, per-language ASCII slugs), product_images; inventory_ledger (only stock mutation path); orders, order_items; payments (nullable `UNIQUE trans_ref`, `UNIQUE (rail, external_ref)`, `CHECK (status <> 'verified' OR trans_ref IS NOT NULL)`); invoice counter row (locked, gapless — **not** a SEQUENCE); tax_invoices; credit_notes; coupons; product_enquiries; pages/news/events/banners (bilingual parallel columns); settings_registry; audit_log; redirects; consents (timestamp + version).
- Money columns `bigint` satang; timestamps `bigint` Unix seconds named `*_at`. No `timestamptz`, no ISO strings, no `Date` in row types.
- drizzle-kit forward-only migrations run via the P1 one-shot service.

**Acceptance criteria**

- [x] Migration applies cleanly in the one-shot container against real Postgres.
- [x] Testcontainers integration test: duplicate payment insert returns existing row (idempotency proven).
- [x] Schema audit: zero float/numeric money columns; zero timestamptz; ledger is sole stock path.
- [x] Seed script: catalog seed per AGENTS.md (divisions/categories/purchase modes).

**Gates:** `@schema-review` approval required before merge.

---

## P3 — Pure packages

**Goal:** deterministic money and PromptPay primitives, exhaustively tested.

**Scope**

- `@cida/money`: satang parse/format, `formatTHB()`, VAT derived from VAT-inclusive price, rounding rules, line allocation across items. Pure functions only.
- `@cida/promptpay`: EMVCo tag-29 (eWallet) + tag-30 (bill payment) builders, CRC16, QR payload parsers, Ref1/Ref2 composition. Known-vector + property-based tests.
- `@cida/contracts`: Zod schemas for every API request/response/error envelope; inferred TS types exported; single source of truth.

**Acceptance criteria**

- [x] Property-based tests (fast-check) pass on money rounding/allocation invariants (sum of allocations = total; no lost satang).
- [x] Property/vector tests pass on CRC16 and tag builders; bill-pay payload carries Ref1 = order_no.
- [x] Both packages have zero runtime deps beyond what's justified in the PR.
- [x] Contracts cover all P2 tables' write paths.

**Gates:** none formal.

---

## P4 — API core

**Goal:** Hono server with auth, RBAC, errors, settings registry, uploads.

**Scope**

- Boot: env parsed once through Zod — crash container on invalid config; no scattered `process.env`.
- pino JSON logging with request id; id returned in error responses; never leak SQL/stacks/connection strings/container names.
- `/healthz`, `/readyz`.
- Error envelope `{ error: { code, message_th, message_en, details? } }`; success `{ data, meta? }`; stable machine codes. All input validated by `@cida/contracts` Zod — never inline.
- Session cookie auth for admins; password hashing; RBAC middleware enforcing the superadmin/admin/officer matrix server-side on every route.
- Settings Registry CRUD (superadmin-only writes) backing the zero-code-edits rule.
- `@cida/storage`: StorageDriver interface + MinIO/S3 impl; sharp upload pipeline generating fixed width ladder.

**Acceptance criteria**

- [x] Route contract tests from contracts package.
- [x] RBAC matrix test: every route × role × expected outcome.
- [x] Invalid env fails boot with actionable message.
- [x] Image ladder generated at upload; originals never served raw.

**Gates:** none formal.

---

## P5 — Orders & payments

**Goal:** checkout through settlement on three rails behind one state machine.

**Scope**

- Checkout API; `order_no` generator `CIDA-YYMM-NNNNN` from a locked counter row (= bill-payment Ref1).
- Single `payments` table/state machine for `promptpay_billpay`, `promptpay_ewallet`, `bank_transfer`.
- QR endpoints: bill-pay tag-30 default when comp code configured; eWallet tag-29 fallback.
- `ReconciliationProvider` interface (D3): provider lookup keyed `trans_ref`, statement import keyed Ref1 = order_no; `FakeProvider` for tests. Idempotent ingestion: duplicate events return existing row.
- Bank-transfer fallback: `trans_ref` lookup else manual verify — **superadmin only**, typed reason required, flagged red in audit_log.
- Slips attachable for audit only; no code path settles from slip/mini-QR.
- Cart API rejects `enquiry` products server-side.
- Enquiries table + staff notification hook (delivery in P7).

**Acceptance criteria**

- [x] Playwright: full checkout path green (`apps/web/e2e/storefront.spec.ts:422`, run against the prod-shaped compose stack behind Caddy — see P10).
- [x] Duplicate webhook/statement line ingested twice → single payment row.
- [x] Negative test proves a slip/mini-QR cannot move an order to verified.
- [x] Manual verify requires reason + superadmin; audit entry flagged red.
- [x] Enquiry product rejected by cart API with proper error envelope.
- [x] Adding a rail requires no changes to order logic (structure review confirms).

**Gates:** `@payments-review` approval required before merge.

---

## P6 — Tax & finance

**Goal:** gapless immutable invoicing and corrections, PDF output.

**Scope**

- Invoice issuance under locked counter row; gapless even across rollback (rollback simulation test).
- ใบกำกับภาษี PDF via Gotenberg using TH Sarabun New templates; numbering immutable.
- ใบลดหนี้ / ใบเพิ่มหนี้ flow as the only correction path — no edits/deletes of issued invoices.
- Refunds recorded/approved only; disbursement stays offline; no refund API calls.

**Acceptance criteria**

- [x] Forced-failure rollback mid-numbering leaves zero gaps.
- [x] Thai renders correctly in generated PDF (font check) — `apps/api/src/tests/p6-pdf-font.test.ts` run against the built Gotenberg image: both the Thai sample and the real `tax-invoice.html` embed a Sarabun face, not a Latin fallback.
- [x] Correction only possible via credit/debit note objects.
- [x] No outbound refund call exists in the codebase.

**Gates:** `@payments-review` approval required before merge.

---

## P7 — Worker & notifications

**Goal:** background processing isolated from the API process.

**Scope**

- `apps/worker`: BullMQ consumers — reconciliation polls, statement import, notify queue (LINE Messaging API + SMTP email; Mailpit in dev), enquiry notifications, backup verification hooks.
- Repeatable schedules; retry/backoff policy explicit per queue.
- Graceful SIGTERM: stop accepting, drain, close connections. No HTTP port.

**Acceptance criteria**

- [x] Retry/backoff covered by tests; poison messages dead-lettered visibly.
- [x] bull-board shows queues in dev overlay.
- [x] SIGTERM drain verified (in-flight job completes, no lost jobs).

**Gates:** none formal.

---

## P8 — Storefront

**Goal:** public SSR storefront in Apple's structural grammar, craft identity.

**Scope**

- SvelteKit 2 / Svelte 5 runes, adapter-node SSR; `/th` + `/en` fully routed; `/` redirects by Accept-Language with cookie override; hreflang everywhere.
- Home hero, division/category PLPs, PDP with workshop plate signature element.
- Cart + checkout UI over P5 APIs; florals enquiry flow ("ติดต่อเจ้าหน้าที่เพื่อสั่งซื้อ") — plain respectful tone on funeral products: no exclamation marks, no promo badges/motion/parallax/confetti.
- Per-language slugs with `redirects` rows on change; LCP image preloaded; design tokens per AGENTS.md palette/type; motion budget respected incl. `prefers-reduced-motion`.

**Acceptance criteria** — all verified by `apps/web/e2e/storefront.spec.ts` (42 tests,
green against a live API + seeded catalogue):

- [x] Playwright at 360px in **both** languages across nav/PDP/cart/checkout.
- [x] A11y floor: visible focus, real button/a semantics, aria-live on cart + form errors, contrast ≥ 4.5:1.
- [x] Thai body ≥ 15px, line-height ≥ 1.75, no uppercase transform on Thai.
- [x] Enquiry-only product cannot reach cart end-to-end.
- [x] Slug change produces redirect row; old URL still resolves.

**Delivered alongside P8** (the storefront could not meet its criteria without these):

- `GET /api/v1/catalog/*` — divisions, categories, products, product-by-slug (either language).
- `/api/v1/cart` — signed-cookie guest cart; rejects `enquiry` products server-side (closes the
  P5 criterion that until now was only covered by a mocked unit test).
- `products.slug_th` / `slug_en` + migration `0001` — the storefront routes products by slug.
- `@hono/node-server` bootstrap with SIGTERM drain — the API previously exported a fetch handler
  and never listened.
- Seeded sample catalogue including one enquiry-only floral, so the e2e run has real rows.

**Known gaps (not P8 scope):**

- `infra/compose.yml` has no `api` service and `apps/api` has no Dockerfile, although the Caddyfile
  proxies `/api/*` to `api:3000`. Deploying the storefront needs this closed — P10.
  **Gates:** `@bilingual-review` on publishable UI/content; `@schema-review` on migration `0001`
  — **passed**. Both reviews run; the two bilingual failures found were fixed (Thai body font-size
  floor ≥15px in `app.css`; floral/funeral PDP suppressed the unused-scroll-reveal motion and the
  workshop-plate font stack gained an Anuphan fallback for Thai glyphs). SCHEMA-review flagged two
  non-blocking risks for P10 (cross-language slug collision; `lower(sku)` backfill aborting on
  legacy SKUs) — see PLAN review notes.

---

## P9 — Admin SPA

**Goal:** full operations dashboard, Svelte 5 runes SPA served by Caddy.

**Scope**

- Bilingual editors for products/pages/news/events/banners with both-languages-to-publish gate enforced server-side.
- Orders pipeline, packing/shipping, inventory ledger entries, enquiries inbox, coupons, reports.
- Superadmin-only: settings registry UI, admin users, manual verify, audit log viewer, data export.
- Server-side role enforcement on every endpoint (UI hiding is cosmetic only).

**Acceptance criteria**

- [x] Every mutating action writes an audit_log row (tested).
- [x] Publish blocked when either language empty (API-level test).
- [x] Role matrix re-run against admin endpoints.
- [x] Svelte 5 runes only — no legacy `export let` / `$:`.

**Gates:** `@bilingual-review` — **pending**. The both-languages publish gate is
enforced server-side and covered by tests, but a reviewer has not yet read the Thai
copy across the ten admin screens.

**What shipped**

- `apps/admin`: Svelte 5 runes SPA (hash router, no SvelteKit) with ten screens —
  dashboard, orders, inventory, enquiries, products, coupons, content, settings,
  users, audit. Shared `Screen`/`Modal`/`BilingualPair` primitives; `$lib/i18n.svelte.ts`
  holds one app-wide TH/EN store so the topbar toggle drives every screen.
- API admin surface mounted under `/api/v1/admin/*`: catalog, content, coupons,
  inventory, orders, enquiries, users, audit, summary. Each router sets its own
  `requireMinRole` floor — officer for the operations screens, admin for authoring,
  superadmin for settings/users/audit.
- New endpoints written this phase: `GET /admin/catalog/products/:id` (the list
  projection is too thin to edit from), the enquiry inbox (`enquiries-admin.ts`),
  and `GET /admin/summary` for the dashboard counters.
- `infra`: an `admin` one-shot service builds the SPA into the `admin_static`
  volume Caddy already served from — that volume had no producer before. Caddy now
  waits on `service_completed_successfully`, and Vite emits `base: '/admin/'` so
  assets do not fall through to the storefront.
- `apps/api/src/tests/p9.test.ts` — 49 tests over the three acceptance gates, with
  auth/audit/db mocked so the suite stays a unit test.

**Fixed en route**

- `catalog-admin.ts` had a duplicated `const [existing]` block — a syntax error, so
  the file had never compiled.
- The seven admin routers existed but were never mounted in `index.ts`; the whole
  admin surface was unreachable.
- `auth.ts` / `router.ts` used runes in plain `.ts` files (renamed to `.svelte.ts`),
  and `api.ts` called an unimported `clearSession` — now shared via `lib/storage.ts`.
- `App.svelte` imported nine components that did not exist and reassigned a `const`
  `lang`; the SPA could not build at all.
- Added `mustRow` in `errors.ts` for the eight `.returning()` destructures that
  tripped `noUncheckedIndexedAccess`.
- Products sent `lotCode: null`, which `productCore` rejects — it is a required
  `/^[A-Z0-9-]{1,24}$/` field, now marked required in the editor.

**Known gaps / carried to P10**

- Image upload is not wired into the product and content editors: `heroImageKey`
  and banner `imageKey` are typed by hand against `/api/v1/upload`. P10 territory.
- "Reports" and "data export" in the scope above landed only as the audit CSV
  export; no sales/finance reporting screen exists yet.
- Manual payment verification is still API-only (`/payments`), with no admin UI.
- Two pre-existing gate breaks fixed to get `pnpm -r` green: `apps/web/vite.config.ts`
  importing `vitest/config` pulled Vite 7 types that clash with the Vite 6 types
  SvelteKit's plugin is built against (test config moved to `apps/web/vitest.config.ts`),
  and `apps/worker` had no test files but lacked `--passWithNoTests`.
- The pre-existing `packages/db/tests/payments-idempotency.test.ts` failure was fixed: the
  `payments_verified_has_trans_ref` CHECK compared `verified_via = 'manual_override'`, which
  evaluates to UNKNOWN (NULL) against a NULL `verified_via` and thus satisfied the CHECK, letting a
  bare `status = 'verified'` update through. Migrations `0002` corrects it to `verified_via is not
null` (schema source `packages/db/src/payments.ts` updated to match).

---

## P10 — Ops hardening & launch

**Goal:** production-ready, restorable, observable.

**Scope**

- `compose.prod.yml`: built images, restart policies, resource limits, log rotation; only caddy exposed; TLS via Caddy on VPS domain.
- Backup service: pg_dump cron + MinIO mirror + restic offsite.
- Security pass: headers, rate limits (Valkey-backed), session hardening.
- Final reconciliation Playwright suite against Fake→real provider swap checklist.
- Restore drill documentation + go-live checklist.

**P9 carried gaps — closed this session**

- **Image upload wired into admin editors.** New `GET /api/v1/admin/media/:key` preview proxy
  (`apps/api/src/routes/media.ts`, admin+, streams the S3 object with `Cache-Control: private`),
  `uploadImage()` helper + `UploadResult` in the admin API lib, reusable `ImagePicker.svelte`
  (preview / upload / remove, i18n strings). Wired into news hero, event hero, and banner image in
  `Content.svelte`, replacing the hand-typed image-key fields.
- **Reports / data-export admin screen.** `GET /api/v1/admin/reports/summary?from=&to=` (officer+,
  grouped by status: `count` + `coalesce(sum(totalSatang),0)` — factual, VAT-inclusive, no invented
  revenue classification) and `GET /api/v1/admin/reports/orders.csv` (CSV download). Mounted at
  `/reports` with `Reports.svelte` (status→count→gross table, date-range inputs, CSV link).
- **Manual payment verification admin UI.** `GET /api/v1/admin/payments?status=` (superadmin, joins
  order `orderNo`, ordered by `initiatedAt` DESC). Mounted at `/payments` with `Payments.svelte`
  (status filter, verify modal requiring a ≥15-char typed reason → `POST /payments/manual-verify`,
  red-audit warning). Superadmin-only per finance rules.
- **Regression suite:** `apps/api/src/tests/p10-admin.test.ts` (12 tests) — role matrix on the new
  endpoints (`/reports*` floor officer, `/payments` floor superadmin), summary/CSV shape, payments
  list reachability. Verified green alongside the full repo (lint + prettier, `-r typecheck` 0
  errors, 116 existing API tests + 12 new).

**P10 carried gap — backend-selected payment rail (this session)**

Per the user's money-path clarification, the buyer **never chooses a rail**: the backend resolves
the payment option server-side and hands the storefront the QR / account details to display.

- **`apps/api/src/lib/payments.ts` (new):** `selectPaymentRail(env)` resolves precedence
  **Bill Pay (tag-30, if `BILLER_COMP_CODE`) → PromptPay transfer (tag-29, if `PROMPTPAY_NUMBER`)
  → bank transfer (`BANK_*`)**; `accountDetails(env)`; `buildRailPayload(env, order, rail)` returns
  `{ qrPayload?, accountDetails? }`; `createPayment(c, {orderId, rail, amountSatang})` validates the
  order is `pending_payment`, inserts the `payments` row, writes `payment.initiate` audit, returns
  the payment with its QR / account details.
- **`/api/v1/payments/initiate` refactored** to the shared `createPayment`. This also **fixes a
  latent tag-29 bug**: the eWallet transfer QR previously targeted `order.phone` (the buyer's
  number); it now targets the merchant `PROMPTPAY_NUMBER`.
- **`/api/v1/checkout` auto-selects the rail and auto-initiates** a pending payment after order
  creation, returning `rail` + `payment` in the response. No client rail choice.
- **Storefront checkout success step** renders the backend-selected payment: a QR image
  (`qrcode` dep in `apps/web`, SVG/data-URL from `payment.qrPayload`) when a QR rail is configured,
  else the `BANK_*` transfer details. Amount shown via `formatTHB()` (`@cida/money`).
- **New env keys** in `apps/api/src/config.ts` + `.env.example`: `PROMPTPAY_NUMBER`,
  `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NO` (empty disables that rail).
- **Regression tests:** `apps/api/src/tests/p10-payments-rail.test.ts` (11 tests) — rail precedence
  (billpay→ewallet→bank, billpay dominance), `accountDetails`, and `buildRailPayload` including the
  merchant-target tag-29 regression. `apps/api/src/tests/p10-checkout-payment.test.ts` (2 tests)
  drives the **real checkout route** through `createPayment` (DB + audit path): returns
  `rail` + `payment` with the tag-29 QR, and writes a `payment.initiate` audit row. Full API suite
  still green (141 tests).

**P10 — first full stack bring-up (this session)**

The prod-shaped stack (`compose.yml` + `compose.prod.yml`) was built and run end-to-end on Docker
Desktop for the first time. Everything below was found by actually booting it; none of it was
visible from the unit suite.

- **`node:22.22-alpine3.23` was being clobbered locally.** `compose.dev.yml` gave `migrate` and
  `seed` an `image:` while they inherit `build:` from the base file — a service with both makes
  `compose build` _tag the built image with that name_. Building with the dev overlay therefore
  overwrote the node base image with the migrate image, and every later `api`/`web`/`worker` build
  inherited `ENTRYPOINT ["/bin/sh","-c"]` + the drizzle CMD: those containers ran bare `node`, read
  empty stdin, exited 0 and restart-looped with no logs at all. Fixed with `build: !reset null` on
  both dev services. Note the repair needs `docker compose build --pull` — BuildKit otherwise
  reuses its cached base resolution and rebuilds the same broken image.
- **CSP blocked storefront hydration.** Caddy's site-wide `script-src 'self'` rejected SvelteKit's
  inline SSR bootstrap, so pages rendered but nothing was interactive — add-to-cart, form
  validation and the language switcher all silently did nothing (5 e2e failures). CSP is now
  per-route: the storefront emits its own hash-based policy (`kit.csp` `mode: 'hash'` in
  `apps/web/svelte.config.js`), and Caddy applies the strict policy to `/api/*` and `/admin*`,
  which ship no inline scripts. Caddy does not hot-reload a bind-mounted Caddyfile — restart it.
- **`PROMPTPAY_NUMBER` failed at checkout instead of at boot.** The value shipped in `.env.example`
  (`010753700088205`) is not a Thai mobile, and `buildRailPayload` encodes tag-29 as a phone proxy —
  so a deploy that copied the example 500'd on `PromptPayError` at a customer's checkout. The
  config schema now rejects anything but `0XXXXXXXXX` / `66XXXXXXXXX` / empty, so the container
  refuses to start instead (AGENTS.md: crash on invalid config), and the example defaults to empty
  (bank-transfer rail). Supporting a 13-digit national ID or 15-digit eWallet ID would need
  `buildRailPayload` extended — `@payments-review` territory, not done here.
- **`COOKIE_SECURE` was `z.coerce.boolean()`**, which is true for _every_ non-empty string
  including `"false"` — an HTTP deploy would set `Secure` on the admin session cookie and login
  would be silently impossible. Now parsed as the literal `true`/`1`.
- **MinIO had no bucket.** Nothing in the repo created one, so the first media upload on a fresh
  deploy would fail. Added the `minio-init` one-shot (`mc mb --ignore-existing`), gated by
  `service_completed_successfully` on `api`.
- **`backup` mirrored the wrong bucket.** It used `MINIO_BUCKET:-cida-craft` and `worker`
  hardcoded `S3_BUCKET: cida-craft`, while the API writes to `S3_BUCKET` (`cida-media`) — nightly
  backups would have captured an empty/nonexistent bucket. Both read `${S3_BUCKET}` now.
- **Gotenberg's first render 500'd on a cold container** (`websocket url timeout reached`):
  Chromium's cold start exceeds the 20s default on a loaded host, so the first invoice after a
  deploy would fail. `--chromium-start-timeout=120s --api-timeout=180s` baked into the image.
- **Rotating `POSTGRES_PASSWORD` does not reach an existing volume** — `initdb` only runs on an
  empty data dir, so `migrate` fails `28P01`, and drizzle-kit hides the message behind its spinner.
  Documented in `infra/GO_LIVE.md` §A with the `ALTER USER` remedy.
- `seed` was the one prod service with no resource limit; added.

**Verified green on the running stack:** all 12 services healthy behind Caddy on `http://localhost`
(`/` 302 language redirect, `/api/v1/*` 200, `/admin/` 200), catalogue + bootstrap superadmin
seeded, and `apps/web/e2e/storefront.spec.ts` **44/44** against it — which closes the P5 full
checkout-path criterion. Repo gate green: `pnpm lint`, `pnpm -r typecheck`, `pnpm -r test`
(148 API tests, +7 this session).

**Acceptance criteria**

- [x] Image upload + reports + manual-verify admin UIs shipped and verifying green.
- [ ] Wiped-VPS + repo + `.env` + latest backup fully reconstitutes the system (rehearsed, documented).
- [ ] No host dependencies beyond Docker on the VPS.
- [x] Resource limits present on every prod service; healthchecks gating startup (verified from the rendered `compose config`: only `caddy` publishes 80/443, every long-running service carries CPU/memory limits and a healthcheck, one-shots carry limits).
- [ ] Go-live checklist signed off.

**Gates:** full `@payments-review` + ops review. The manual-verify UI (payment-adjacent) and the
Publishable-content pickers still need `@payments-review`/`@bilingual-review` passes before merge.
