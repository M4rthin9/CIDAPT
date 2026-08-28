---
name: admin
description: >
  CIDA Craft admin dashboard patterns: Svelte 5 runes SPA (Vite, static served by Caddy),
  bilingual forms, orders/inventory/enquiry pipelines, role-gated UI, and the admin API
  surface it consumes. Load when building or changing anything under apps/admin or the
  admin REST routes in apps/api.
---

# Admin SPA + Admin API

The dashboard is a **plain Svelte 5 SPA** (Vite static build, no SvelteKit SSR) served by Caddy
from `/admin`. It only talks to the SAME Hono API the storefront uses (`/api/v1/*`) over the
session cookie. There is no separate admin API host.

## Hard rules (from AGENTS.md, apply here by reference)

- **Server-side role enforcement on every admin route.** The SPA hiding a button is cosmetic,
  never access control. Every admin mutation route must chain
  `authMiddleware` + `requireMinRole(...)` and carry the role matrix. Re-run the RBAC matrix test
  whenever you touch role scope.
- **Every mutating admin action writes an `audit_log` row.** Assume a สตง. auditor reads it.
  Manual payment verification is superadmin-only, needs a typed reason, and is flagged red.
- **Stock changes only via `inventory_ledger`.** Never `UPDATE stock_on_hand` directly.
  Ledger create is the sole stock path.
- **Both languages or it doesn't publish.** Products/pages/news/events need `*_th` + `*_en`;
  the publish endpoint rejects if either is empty (enforced server-side, tested).
- **Superadmin-only:** settings registry, admin-user management, manual payment verify, audit
  log viewer, data export. Admin/officer cannot reach these even if the UI were bypassed.
- Roles: `officer`=orders/inventory/enquiries/packing/shipping + read-only catalog & reports;
  `admin`=everything an officer has + catalog/content/banners/coupons + verify payments
  (NOT manual override); `superadmin`=everything + settings/users/manual verify/audit/export.

## Conventions

- **Runes only.** `$state`, `$derived`, `$props`, `$effect`. No `export let`, no `$:`, no
  stores where a rune suffices, no `{#await}`-with-legacy patterns.
- **API client** is a thin typed wrapper over `fetch('/api/v1/...')`. On `401 session_expired`
  it redirects to `/admin/login`. Errors parsed from the `{ error: { code, message_th,
message_en, details? } }` envelope; show the language-matching message.
- **Audit discipline** lives server-side; the SPA only triggers it via the normal mutations.
- **Exact contracts** come from `@cida/contracts` — never inline a Zod schema in the SPA. Use
  the exported TS types for forms.
- **Bilingual forms** are parallel pairs (`nameTh`/`nameEn` …). The English runs ~15–25% longer
  than Thai; test layout at 360px in both languages.
- Files `kebab-case`, components `PascalCase.svelte`. Proxy only through existing API routes;
  do not add a bespoke admin-only data path unless unavoidable.

## Admin route groups (add API route in the same PR as its screen)

| Screen                                 | API route (missing = build in P9)                                | Min role   |
| -------------------------------------- | ---------------------------------------------------------------- | ---------- |
| Login                                  | `POST /api/v1/auth/login` · `GET /auth/me` · `POST /auth/logout` | public     |
| Catalog: divisions/categories/products | write routes under `/api/v1/catalog/*`                           | admin      |
| Orders pipeline                        | list/get/status-update `/api/v1/orders`                          | officer    |
| Packing/shipping                       | `orders` status → `shipped` + tracking                           | officer    |
| Inventory ledger                       | create/list `/api/v1/inventory`                                  | officer    |
| Enquiries inbox                        | list/status-update `/api/v1/enquiries`                           | officer    |
| Coupons                                | CRUD `/api/v1/coupons`                                           | admin      |
| Content: pages/news/events/banners     | CRUD `/api/v1/content/*`                                         | admin      |
| Settings registry                      | `GET/PUT /api/v1/settings`                                       | superadmin |
| Admin users                            | CRUD `/api/v1/admin-users`                                       | superadmin |
| Manual verify                          | `POST /api/v1/payments/manual-verify`                            | superadmin |
| Audit log / export                     | `GET /api/v1/audit` (+ export)                                   | superadmin |

## Gate

Publishable UI/content needs `@bilingual-review` before merge. Every migration needs
`@schema-review`. Money/tax/policy ambiguity: stop and ask.
