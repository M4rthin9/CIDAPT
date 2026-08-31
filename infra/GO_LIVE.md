# CIDA Craft — Go-Live Checklist

Sign-off checklist for bringing the production storefront live. Every item is a **blocker** —
do not flip DNS / open the storefront until the box next to it is checked. Sections map to the
`infra/` compose setup, `AGENTS.md` non-negotiables, and the phase gates in `PLAN.md`.

> Roles: **Ops** (operator), **Finance** (กรมราชทัณฑ์ finance), **Audit** (สตง. readiness).
> Gate reviewers listed against an item must pass before merge of the related PR, as well as
> before live traffic.

## A. Environment & secrets

- [ ] `.env` present on the VPS only; **never** in the repo or any image layer.
- [ ] `SITE_URL=https://<prod-domain>` (scheme-carrying — Caddy ACME needs it) and `ACME_EMAIL` set.
- [ ] `SESSION_SECRET` is a long random value, **rotated** from any value that was ever committed/seeded.
- [ ] `ADMIN_BOOTSTRAP_*` superadmin rotated/changed and the account re-secured after first login.
- [ ] `POSTGRES_PASSWORD`, `VALKEY_PASSWORD`, `MINIO_ROOT_*`, `LINE_*`, `SMTP_*` are production secrets.
- [ ] `.env.example` documents every key; no guarantees/false defaults in prod.
- [ ] `POSTGRES_PASSWORD` matches the **role inside the volume**, not just `.env`. `initdb` only
      runs on an empty data dir, so rotating the value against an existing `pg_data` volume leaves
      the old password in place and `migrate` fails with `28P01 password authentication failed`
      (drizzle-kit swallows the message behind its spinner). Either start from an empty volume or
      run `ALTER USER <user> WITH PASSWORD '<new>'` before the rotated `.env` goes live.
- [ ] `COOKIE_SECURE=true` in prod (HTTPS). It is parsed as the literal strings `true`/`1` — any
      other value is false.

## B. Payments & reconciliation (Finance)

- [ ] Rail is chosen **server-side** (`selectPaymentRail` in `apps/api/src/lib/payments.ts`) with
      precedence Bill Pay → PromptPay transfer → bank transfer; the buyer never picks. To prefer
      Bill Payment set `BILLER_COMP_CODE` (tag-30, Ref1 = order_no); to enable PromptPay transfer set
      `PROMPTPAY_NUMBER` (tag-29 merchant target); otherwise `BANK_NAME`/`BANK_ACCOUNT_NAME`/
      `BANK_ACCOUNT_NO` are shown. Empty values disable that rail.
- [ ] `RECONCILIATION_PROVIDER` is **not** `fake` in prod — a real provider is selected and its
      `lookup(transRef)` / `matchByRef1(ref1)` implemented behind the `ReconciliationProvider`
      interface (`apps/api/src/lib/reconciliation.ts`), per the provider-swap checklist.
- [ ] `@payments-review` has passed the payments, reconciliation, and manual-verify paths.
- [ ] Manual verify is verifiably **superadmin-only**, requires a typed reason (≥15 chars), and
      writes a `red` `audit_log` row on every use.
- [ ] Refunds/ใบลดหนี้ path rehearsed end-to-end; disbursement is executed **offline** only.

## C. Tax / finance (Finance)

- [ ] Invoice numbering is gapless via the locked counter row (verified not to be a `SEQUENCE`).
- [ ] ใบกำกับภาษี / ใบลดหนี้ PDFs render Thai correctly (TH Sarabun New present in the Gotenberg image).
- [ ] Prices are VAT-inclusive end-to-end; VAT is derived at the render edge, never added at checkout.

## D. Ops & security

- [ ] `docker compose -f infra/compose.yml -f infra/compose.prod.yml config` validates (overlay applied correctly).
- [ ] Only `caddy` publishes ports; `postgres`/`valkey`/`minio`/`gotenberg` expose nothing (DB via SSH tunnel only).
- [ ] Resource limits + healthchecks (`/healthz`, `/readyz`) present on every service, `depends_on: condition: service_healthy`.
- [ ] Migrations run as a one-shot `migrate` service, **not** from app boot (no replica race).
- [ ] Security headers (HSTS, CSP, nosniff, frame-ancestors) and Valkey-backed rate limits are active.
- [ ] `/api/v1/readyz` passes DB + Valkey + MinIO on a cold boot.
- [ ] Logs are JSON to stdout with rotation; request IDs returned to users for support.

## E. Backup & restore (Ops)

- [ ] **Restore drill rehearsed from a wiped VPS** (see `infra/RESTORE.md`) and signed off.
- [ ] Nightly backup cron fires; fresh local dump + MinIO mirror + offsite restic snapshot confirmed.
- [ ] Offsite restic repo reachable and a **test restore** (not just a backup) has succeeded.

## F. Content & bilingual (Audit / `@bilingual-review`)

- [ ] Every published product/page/news/event is bilingual (`*_th` and `*_en` both populated).
- [ ] `@bilingual-review` passed on all publishable content and storefront UI.
- [ ] Slugs are per-language, ASCII, immutable; any change routes through a `redirects` row.
- [ ] PDPA: minimum data collected; consent recorded with timestamp + version; **no inmate personal
      data** anywhere — products attribute to a กองงาน, never an individual.

## G. Storefront & admin quality floor

- [ ] Storefront and admin render correctly at 360px in **both** Thai and English.
- [ ] A11y floor holds: visible focus, real `<button>/<a>`, `aria-live` on cart/form errors, contrast ≥ 4.5:1.
- [ ] Florals (พวงมาลา/พวงหรีด) PDPs: enquiry-only, respectful copy, no promo/motion/badges.
- [ ] Cart API **rejects** enquiry products server-side (UI hiding is not access control).

## H. Go-live execution

- [ ] Final `pnpm -r typecheck && pnpm -r lint && pnpm -r test` green on the tagged release.
- [ ] Final reconciliation Playwright suite run and green (or explicitly waived with rationale).
- [ ] DNS cut to the storefront; `hreflang` verified for `/th` and `/en`.
- [ ] Smoke test a live order: create → initiate payment → reconcile/settle → invoice issued.
- [ ] Operators briefed on the Settings Registry (zero code edits per deployment).

---

## Sign-off

| Area              | Owner             | Date | Signature |
| ----------------- | ----------------- | ---- | --------- |
| Environment       | Ops               |      |           |
| Payments          | Finance           |      |           |
| Tax/Finance       | Finance           |      |           |
| Ops/Security      | Ops               |      |           |
| Backup/Restore    | Ops               |      |           |
| Content/Bilingual | Audit             |      |           |
| Storefront/Admin  | Ops               |      |           |
| **Go-live**       | **Ops + Finance** |      |           |
