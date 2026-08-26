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

| #   | Decision                                                           | Rationale                                                                                                                   |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| D1  | pnpm workspaces for the monorepo                                   | Fast installs, workspace protocol. PowerShell execution policy blocks `pnpm.ps1`; invoke as `pnpm.cmd`.                     |
| D2  | GitHub Actions CI on every PR                                      | Fits one-phase-one-PR; runs lint + typecheck + unit + Testcontainers integration.                                           |
| D3  | Payments reconcile via abstract `ReconciliationProvider` interface | Real PSP/bank not yet chosen. Implement `FakeProvider` for tests; wire real credentials later without touching order logic. |
| D4  | Node 22 LTS pinned everywhere (host has 22.23.2)                   | Matches AGENTS.md runtime; containers pin `node:22-alpine` with digest.                                                     |
| D5  | Skills authored just-in-time per phase                             | Keeps planning light; each area's rules written when first needed.                                                          |

---

## Phase status overview

| Phase | Name                   | Status    |
| ----- | ---------------------- | --------- |
| P0    | Repo foundation        | in-review |
| P1    | Infra skeleton         | pending   |
| P2    | Data model             | pending   |
| P3    | Pure packages          | pending   |
| P4    | API core               | pending   |
| P5    | Orders & payments      | pending   |
| P6    | Tax & finance          | pending   |
| P7    | Worker & notifications | pending   |
| P8    | Storefront             | pending   |
| P9    | Admin SPA              | pending   |
| P10   | Ops hardening & launch | pending   |

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
- [ ] CI green on first pushed PR (workflow committed; branch protection set when remote exists).
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

- [ ] `docker compose -f infra/compose.yml -f infra/compose.dev.yml up -d` → all services healthy.
- [ ] In prod overlay shape, postgres/valkey/minio/gotenberg publish no ports.
- [ ] Gotenberg renders a Thai test HTML → PDF with correct glyphs (no tofu).
- [ ] Log rotation configured; JSON logs to stdout where applicable.

**Gates:** none formal; infra review in PR description.

---

## P2 — Data model

**Goal:** complete forward-only Drizzle schema encoding every non-negotiable.

**Scope**

- `packages/db` schema: admin_users, sessions; divisions, categories; products (name/body th+en, `purchase_mode`, per-language ASCII slugs), product_images; inventory_ledger (only stock mutation path); orders, order_items; payments (nullable `UNIQUE trans_ref`, `UNIQUE (rail, external_ref)`, `CHECK (status <> 'verified' OR trans_ref IS NOT NULL)`); invoice counter row (locked, gapless — **not** a SEQUENCE); tax_invoices; credit_notes; coupons; product_enquiries; pages/news/events/banners (bilingual parallel columns); settings_registry; audit_log; redirects; consents (timestamp + version).
- Money columns `bigint` satang; timestamps `bigint` Unix seconds named `*_at`. No `timestamptz`, no ISO strings, no `Date` in row types.
- drizzle-kit forward-only migrations run via the P1 one-shot service.

**Acceptance criteria**

- [ ] Migration applies cleanly in the one-shot container against real Postgres.
- [ ] Testcontainers integration test: duplicate payment insert returns existing row (idempotency proven).
- [ ] Schema audit: zero float/numeric money columns; zero timestamptz; ledger is sole stock path.
- [ ] Seed script: catalog seed per AGENTS.md (divisions/categories/purchase modes).

**Gates:** `@schema-review` approval required before merge.

---

## P3 — Pure packages

**Goal:** deterministic money and PromptPay primitives, exhaustively tested.

**Scope**

- `@cida/money`: satang parse/format, `formatTHB()`, VAT derived from VAT-inclusive price, rounding rules, line allocation across items. Pure functions only.
- `@cida/promptpay`: EMVCo tag-29 (eWallet) + tag-30 (bill payment) builders, CRC16, QR payload parsers, Ref1/Ref2 composition. Known-vector + property-based tests.
- `@cida/contracts`: Zod schemas for every API request/response/error envelope; inferred TS types exported; single source of truth.

**Acceptance criteria**

- [ ] Property-based tests (fast-check) pass on money rounding/allocation invariants (sum of allocations = total; no lost satang).
- [ ] Property/vector tests pass on CRC16 and tag builders; bill-pay payload carries Ref1 = order_no.
- [ ] Both packages have zero runtime deps beyond what's justified in the PR.
- [ ] Contracts cover all P2 tables' write paths.

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

- [ ] Route contract tests from contracts package.
- [ ] RBAC matrix test: every route × role × expected outcome.
- [ ] Invalid env fails boot with actionable message.
- [ ] Image ladder generated at upload; originals never served raw.

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

