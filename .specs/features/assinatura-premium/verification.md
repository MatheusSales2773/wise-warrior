# Assinatura premium verification (S7, #361)

**Verdict**: FAIL
**Proofs**: `proofs.md` at c7b0412
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `billing-pack-payment.integration.test.ts` `creates the Customer and answers 201 with the url of a one-time session for the Pacote price` | yes - `toHaveBeenCalledWith` on the whole session (mode, price_data, client_reference_id, metadata, both URLs) and the stored row |
| C2 | `billing-pack-payment.integration.test.ts` `reads the amount from packs, not from a constant` | yes - 1290 in the table gives `unit_amount: 1290` |
| C3 | `billing-pack-payment.integration.test.ts` `reuses the stored Customer and keeps one row, ...` and `creates one Customer for two first calls at the same time` | yes - both the stored and the first-call case, `create` once, one row |
| C4 | `billing-pack-payment.integration.test.ts` `answers 409 "Você já tem este Pacote" without calling Stripe when the user already paid it` | yes |
| C5 | `billing-pack-payment.integration.test.ts` `answers 404 "Pacote não encontrado" for an unknown slug and for a Pacote off sale the user did not pay` | yes |
| C6 | `billing-pack-payment.integration.test.ts` `answers 503 "Pagamento indisponível no momento" when billing is not configured` | yes |
| C7 | `billing-pack-payment.integration.test.ts` `answers 502 "Não foi possível abrir o pagamento" and leaves no row when Stripe fails` | yes |
| C8 | `billing-pack-payment.integration.test.ts` `answers 401 without a token` | yes |
| C9 | `webhook-event.spec.ts` `reads the session id of a completed one-time payment Checkout (Pacote)` and `has no Pacote session for a subscription Checkout or any other event type` | yes |
| C10 | `billing-pack-payment.integration.test.ts` `stores the Pagamento with the amount and currency of the session read from the API, ... emits user:packGranted after the commit` | no - amount, currency, 3 unequipped rows and the payload are asserted (payload says 1, API 490), but "after the commit" is not: the test passes if the emit moves inside the transaction (see F2) |
| C11 | `billing-pack-payment.integration.test.ts` `answers 200 and writes nothing when the session read from the API is not paid, whatever the payload says` | no - only `unpaid`; `no_payment_required` and a non-`payment` mode are not exercised (behaves right in my probe, see F3) |
| C12 | `billing-pack-payment.integration.test.ts` `keeps one Pagamento, no duplicate item and no second event when the same event arrives again, ...` | yes - 1 sequential repeat plus 2 concurrent, Pagamento, inventory and emit counted |
| C13 | `billing-pack-payment.integration.test.ts` `keeps one Pagamento and logs the id of the session of a second paid checkout of the same Pacote` | yes |
| C14 | `billing-pack-payment.integration.test.ts` `lets a free user equip an item of a Pacote they paid, ...` and `billing-webhook.integration.test.ts` `keeps the Pacote item equipped and emits no equipment change when only a Pacote item was equipped` | yes |
| C15 | `billing-pack-payment.integration.test.ts` `answers 500 and writes nothing when Stripe fails to return the session, so Stripe retries` | yes |
| C16 | `billing-pack-payment.integration.test.ts` `answers 200, writes nothing and logs the session when the payer no longer exists` (added after the Verifier round, for F1) | yes |
| C17 | `billing-pack-payment.integration.test.ts` `still gives the items of a Pacote that left the shelf after the session was opened` (added after the Verifier round, for F5) | yes |

## Own examples (throwaway test with MySQL, deleted)

- Paid session whose `client_reference_id` is a user that does not exist: `200`, no Pagamento, no inventory, **no log at all** (F1).
- `payment_status: 'no_payment_required'`: `200`, nothing written. Holds.
- Session metadata slug `nope` (disagrees with any Pacote): `200`, nothing written, a warn naming the session. Holds.
- Pacote set `for_sale = false` after the checkout was opened, then the paid event arrives: Pagamento written and `user:packGranted` emitted. Holds (the buyer paid); no test names it (F5).
- Probing from a second connection inside `emitToUser`: the Pagamento is already committed at emit time. Holds in the code, unproven by the test (F2).
- Owner of a Pacote that went off sale calls the checkout: `409`, not `404`. Holds, no test (F5).

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1: a paid session of a deleted user is dropped silently, so money was taken and nothing says so | `billing.service.ts` `grantPack`: `if (!(await this.users.lockForUpdate(userId, manager))) return null;` has no log, unlike the unknown-Pacote and second-payment branches; probe returned `200` with 0 warn calls | `logger.warn` with event id, session id and user id in that branch (and in the non-`paid` early return if wanted), plus a test that a missing user answers `200`, writes nothing and warns with the session id | 46355b6 - C16 |
| F2: C10 says "emits after the commit" and the test does not hold it | the test asserts rows and `emitted` after the response; moving `emitToUser` inside the transaction callback keeps it green | in the test, make the `realtime.emitToUser` fake read `pack_payments` and the inventory through a second connection at emit time and assert the 3 items and the Pagamento are visible | 46355b6 - C10 |
| F3: C11 covers one not-paid value out of the three the criterion implies | the test sets only `payment_status: 'unpaid'`; `no_payment_required` and `mode !== 'payment'` from the API have no case (the not-paid guard is only half exercised) | add `no_payment_required` and a `mode: 'subscription'` re-read to the C11 test | 46355b6 - C11 |
| F4: the Pacote session does not restrict payment methods, but the plan limits payment to card (out of scope: "PIX e boleto - Só cartão"). A delayed method completes the session as `unpaid`, and `checkout.session.async_payment_succeeded` is not a handled event, so the buyer pays and never gets the items | `openPackCheckout` builds the session with no `payment_method_types`; `HANDLED_EVENT_TYPES` lacks the async events; the `unpaid` branch returns silently | pass `payment_method_types: ['card']` in the Pacote session and assert it in C1 (or handle `async_payment_succeeded` and `async_payment_failed`) | 46355b6 - C1 |
| F5: two rules the diff added have no test: a paid event for a Pacote that went off sale still grants, and an owner of an off-sale Pacote gets `409`, not `404` | `grantPack` ignores `forSale`; `openPackCheckout` checks the payment before `forSale`; probes pass, nothing fails if the order is swapped | add one test each (the order of the two checks in `openPackCheckout` is a wrong-by-one place) | 46355b6 - C4, C17 |
| F6: `checks.md` header says "14 checks below" and lists 15 (C1..C15) | `checks.md` line "14 checks below · 0 new one-way doors" | fix the count to 15 | 46355b6 - header |
