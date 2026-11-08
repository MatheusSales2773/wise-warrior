# Assinatura premium - S2 verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 62e8e13
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `billing-webhook.integration.test.ts` `answers 400 and touches nothing when the Stripe-Signature header is missing` | yes - 400, `retrieve` not called, row equal to before, plan `premium`, no emits |
| C2 | `billing-webhook.integration.test.ts` `answers 400 and touches nothing when the signature was made with another secret` | yes - real SDK signs with another secret; same no-effect assertions |
| C3 | `billing-webhook.integration.test.ts` `answers 400 when the body was changed after it was signed` | yes - header made for the original body, body mutated; asserts 400 and no `retrieve` (does not assert the row, the claim only fixes 400) |
| C4 | `billing-webhook.integration.test.ts` `answers 200 and writes nothing for %s` (3 types) + `webhook-event.spec.ts` `lists exactly the 6 types of S2.2` | yes - `{received:true}`, no `retrieve`, row/plan/emits untouched, on a payload that would cancel; the list is pinned exactly |
| C5 | `billing-webhook.integration.test.ts` `answers 200, writes nothing and logs the event id` | yes - asserts the logger gets the event id and the Customer, `retrieve` not called, row count 1 |
| C6 | `billing-webhook.integration.test.ts` `writes canceled and turns the plan free when the payload says active and the API says canceled` | yes - payload `active`, API `canceled`, asserts stored status and `free` |
| C7 | `billing-webhook.integration.test.ts` `stores current_period_end from the Subscription item and cancel_at from the API` | yes - values differ from the seed and the payload (`cancel_at: null` in payload, set in API); period end is not in the payload at all, so "not from the payload" is shown for `cancel_at` only |
| C8 | `webhook-event.spec.ts` 8 tests + `billing-webhook.integration.test.ts` `rereads the Subscription for an invoice event and for a subscription Checkout Session` | yes - exact `{customerId, subscriptionId}` per type; the one-time Checkout and the invoice without Subscription are unit-only (right layer, the target function is pure) |
| C9 | `plan-tier.spec.ts` 10 tests + `billing-webhook.integration.test.ts` `status %s leaves the plan %s` (8) | yes - every status at both layers, plus `null` and an unknown status |
| C10 | `billing-webhook.integration.test.ts` `keeps premium for an active Subscription that ends in the future (cancel_at set)` | yes - plan, stored `cancel_at`, item still equipped, no emit |
| C11 | `billing-webhook.integration.test.ts` `is emitted once, to the user, with the new plan and only after the commit` | yes - one emit, user id and payload, and the emit callback reads the plan through another connection (an emit before the commit would read `free`) |
| C12 | `billing-webhook.integration.test.ts` `is not emitted when the plan stays the same` | yes - `invoice.payment_failed` to `past_due`, no `user:planChanged`, status stored |
| C13 | `billing-webhook.integration.test.ts` `puts the Título back to Aprendiz, empties a category with no Item inicial, restores the Item inicial of Arma and keeps a Pacote item` | yes - exact equipped set, 3 payloads by category and item, count 3, one `planChanged` |
| C14 | `billing-webhook.integration.test.ts` `keeps the Pacote item equipped and emits no equipment change when only a Pacote item was equipped` | yes - Pacote stays, starter avatar not re-equipped, zero equipment emits, one `planChanged` |
| C15 | `billing-webhook.integration.test.ts` `leaves the Inventário untouched: the premium items stay owned, only unequipped` | yes, loosely - `arrayContaining` of 3 premium items and the starter, not the full inventory list or count; "only `equipped` changes" for the other rows is not asserted |
| C16 | `billing-webhook.integration.test.ts` `ends in the same state and emits user:planChanged once when the same event arrives twice` | yes - one `planChanged` and one `equipmentChanged` after two deliveries; `afterFirst.row` is captured and never compared |
| C17 | `billing-webhook.integration.test.ts` `emits user:planChanged once when the same event arrives twice at the same time` | yes - sends 3 in parallel, one emit of each; I removed the `lockForUpdate` line and it failed 3 of 3 runs, so it holds the lock (the title says "twice", the body sends 3) |
| C18 | `billing-webhook.integration.test.ts` `ends in the state the API reports whatever the order of the events` + `does not let a late event of an old, ended Subscription cancel the one the user subscribed to afterwards` | no for concurrent out-of-order: the order test keeps `retrieve` constant and sends the events one after the other, so it cannot tell a stale reread from a fresh one (see F1); the stale-Subscription test holds |
| C19 | `billing-webhook.integration.test.ts` `answers 500 and writes nothing when the Stripe API fails to reread the Subscription` | yes - 500, row, plan, equipment unchanged, no emit |
| C20 | `billing-webhook.integration.test.ts` `undoes subscriptions, plan_tier and the equipment together, and emits nothing, when the last write fails` | yes - a trigger fails the last write (equip of the starter) after the other three were written; asserts all three rolled back and no emit |
| C21 | `main.spec.ts` `creates the application with rawBody enabled` | yes - real `main.ts` imported, `NestFactory.create` called with `rawBody: true` |
| C22 | `migration.integration.test.ts` `creates subscriptions with one row per user, Customer and Subscription, deletes it with the user, and drops it on revert` + `applies every migration in order and reverts them all down to an empty schema` | yes - each unique index rejected by name, several null Subscriptions allowed, cascade delete, drop on revert |
| C23 | `app.module.spec.ts` `has no undefined module in the import graph` + `npm run test:auth:integration` | yes - the static graph walk plus the real `AppModule` boot (the unit test would pass without `BillingModule`; the boot is what binds the claim) |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1: the Subscription is reread outside the lock, so two concurrent events with different reads end in the older read and the plan stays `premium` after Stripe canceled | `billing.service.ts` `handleWebhook` calls `readSubscription` before `dataSource.transaction`/`lockForUpdate`. Throwaway test: event A's `retrieve` answers `active` after 500 ms, event B (sent 100 ms later) gets `canceled` at once; B commits first, A then overwrites; final row status `active` and plan `premium`, expected `canceled` and `free`. Breaks S2.8 "o estado final é o que a API devolve, qualquer que seja a ordem". The deleted-Subscription retry would not self-heal, since Stripe has no later event | reread inside the transaction after `lockForUpdate` (the API call under a row lock is the cost), or after the lock and before the first write; then add a test where the first `retrieve` is slower than the second | 8a563f7 - reread moved after the lock; C18 |
| F2: C18's out-of-order test cannot fail on the race above | `ends in the state the API reports whatever the order of the events` uses one `mockResolvedValue` and awaits each request, so the events never overlap and the API never changes between reads | make the mock return a different state per call and overlap the requests (the throwaway used `mockImplementationOnce` with a delay) | 8a563f7 - overlapping slow/fast reread test; C18 |
| F3: C16 captures `afterFirst.row` and never compares it | `billing-webhook.integration.test.ts` in `ends in the same state ... twice`: `afterFirst = { row: await row(), ... }`, only `afterFirst.equipped` is used | assert `expect(await row()).toEqual(afterFirst.row)` after the second delivery | 8a563f7 - second delivery compares the stored status; C16 |
| F4: C15 asserts membership, not that the Inventário is unchanged | `arrayContaining([MESTRE_DA_AURORA, CAJADO, AMULETO_PREMIUM])` and `toContain(CAPUZ)` | compare the set of owned item ids before and after | 8a563f7 - owned ids compared before and after; C15 |

Probed with no finding: a Subscription with `items.data: []` and a `cancel_at` in the past on an `active` status (stores `current_period_end` null and the past `cancel_at`, stays `premium`); two premium items equipped in the same category (both unequipped, the starter equipped, one `equipmentChanged`); a Customer whose user was deleted (the FK cascade removes the row, so the event hits S2.3; the lock path also returns `null` when the user is gone); `trialing` to `canceled` (same path as `active` to `canceled`, covered by the status table).
