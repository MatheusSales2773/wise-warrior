# Assinatura premium - S3 checks (Assinar pelo Checkout)

Build: `npm run build --workspace apps/backend`; `npm run lint --workspace apps/backend`
Run unit: `npm test --workspace apps/backend -- src/modules/billing --verbose`
Run billing: `TEST_DB_PORT=3328 npm run test:integration --workspace apps/backend -- --testPathPattern billing- --verbose`
Plan: `.specs/features/assinatura-premium/plan.md`

Issue #356 (`S3`). This file covers only S3; the S2 checks, proofs and verification are in git history at 9301cb9.
S3 adds `POST /api/v1/billing/checkout` and makes the subscription `checkout.session.completed` find the row of the
user in `client_reference_id`. Tests run against a MySQL 8.0 (`TEST_DB_*`) with a fake Stripe client, never against
Stripe. The route's OpenAPI entry belongs to S9.

13 checks below · 0 one-way doors added (1 and 4 already exist; 7 is read: `STRIPE_PRICE_PREMIUM`, `APP_URL`) · 0 open questions

## Checks

### S3 - Assinar pelo Checkout

**C1** - A `free` user with no `subscriptions` row gets one Customer created, a row with that `stripe_customer_id` (no Subscription, no status) and `201` `{ url }` with the session URL (S3.1)
Proof: run billing | ✓ creates the Customer, stores it and answers 201 with the session url for a free user with no row

**C2** - The session is created with `mode: 'subscription'`, one line item of `STRIPE_PRICE_PREMIUM` quantity 1, the user's Customer, `client_reference_id` = user id, `success_url` = `APP_URL` + `/configuracao/plano?checkout=success`, `cancel_url` = `APP_URL` + `/configuracao/plano?checkout=cancel` (S3.1)
Proof: run billing | ✓ opens a subscription session for the premium Price that returns to the Plano screen

**C3** - A `free` user that already has a row reuses its Customer: no `customers.create`, the session uses the stored Customer, `201` (S3.2)
Proof: run billing | ✓ reuses the stored Customer of a free user and creates no other

**C4** - Two calls one after the other: one Customer created, one row, two `201` (S3.2)
Proof: run billing | ✓ creates one Customer and one row for two calls in a row

**C5** - Two calls at the same time: one Customer created, one row, two `201` (S3.2)
Proof: run billing | ✓ creates one Customer and one row for two calls at the same time

**C6** - A `premium` user gets `409` "Você já tem o plano premium", and neither Stripe nor `subscriptions` is touched (S3.3)
Proof: run billing | ✓ answers 409 to a premium user without calling Stripe

**C7** - With no `STRIPE_SECRET_KEY` (no Stripe client), the answer is `503` "Assinatura indisponível no momento" and no row is written (S3.4)
Proof: run billing | ✓ answers 503 when billing is not configured

**C8** - When creating the Customer fails, the answer is `502` "Não foi possível abrir o pagamento", no session is asked and no row is left (S3.5)
Proof: run billing | ✓ answers 502 and leaves no row when Stripe fails to create the Customer

**C9** - When creating the session fails, the answer is `502` "Não foi possível abrir o pagamento"; a user with no row is left with none, and a user with a row keeps it unchanged (S3.5)
Proof: run billing | ✓ answers 502 and leaves no new row when Stripe fails to create the session
Proof: run billing | ✓ keeps the existing row unchanged when Stripe fails to create the session

**C10** - Without a token, `POST /billing/checkout` answers `401` and Stripe is not called (Surface)
Proof: run billing | ✓ answers 401 without a token

**C11** - A subscription `checkout.session.completed` whose `client_reference_id` is the user stores the `stripe_subscription_id` and the status reread from the API on that user's row and turns the plan `premium`; the target of the event carries that user id (S3.6)
Proof: run billing | ✓ stores the Subscription of a completed Checkout on the row of the client_reference_id user
Proof: run unit | ✓ carries the client_reference_id of a subscription Checkout Session as the user

**C12** - A completed Checkout whose `client_reference_id` names a user that does not own the event's Customer writes nothing and never calls Stripe, whether that user has no row or a row with another Customer (S3.6)
Proof: run billing | ✓ writes nothing when the client_reference_id user does not own the Customer of the Checkout (own row: false)
Proof: run billing | ✓ writes nothing when the client_reference_id user does not own the Customer of the Checkout (own row: true)

**C13** - A valid token whose user no longer exists answers `401` (the Surface lists no `404`), and neither Stripe nor `subscriptions` is touched (Surface; appended after the Verifier)
Proof: run billing | ✓ answers 401 to a token whose user no longer exists

## Coverage

The other routes of the plan's Surface belong to other issues: `/api/v1/billing/webhook` to S2 (S3 only changes how
it finds the row, C11-C12), `/api/v1/billing/subscription` to S5, `/api/v1/billing/portal` to S4,
`/api/v1/billing/packs` and `/api/v1/billing/packs/:slug/checkout` to S6-S7.

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /api/v1/billing/checkout` statuses (5) | 201 C1 · 401 C10, C13 · 409 C6 · 502 C8, C9 · 503 C7 | - |
| caller states (5) | free without row C1 · free with row C3 · premium C6 · no token C10 · user gone C13 | - |
| Stripe failures (2) | Customer C8 · session C9 | - |
| session fields (6) | mode C2 · Price C2 · Customer C2 · `client_reference_id` C2 · `success_url` C2 · `cancel_url` C2 | - |
| `client_reference_id` on the webhook (3) | owns the Customer C11 · no row C12 · row with another Customer C12 | - |

## Swept

- validation: C6 (premium refused), C12 (`client_reference_id` must own the Customer)
- failure modes: C8, C9
- idempotency: C4 (sequential calls reuse the Customer)
- authorization: C10 (JWT guard), C13 (user gone); the user id comes from the token, never from the body
- concurrency: C5 (the user row is locked before the `subscriptions` row is read)
- data lifecycle: C9 (an existing row survives a failed session)
- dependency failure: C7 (no Stripe), C8, C9
- state transitions: C1 -> C3 (SemAssinatura -> CheckoutAberto -> CheckoutAberto), C11 (CheckoutAberto -> Premium)
- observability: C8, C9 (the Stripe error is logged with the user id)

## Handoff

- **Settled mid-build:** none
- **Dispatched:** Verifier at d3fa7ed (diff 9301cb9..d3fa7ed), sent; screens sub-agent n/a (no capture)
- **Boundary:** none yet
- **Abandoned:** none
- **Walked:** n/a - no screen in S3