- [ ] Playwright: full checkout path green.
- [ ] Duplicate webhook/statement line ingested twice → single payment row.
- [ ] Negative test proves a slip/mini-QR cannot move an order to verified.
- [ ] Manual verify requires reason + superadmin; audit entry flagged red.
- [ ] Enquiry product rejected by cart API with proper error envelope.
- [ ] Adding a rail requires no changes to order logic (structure review confirms).

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

- [ ] Forced-failure rollback mid-numbering leaves zero gaps.
- [ ] Thai renders correctly in generated PDF (font check).
- [ ] Correction only possible via credit/debit note objects.
- [ ] No outbound refund call exists in the codebase.

**Gates:** `@payments-review` approval required before merge.

---

## P7 — Worker & notifications

**Goal:** background processing isolated from the API process.

**Scope**

- `apps/worker`: BullMQ consumers — reconciliation polls, statement import, notify queue (LINE Messaging API + SMTP email; Mailpit in dev), enquiry notifications, backup verification hooks.
- Repeatable schedules; retry/backoff policy explicit per queue.
- Graceful SIGTERM: stop accepting, drain, close connections. No HTTP port.

**Acceptance criteria**

- [ ] Retry/backoff covered by tests; poison messages dead-lettered visibly.
- [ ] bull-board shows queues in dev overlay.
- [ ] SIGTERM drain verified (in-flight job completes, no lost jobs).

**Gates:** none formal.

---

## P8 — Storefront

**Goal:** public SSR storefront in Apple's structural grammar, craft identity.

**Scope**

- SvelteKit 2 / Svelte 5 runes, adapter-node SSR; `/th` + `/en` fully routed; `/` redirects by Accept-Language with cookie override; hreflang everywhere.
- Home hero, division/category PLPs, PDP with workshop plate signature element.
- Cart + checkout UI over P5 APIs; florals enquiry flow ("ติดต่อเจ้าหน้าที่เพื่อสั่งซื้อ") — plain respectful tone on funeral products: no exclamation marks, no promo badges/motion/parallax/confetti.
- Per-language slugs with `redirects` rows on change; LCP image preloaded; design tokens per AGENTS.md palette/type; motion budget respected incl. `prefers-reduced-motion`.

**Acceptance criteria**

- [ ] Playwright at 360px in **both** languages across nav/PDP/cart/checkout.
- [ ] A11y floor: visible focus, real button/a semantics, aria-live on cart + form errors, contrast ≥ 4.5:1.
- [ ] Thai body ≥ 15px, line-height ≥ 1.75, no uppercase transform on Thai.
- [ ] Enquiry-only product cannot reach cart end-to-end.
- [ ] Slug change produces redirect row; old URL still resolves.

**Gates:** `@bilingual-review` on publishable UI/content.

---

## P9 — Admin SPA

**Goal:** full operations dashboard, Svelte 5 runes SPA served by Caddy.

**Scope**

- Bilingual editors for products/pages/news/events/banners with both-languages-to-publish gate enforced server-side.
- Orders pipeline, packing/shipping, inventory ledger entries, enquiries inbox, coupons, reports.
- Superadmin-only: settings registry UI, admin users, manual verify, audit log viewer, data export.
- Server-side role enforcement on every endpoint (UI hiding is cosmetic only).

**Acceptance criteria**

- [ ] Every mutating action writes an audit_log row (tested).
- [ ] Publish blocked when either language empty (API-level test).
- [ ] Role matrix re-run against admin endpoints.
- [ ] Svelte 5 runes only — no legacy `export let` / `$:`.

**Gates:** `@bilingual-review`.

---

## P10 — Ops hardening & launch

**Goal:** production-ready, restorable, observable.

**Scope**

- `compose.prod.yml`: built images, restart policies, resource limits, log rotation; only caddy exposed; TLS via Caddy on VPS domain.
- Backup service: pg_dump cron + MinIO mirror + restic offsite.
- Security pass: headers, rate limits (Valkey-backed), session hardening.
- Final reconciliation Playwright suite against Fake→real provider swap checklist.
- Restore drill documentation + go-live checklist.

**Acceptance criteria**

- [ ] Wiped-VPS + repo + `.env` + latest backup fully reconstitutes the system (rehearsed, documented).
- [ ] No host dependencies beyond Docker on the VPS.
- [ ] Resource limits present on every prod service; healthchecks gating startup.
- [ ] Go-live checklist signed off.

**Gates:** full `@payments-review` + ops review.
