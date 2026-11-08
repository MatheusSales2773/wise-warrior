# Assinatura premium - S2 checks (Webhook sincroniza a Assinatura e o plano)

Build: `npm run build --workspace apps/backend`; `npm run lint --workspace apps/backend`
Run unit: `npm test --workspace apps/backend -- src/modules/billing src/main.spec.ts --verbose`
Run webhook: `npm run test:integration --workspace apps/backend -- --testPathPattern billing-webhook --verbose`
Run migration: `npm run test:integration --workspace apps/backend -- --testPathPattern migration.integration --verbose`
Plan: `.specs/features/assinatura-premium/plan.md`

Issue #355 (`S2`). This file covers only S2; S1, S3-S9 are other issues and get their own checks. S2 creates the
shared foundations the plan lists as doors 1, 4 and 5 (the `subscriptions` table, `stripe@23.1.0`, `rawBody`) because
the webhook cannot exist without them. Tests run against a MySQL 8.0 (`TEST_DB_*`), never against Stripe.

7 checks groups below · 3 one-way doors touched (1, 4, 5) · 0 open questions

## Checks

### S2 - Webhook sincroniza a Assinatura e o plano

**C1** - `POST /billing/webhook` without `Stripe-Signature` answers `400` and neither reads Stripe nor writes `subscriptions`, `plan_tier` or events (S2.1)
Proof: run webhook | ✓ answers 400 and touches nothing when the Stripe-Signature header is missing

**C2** - A signature made with another secret answers `400` and touches nothing (S2.1)
Proof: run webhook | ✓ answers 400 and touches nothing when the signature was made with another secret

**C3** - A body changed after it was signed answers `400` (S2.1)
Proof: run webhook | ✓ answers 400 when the body was changed after it was signed

**C4** - A verified event outside the 6 handled types answers `200` and writes nothing: `customer.subscription.trial_will_end`, `invoice.created`, `payment_intent.succeeded` (S2.2)
Proof: run webhook | ✓ answers 200 and writes nothing for customer.subscription.trial_will_end
Proof: run webhook | ✓ answers 200 and writes nothing for invoice.created
Proof: run webhook | ✓ answers 200 and writes nothing for payment_intent.succeeded
Proof: run unit | ✓ lists exactly the 6 types of S2.2

**C5** - An event whose Customer is in no `subscriptions` row answers `200`, writes nothing, never calls Stripe and logs the event id (S2.3)
Proof: run webhook | ✓ answers 200, writes nothing and logs the event id

**C6** - The payload says `active`, the API says `canceled`: the row stores `canceled` and the plan becomes `free` (S2.4)
Proof: run webhook | ✓ writes canceled and turns the plan free when the payload says active and the API says canceled

**C7** - `current_period_end` is read from the Subscription item and `cancel_at` from the API, not from the payload (S2.4)
Proof: run webhook | ✓ stores current_period_end from the Subscription item and cancel_at from the API

**C8** - Every handled event reaches its Subscription: the 3 `customer.subscription.*` events, `invoice.paid`, `invoice.payment_failed` and a subscription `checkout.session.completed` give a Customer and a Subscription to reread; a one-time `checkout.session.completed` (Pacote) and an invoice without Subscription give none (S2.4)
Proof: run unit | ✓ reads the Customer and the Subscription of customer.subscription.created
Proof: run unit | ✓ reads the Customer and the Subscription of customer.subscription.updated
Proof: run unit | ✓ reads the Customer and the Subscription of customer.subscription.deleted
Proof: run unit | ✓ reads the Subscription of invoice.paid from the invoice parent
Proof: run unit | ✓ reads the Subscription of invoice.payment_failed from the invoice parent
Proof: run unit | ✓ reads the Customer and the Subscription of a subscription Checkout Session
Proof: run unit | ✓ has no target for a one-time payment Checkout Session (Pacote)
Proof: run unit | ✓ has no target for an invoice that does not belong to a Subscription
Proof: run webhook | ✓ rereads the Subscription for an invoice event and for a subscription Checkout Session

**C9** - Each of the 8 statuses gives its plan: `active`, `trialing`, `past_due` give `premium`; `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused` give `free`; no Subscription and an unknown status give `free` (S2.5)
Proof: run unit | ✓ maps the Stripe status active to premium
Proof: run unit | ✓ maps the Stripe status trialing to premium
Proof: run unit | ✓ maps the Stripe status past_due to premium
Proof: run unit | ✓ maps the Stripe status canceled to free
Proof: run unit | ✓ maps the Stripe status unpaid to free
Proof: run unit | ✓ maps the Stripe status incomplete to free
Proof: run unit | ✓ maps the Stripe status incomplete_expired to free
Proof: run unit | ✓ maps the Stripe status paused to free
Proof: run unit | ✓ gives free to a user with no Subscription
Proof: run unit | ✓ gives free to a status Stripe adds later
Proof: run webhook | ✓ status active leaves the plan premium
Proof: run webhook | ✓ status trialing leaves the plan premium
Proof: run webhook | ✓ status past_due leaves the plan premium
Proof: run webhook | ✓ status canceled leaves the plan free
Proof: run webhook | ✓ status unpaid leaves the plan free
Proof: run webhook | ✓ status incomplete leaves the plan free
Proof: run webhook | ✓ status incomplete_expired leaves the plan free
Proof: run webhook | ✓ status paused leaves the plan free

**C10** - An `active` Subscription with `cancel_at` in the future keeps `premium`, keeps the premium item equipped and emits nothing (S2.5)
Proof: run webhook | ✓ keeps premium for an active Subscription that ends in the future

**C11** - When the plan changes, `user:planChanged` `{ planTier }` goes once to the user's room, after the commit (the committed plan is already readable when it is emitted) (S2.6)
Proof: run webhook | ✓ is emitted once, to the user, with the new plan and only after the commit

