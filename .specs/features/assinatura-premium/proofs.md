# assinatura-premium proofs

**HEAD**: 46355b6
**Tree**: clean
**Shell**: /bin/sh
**Result**: 26 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run pack / ✓ creates the Customer and answers 201 with the url of a one-time session for the Pacote price` | pass |
| C2 | `run pack / ✓ reads the amount from packs, not from a constant` | pass |
| C3 | `run pack / ✓ reuses the stored Customer and keeps one row, for a buyer with a Customer already and for two cal` | pass |
| C3 | `run pack / ✓ creates one Customer for two first calls at the same time` | pass |
| C4 | `run pack / ✓ answers 409 "Você já tem este Pacote" without calling Stripe when the user already paid it` | pass |
| C4 | `run pack / ✓ answers 409, not 404, to a user who paid a Pacote that left the shelf` | pass |
| C5 | `run pack / ✓ answers 404 "Pacote não encontrado" for an unknown slug and for a Pacote off sale the user did no` | pass |
| C6 | `run pack / ✓ answers 503 "Pagamento indisponível no momento" when billing is not configured` | pass |
| C7 | `run pack / ✓ answers 502 "Não foi possível abrir o pagamento" and leaves no row when Stripe fails` | pass |
| C8 | `run pack / ✓ answers 401 without a token` | pass |
| C9 | `run unit / ✓ reads the session id of a completed one-time payment Checkout (Pacote)` | pass |
| C9 | `run unit / ✓ has no Pacote session for a subscription Checkout or any other event type` | pass |
| C10 | `run pack / ✓ stores the Pagamento with the amount and currency of the session read from the API, gives the 3 i` | pass |
| C11 | `run pack / ✓ answers 200 and writes nothing when the session read from the API is not paid, whatever the paylo` | pass |
| C11 | `run pack / ✓ answers 200 and writes nothing for no_payment_required read from the API` | pass |
| C11 | `run pack / ✓ answers 200 and writes nothing for a session that is not a one-time payment read from the API` | pass |
| C12 | `run pack / ✓ keeps one Pagamento, no duplicate item and no second event when the same event arrives again, one` | pass |
| C13 | `run pack / ✓ keeps one Pagamento and logs the id of the session of a second paid checkout of the same Pacote` | pass |
| C14 | `run pack / ✓ lets a free user equip an item of a Pacote they paid, with billing configured` | pass |
| C14 | `run webhook / ✓ keeps the Pacote item equipped and emits no equipment change when only a Pacote item was equip` | pass |
| C15 | `run pack / ✓ answers 500 and writes nothing when Stripe fails to return the session, so Stripe retries` | pass |
| C16 | `run pack / ✓ answers 200, writes nothing and logs the session when the payer no longer exists` | pass |
| C17 | `run pack / ✓ still gives the items of a Pacote that left the shelf after the session was opened` | pass |
| Build | `npm run build --workspace apps/backend` | pass |
| Build | `npm run lint --workspace apps/backend` | pass |
| Build | `npm run lint:openapi` | pass |

## Output

`Run pack` - exit 0

```
      ✓ answers 200 and writes nothing for a session that is not a one-time payment read from the API (441 ms)
      ✓ answers 200, writes nothing and logs the session when the payer no longer exists (492 ms)
      ✓ still gives the items of a Pacote that left the shelf after the session was opened (843 ms)
      ✓ answers 500 and writes nothing when Stripe fails to return the session, so Stripe retries (1978 ms)
      ✓ keeps one Pagamento, no duplicate item and no second event when the same event arrives again, one after another or at once (2045 ms)
      ✓ keeps one Pagamento and logs the id of the session of a second paid checkout of the same Pacote (1714 ms)
      ✓ does not touch another user's Inventário (1883 ms)
    equipping an item of the Pacote
      ✓ lets a free user equip an item of a Pacote they paid, with billing configured (498 ms)

Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        16.458 s
Ran all test suites matching /billing-pack-payment/i.
```

`Run unit` - exit 0

```
    ✓ has no target for an invoice that does not belong to a Subscription
    ✓ reads the Customer and the Subscription of a subscription Checkout Session
    ✓ carries the client_reference_id of a subscription Checkout Session as the user
    ✓ has no Subscription to read for a subscription Checkout Session that carries none
    ✓ has no target for a one-time payment Checkout Session (Pacote)
    ✓ has no target when the event carries no Customer
  packSessionId
    ✓ reads the session id of a completed one-time payment Checkout (Pacote)
    ✓ has no Pacote session for a subscription Checkout or any other event type

Test Suites: 1 passed, 1 total
Tests:       25 passed, 25 total
Snapshots:   0 total
Time:        1.311 s
Ran all test suites matching /src\/modules\/billing\/domain\/webhook-event.spec.ts/i.
```

`Run webhook` - exit 0

```
    retries and out-of-order delivery
      ✓ ends in the same state and emits user:planChanged once when the same event arrives twice (411 ms)
      ✓ emits user:planChanged once when the same event arrives twice at the same time (491 ms)
      ✓ ends in the state the API reports whatever the order of the events (405 ms)
      ✓ ends canceled when a slow reread of an older event overlaps the faster reread of the cancellation (944 ms)
      ✓ does not let a late event of an old, ended Subscription cancel the one the user subscribed to afterwards (415 ms)
    failures
      ✓ answers 500 and writes nothing when the Stripe API fails to reread the Subscription (443 ms)
      ✓ undoes subscriptions, plan_tier and the equipment together, and emits nothing, when the last write fails (437 ms)

Test Suites: 1 passed, 1 total
Tests:       34 passed, 34 total
Snapshots:   0 total
Time:        21.208 s, estimated 24 s
Ran all test suites matching /billing-webhook/i.
```
