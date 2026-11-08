# Assinatura premium - S4 checks (Gerenciar pelo Portal)

Build: `npm run build --workspace apps/backend`; `npm run lint --workspace apps/backend`
Run unit: `npm test --workspace apps/backend -- src/modules/billing --verbose`
Run portal: `TEST_DB_PORT=3329 npm run test:integration --workspace apps/backend -- --testPathPattern billing-portal --verbose`
Run webhook: `TEST_DB_PORT=3329 npm run test:integration --workspace apps/backend -- --testPathPattern billing-webhook --verbose`
Plan: `.specs/features/assinatura-premium/plan.md`

Issue #357 (`S4`). This file covers only S4; the S3 checks, proofs and verification are in git history at 09c68b7.
S4 adds `POST /api/v1/billing/portal`. S4.5 also names `GET /api/v1/billing/subscription` (`premiumUntil`), a route the
plan files under S5.1 (#358): its backend half (the route and the pure view of the row) is built here because S4.5
cannot be observed without it; the Plano screen stays in S5. Tests run against a MySQL 8.0 (`TEST_DB_*`) with a fake
Stripe client, never against Stripe. The routes' OpenAPI entries belong to S9.

11 checks below · 0 one-way doors added (the Portal session needs no new stored data; the door 6 route `GET /billing/subscription` is already in the Surface) · 0 open questions

## Checks

### S4 - Gerenciar pelo Portal

**C1** - A user whose row has a `stripe_subscription_id` gets `201` `{ url }` with the Portal session URL (S4.1)
Proof: run portal | ✓ answers 201 with the Portal url for a user with a Subscription

**C2** - The Portal session is created for the caller's own Customer (never another user's row) with `return_url` = `APP_URL` + `/configuracao/plano` (S4.1)
Proof: run portal | ✓ opens the Portal for the Customer of the caller that returns to the Plano screen

**C3** - A user with no `subscriptions` row gets `409` "Nenhuma assinatura para gerenciar" and Stripe is not called (S4.2: never opened a Checkout)
Proof: run portal | ✓ answers 409 to a user that never opened a Checkout

**C4** - A user whose row has a Customer but no `stripe_subscription_id` gets the same `409` and Stripe is not called (S4.2: checkout opened or only a Pack bought)
Proof: run portal | ✓ answers 409 to a user whose row has no Subscription

**C5** - With no `STRIPE_SECRET_KEY` (no Stripe client) the answer is `503` "Assinatura indisponível no momento", even for a user with a Subscription (S4.3)
Proof: run portal | ✓ answers 503 when billing is not configured

**C6** - When Stripe fails to create the Portal session the answer is `502` "Não foi possível abrir o pagamento" and the row is unchanged (S4.4)
Proof: run portal | ✓ answers 502 and keeps the row when Stripe fails to create the Portal session

**C7** - Without a token `POST /billing/portal` answers `401` and Stripe is not called (Surface)
Proof: run portal | ✓ answers 401 without a token to the Portal

**C8** - A subscription event whose API Subscription is `active` with `cancel_at` set keeps `plan_tier = premium`, stores `cancel_at`, equips nothing and emits no `user:planChanged` (S4.5, webhook half; built in S2)
Proof: run webhook | ✓ keeps premium for an active Subscription that ends in the future (cancel_at set)

**C9** - `GET /billing/subscription` of a `premium` user whose row has `cancel_at` answers `200` with `planTier: "premium"`, `premiumUntil` = `cancel_at` as ISO and `renewsAt: null` (S4.5)
Proof: run portal | ✓ answers premiumUntil with the cancel_at of a premium user that cancelled in the Portal

**C10** - The view of the row: `available` is the Stripe client being present; `renewsAt` = `current_period_end` only when there is no `cancel_at`, else `null`; `premiumUntil` = `cancel_at` or `null`; `status` is the row's or `null`; a user with no row gets `status`, `renewsAt` and `premiumUntil` all `null` (S5.1 backend, needed by S4.5)
Proof: run unit | ✓ renews at the period end when nothing was cancelled
Proof: run unit | ✓ ends at cancel_at instead of renewing when the Subscription was cancelled
Proof: run unit | ✓ passes the status of the row through untranslated
Proof: run unit | ✓ has no dates and no status for a user with no Subscription row
Proof: run unit | ✓ reports billing available only when Stripe is configured

**C11** - Without a token `GET /billing/subscription` answers `401` (Surface)
Proof: run portal | ✓ answers 401 without a token to the subscription

## Coverage

The other routes of the plan's Surface belong to other issues: `/api/v1/billing/checkout` to S3 (done), `/api/v1/billing/webhook`
to S2, `/api/v1/billing/packs` and `/api/v1/billing/packs/:slug/checkout` to S6-S7. `GET /billing/subscription` is proven
here only for `401` and the S4.5 shape; its other statuses and the screen belong to S5.

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /api/v1/billing/portal` statuses (5) | 201 C1 · 401 C7 · 409 C3, C4 · 502 C6 · 503 C5 | - |
| `GET /api/v1/billing/subscription` statuses (2) | 200 C9 · 401 C11 | - |
| caller states of the Portal (4) | Subscription C1 · no row C3 · row without Subscription C4 · no token C7 | - |
| Portal session fields (2) | `customer` C2 · `return_url` C2 | - |
| Stripe failure (1) | session C6 | - |
| subscription view fields (5) | `available` C10 · `planTier` C9 · `status` C10 · `renewsAt` C10 · `premiumUntil` C9, C10 | - |

## Swept

- validation: C3, C4 (no Subscription to manage); the body of the request is never read
- failure modes: C6 (the row survives a failed session)
- idempotency: n/a - opening a Portal session writes nothing, so a repeat is a new session with the same effect
- authorization: C7, C11 (JWT guard); C2 (the Customer comes from the token's user, never from the body or another row)
- concurrency: n/a - the route only reads the row and asks Stripe for a session; nothing is written
- data lifecycle: C6 (row unchanged), C8 (`cancel_at` stored by the webhook is what `premiumUntil` reads, C9)
- dependency failure: C5 (no Stripe), C6
- state transitions: C8 (Premium -> PremiumAteFim keeps premium), C9 (PremiumAteFim exposes `premiumUntil`)
- observability: C6 (the Stripe error is logged with the user id)

## Handoff

- **Settled mid-build:** none
- **Dispatched:** Verifier at e715f5b (diff 09c68b7..e715f5b), returned; screens sub-agent n/a (no capture)
- **Boundary:** C1-C11 closed at c171a2f; proofs.md green (17 pass)
- **Abandoned:** none
- **Walked:** n/a - no screen in S4
