# CIDA Craft — Reconciliation Provider Swap Checklist

How to take the payments settlement path from the in-process **FakeProvider** (dev/test,
decision D3) to a real provider without touching order/payment logic. The swap point is fully
internal: routes only ever see the `ReconciliationProvider` interface in
`apps/api/src/lib/reconciliation.ts`.

## The contract you must implement

```ts
export interface ReconciliationProvider {
  name: string;
  lookup(transRef: string): Promise<ReconciliationEvent | null>;
  matchByRef1(ref1: string): Promise<ReconciliationEvent | null>;
}
```

Where `ReconciliationEvent` carries `rail`, `transRef?`, `externalRef?`, `ref1?`
(`CIDA-YYMM-NNNNN`), `amountSatang`, `occurredAt`, `raw?`.

Three rails (`payments` non-negotiables, see `AGENTS.md`):

| Rail                | Settled by                                                             | Implementation required        |
| ------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| `promptpay_billpay` | `matchByRef1(ref1)` — Ref1 = order_no on statement (`CIDA-YYMM-NNNNN`) | statement import + Ref1 match  |
| `promptpay_ewallet` | `lookup(transRef)` — provider reference                                | provider API lookup            |
| `bank_transfer`     | `lookup(transRef)` else **manual** (superadmin + typed reason)         | bank statement lookup + manual |

**Rules that must hold for any real provider:**

1. **Never settle from a slip or mini-QR.** Settlement comes _only_ from `lookup(transRef)` or
   `matchByRef1(ref1)` — a provider/source-of-truth record. A slip is an attachment for audit.
2. Your provider's match result must be **idempotent** — replaying the same event converges to
   `already_verified`, never double-charges or double-settles.
3. `amountSatang` mismatches on match must be surfaced to Finance (do not silently auto-correct).

> The **buyer-facing rail** the storefront shows (Bill Pay / PromptPay transfer / bank details) is
> chosen **server-side** by `selectPaymentRail()` in `apps/api/src/lib/payments.ts` — precedence
> Bill Pay → PromptPay transfer → bank transfer, driven by the `BILLER_COMP_CODE` /
> `PROMPTPAY_NUMBER` / `BANK_*` env keys. That selection is **orthogonal** to this swap:
> `RECONCILIATION_PROVIDER` decides _how a chosen rail settles_, not _which rail the buyer sees_.
> A real provider may cover all three rails, or only some — Finance configures both independently.

## Selection

`RECONCILIATION_PROVIDER` env selects the wiring in `apps/api/src/routes/payments.ts`:

- `fake` → `FakeReconciliationProvider` (tests/dev; never in prod).
- any other value currently throws `provider_not_configured` (500) — **the intended failure
  mode** so prod cannot run without a real provider.

Swap procedure:

1. Implement your provider class in `apps/api/src/lib/` and register it in `getReconProvider()`
   keyed on a new `RECONCILIATION_PROVIDER` value (e.g. `'<bank>'`).
2. Add an integration test that imports real-ish fixture events (a matching + a non-matching
   `ref1`, a `transRef` lookup) so the real match code path is exercised in CI — mirror the
   reconciliation idempotency cases already in `apps/api/src/tests/p5.test.ts`.
3. Set `RECONCILIATION_PROVIDER=<bank>` in prod `.env`. Boot will now fail loudly until the
   provider is correctly configured — that is intended.
4. Reconcile the last W days of the statement (pre-go-live catch-up) and confirm zero false
   negatives on Ref1 matching before opening the storefront.

## Verification gates (run these; `@payments-review` is blocking)

- [ ] `@payments-review` passes the real-provider implementation.
- [ ] Unit: reconciliation idempotency (replay converges) green against the real provider's
      fixture data (or the FakeProvider for the non-swapped happy path).
- [ ] E2E (see `apps/web/e2e/reconciliation.spec.ts`): endpoint routable + validation gate +
      **no_match must not settle anything** (money-safety) green against the live API.
- [ ] No code path settles from slip/mini-QR (structural check).
- [ ] A deliberate wrong amount / no-match does **not** flip order status to `paid`.

```

```
