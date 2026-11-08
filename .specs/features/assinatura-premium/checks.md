# Assinatura premium - S7 checks (Pagar o Pacote)

Build: `npm run build --workspace apps/backend`; `npm run lint --workspace apps/backend`; `npm run lint:openapi`
Run unit: `npm test --workspace apps/backend -- src/modules/billing/domain/webhook-event.spec.ts --verbose`
Run pack: `npm run test:integration --workspace apps/backend -- --testPathPattern billing-pack-payment --verbose`
Run webhook: `npm run test:integration --workspace apps/backend -- --testPathPattern billing-webhook --verbose`
Plan: `.specs/features/assinatura-premium/plan.md`

Issue #361 (`S7`). Replaces the S6 checks (closed in #360). S7 writes `pack_payments` (door 2, created in S6) and adds
no table, no env var and no module `imports`, so `test:auth:integration` is not owed. Tests run against MySQL 8.0
(`TEST_DB_*`) with a fake Stripe client and a webhook signed with a test secret; nothing reaches the network.
Sprites: none (no screen; S8 is the frontend).

14 checks below · 0 new one-way doors · 0 open questions

## Checks

### S7 - Pagar o Pacote

**C1** - `POST /billing/packs/dragao/checkout` for a user without the Pacote creates the Customer, stores it and answers `201` `{ url }`; the session is `mode: 'payment'` with `price_data` `brl` 490 named "Pacote do Dragão", `client_reference_id` = user id, metadata `packSlug: 'dragao'`, and `success_url`/`cancel_url` = `APP_URL` + `/mercado?secao=pacotes&checkout=success` / `&checkout=cancel` (S7.1)
Proof: run pack | ✓ creates the Customer and answers 201 with the url of a one-time session for the Pacote price

**C2** - The amount comes from `packs.price_cents` (1290 in the table → `unit_amount: 1290`) (S7.1)
Proof: run pack | ✓ reads the amount from packs, not from a constant

**C3** - A user with a stored Customer gets it reused (no `customers.create`), and two calls at once, with or without a Customer, leave one Customer and one `subscriptions` row (S7.1, concurrency)
Proof: run pack | ✓ reuses the stored Customer and keeps one row, for a buyer with a Customer already and for two calls at once
Proof: run pack | ✓ creates one Customer for two first calls at the same time

**C4** - A user with a Pagamento of the Pacote gets `409` "Você já tem este Pacote" and Stripe is not called (S7.2)
Proof: run pack | ✓ answers 409 "Você já tem este Pacote" without calling Stripe when the user already paid it

**C5** - An unknown slug, and a Pacote with `for_sale = false` the user did not pay, answer `404` "Pacote não encontrado" and Stripe is not called (S7.3)
Proof: run pack | ✓ answers 404 "Pacote não encontrado" for an unknown slug and for a Pacote off sale the user did not pay

**C6** - Without `STRIPE_SECRET_KEY` the route answers `503` "Pagamento indisponível no momento" (S7.4)
Proof: run pack | ✓ answers 503 "Pagamento indisponível no momento" when billing is not configured

**C7** - When Stripe fails the route answers `502` "Não foi possível abrir o pagamento" and leaves no `subscriptions` row (S7.4)
Proof: run pack | ✓ answers 502 "Não foi possível abrir o pagamento" and leaves no row when Stripe fails

**C8** - The route answers `401` without a token (Surface)
Proof: run pack | ✓ answers 401 without a token

**C9** - A `checkout.session.completed` of a one-time payment is told apart from a subscription Checkout and from other events (S7.5)
Proof: run unit | ✓ reads the session id of a completed one-time payment Checkout (Pacote)
Proof: run unit | ✓ has no Pacote session for a subscription Checkout or any other event type

**C10** - For a paid session the webhook re-reads the session from the API, stores the Pagamento with the API's `amount_total` 490 and `currency` `brl` (not the payload's 1), puts the 3 items unequipped in the Inventário and emits `user:packGranted` `{ slug: 'dragao', cosmeticItemIds: [3 ids] }` to that user (S7.5)
Proof: run pack | ✓ stores the Pagamento with the amount and currency of the session read from the API, gives the 3 items unequipped and emits user:packGranted after the commit

**C11** - A session the API says is not paid answers `200` and writes and emits nothing, whatever the payload says (S7.6)
Proof: run pack | ✓ answers 200 and writes nothing when the session read from the API is not paid, whatever the payload says

**C12** - The same event delivered again, one after another and at once (4 deliveries), leaves one Pagamento, 3 inventory rows and one `user:packGranted` (S7.7)
Proof: run pack | ✓ keeps one Pagamento, no duplicate item and no second event when the same event arrives again, one after another or at once

**C13** - A second paid session of the same Pacote for the same user answers `200`, keeps the first Pagamento and logs the second session id (S7.8)
Proof: run pack | ✓ keeps one Pagamento and logs the id of the session of a second paid checkout of the same Pacote

**C14** - A `free` user equips an item of a Pacote they paid (billing configured, so the premium release is off); a user who turns `free` after `premium` keeps the Pacote item equipped (S7.9)
Proof: run pack | ✓ lets a free user equip an item of a Pacote they paid, with billing configured
Proof: run webhook | ✓ keeps the Pacote item equipped and emits no equipment change when only a Pacote item was equipped

**C15** - When Stripe fails to return the session the webhook answers `500` and writes and emits nothing, so Stripe retries (dependency failure)
Proof: run pack | ✓ answers 500 and writes nothing when Stripe fails to return the session, so Stripe retries

## Coverage

Other routes of the Surface belong to other slices (`/api/v1/billing/subscription` S5, `/api/v1/billing/checkout` S3, `/api/v1/billing/portal` S4, `/api/v1/billing/packs` S6, `/api/v1/billing/webhook` S2); S9 documents the contracts. This slice owns `/api/v1/billing/packs/:slug/checkout`. Startup config: S7 adds no bootstrap setting and no module `imports`.

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /api/v1/billing/packs/:slug/checkout` statuses (6) | 201 C1 · 404 C5 · 409 C4 · 502 C7 · 503 C6 · 401 C8 | - |
| session fields, S7.1 (7) | `mode` C1 · amount/currency C1 C2 · `client_reference_id` C1 · metadata slug C1 · `success_url` C1 · `cancel_url` C1 · Customer C1 C3 | - |
| webhook outcomes for a Pacote session (5) | paid C10 · not paid C11 · replay C12 · second session C13 · Stripe read fails C15 | - |
| Pagamento fields written (3) | `amount_cents` C10 · `currency` C10 · session id C10 | - |
| Pacote items (3) | Elmo de Escamas C10 · Presa do Dragão C10 · Amuleto de Brasa C10 (inventory rows, `equipped = false`) | - |

## Swept

- validation: C5 (slug), C11 (payload vs API)
- failure modes: C7, C15
- idempotency: C12, C13
- authorization: C8; the user comes from the token and the Pagamento from the session's `client_reference_id` read from the API (C10)
- concurrency: C3, C12 (user row lock)
- data lifecycle: existing - `pack_payments` deleted with the user (S6 migration check)
- dependency failure: C7, C15
- state transitions: C4 (owned), C5 (off sale), C14 (free ⇄ premium)
- observability: C13 (session id in the log)

## Handoff

- **Settled mid-build:** none
- **Dispatched:** none yet
- **Boundary:** none
- **Abandoned:** none
- **Walked:** n/a - no screen