**C12** - `user:planChanged` is not emitted when the plan stays the same (`premium` to `past_due`) (S2.6)
Proof: run webhook | ✓ is not emitted when the plan stays the same

**C13** - When the plan turns `free`: "Mestre da Aurora" (Título) is replaced by "Aprendiz", a premium Arma by the Item inicial "Espada", a premium Acessório with no Item inicial leaves the category empty, a Pacote item stays equipped, and `character:equipmentChanged` goes once per affected category (3) (S2.7)
Proof: run webhook | ✓ puts the Título back to Aprendiz, empties a category with no Item inicial, restores the Item inicial of Arma and keeps a Pacote item

**C14** - With only a Pacote item equipped, nothing is unequipped and no `character:equipmentChanged` is emitted, but `user:planChanged` is (S2.7)
Proof: run webhook | ✓ keeps the Pacote item equipped and emits no equipment change when only a Pacote item was equipped

**C15** - The premium items stay in the Inventário after the plan turns `free`; only `equipped` changes (S2.7)
Proof: run webhook | ✓ leaves the Inventário untouched: the premium items stay owned, only unequipped

**C16** - The same event twice ends in the same state with one `user:planChanged` and one `character:equipmentChanged` (S2.8)
Proof: run webhook | ✓ ends in the same state and emits user:planChanged once when the same event arrives twice

**C17** - The same event 3 times at the same time emits `user:planChanged` and `character:equipmentChanged` once (S2.8)
Proof: run webhook | ✓ emits user:planChanged once when the same event arrives twice at the same time

**C18** - Events out of order end in the state the API reports, with one `user:planChanged`; a late event of an old, ended Subscription does not cancel the newer one (S2.8)
Proof: run webhook | ✓ ends in the state the API reports whatever the order of the events
Proof: run webhook | ✓ does not let a late event of an old, ended Subscription cancel the one the user subscribed to afterwards

**C19** - If the Stripe API fails to reread, the answer is `500` and nothing is written or emitted (S2.9)
Proof: run webhook | ✓ answers 500 and writes nothing when the Stripe API fails to reread the Subscription

**C20** - If a write fails after the plan changed, `subscriptions`, `plan_tier` and the equipment roll back together and no event is emitted (S2.10)
Proof: run webhook | ✓ undoes subscriptions, plan_tier and the equipment together, and emits nothing, when the last write fails

**C21** - The real bootstrap (`main.ts`) creates the app with `rawBody: true` (door 5)
Proof: run unit | ✓ creates the application with rawBody enabled

**C22** - The `subscriptions` migration allows one row per user, per Customer and per Subscription (several rows may have no Subscription yet), deletes the row with the user, and reverts by dropping the table; the "applies every migration in order and reverts them all" test keeps the whole chain applying and reverting (door 1)
Proof: run migration | ✓ creates subscriptions with one row per user, Customer and Subscription, deletes it with the user, and drops it on revert
Proof: run migration | ✓ applies every migration in order and reverts them all down to an empty schema

**C23** - Adding `BillingModule` to `AppModule` leaves the module graph resolvable (ADR-001)
Proof: run unit | ✓ has no undefined module in the import graph
Proof: npm run test:auth:integration --workspace apps/backend

## Coverage

The other 5 routes of the plan's Surface (`/api/v1/billing/subscription`, `checkout`, `portal`, `packs`, `packs/:slug/checkout`) belong to S3-S7, which are other issues.

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /api/v1/billing/webhook` statuses (3) | 200 C4 · 400 C1 · 500 C19 | - |
| Stripe statuses -> plan (10: 8 statuses, no Subscription, an unknown status) | `active` C9 · `trialing` C9 · `past_due` C9 · `canceled` C9 · `unpaid` C9 · `incomplete` C9 · `incomplete_expired` C9 · `paused` C9 · none C9 · unknown C9 | - |
| handled event types (6) | `checkout.session.completed` C8 · `customer.subscription.created` C8 · `customer.subscription.updated` C8 · `customer.subscription.deleted` C8 · `invoice.paid` C8 · `invoice.payment_failed` C8 | - |
| events outside the list (3 examples) | `customer.subscription.trial_will_end` C4 · `invoice.created` C4 · `payment_intent.succeeded` C4 | - |
| signature failures (3) | missing C1 · other secret C2 · changed body C3 | - |
| S2.7 equipment cases (4) | Título C13 · Arma with Item inicial C13 · Acessório without Item inicial C13 · Pacote item C13 and C14 | - |
| startup config: raw request body (2 assemblies) | `main.ts` C21 · test harness (`APP_CREATE_OPTIONS`, shared with `main.ts`) C1 | - |
| `user:planChanged` cases (3) | changes once C11 · same plan C12 · duplicate/concurrent C16 and C17 | - |
| doors touched (3) | 1 `subscriptions` C22 · 4 `stripe` client (`apiVersion` fixed in `BillingModule`, SDK pinned `23.1.0`) C23 · 5 `rawBody` C21 | - |

## Swept

- validation: C1, C2, C3 (signature on the raw body); C5 (unknown Customer)
- failure modes: C19, C20
- idempotency: C16, C17, C18
- authorization: C1-C3 - the route is public and the Stripe signature is its only gate; no JWT guard on it
- concurrency: C17
- data lifecycle: C15 (Inventário kept), C22 (row deleted with the user)
- dependency failure: C19
- state transitions: C9, C10, C13, C18
- observability: C5 (event id logged for an unknown Customer)

## Handoff

- **Settled mid-build:** none
- **Dispatched:** none yet
- **Boundary:** none yet
- **Abandoned:** none
- **Walked:** n/a - no screen in S2
