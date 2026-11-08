# assinatura-premium proofs

**HEAD**: 71a6c52
**Tree**: clean
**Shell**: /bin/sh
**Result**: 18 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run billing / ✓ creates the Customer, stores it and answers 201 with the session url for a free user with no r` | pass |
| C2 | `run billing / ✓ opens a subscription session for the premium Price that returns to the Plano screen` | pass |
| C3 | `run billing / ✓ reuses the stored Customer of a free user and creates no other` | pass |
| C4 | `run billing / ✓ creates one Customer and one row for two calls in a row` | pass |
| C5 | `run billing / ✓ creates one Customer and one row for two calls at the same time` | pass |
| C6 | `run billing / ✓ answers 409 to a premium user without calling Stripe` | pass |
| C7 | `run billing / ✓ answers 503 when billing is not configured` | pass |
| C8 | `run billing / ✓ answers 502 and leaves no row when Stripe fails to create the Customer` | pass |
| C9 | `run billing / ✓ answers 502 and leaves no new row when Stripe fails to create the session` | pass |
| C9 | `run billing / ✓ keeps the existing row unchanged when Stripe fails to create the session` | pass |
| C10 | `run billing / ✓ answers 401 without a token` | pass |
| C11 | `run billing / ✓ stores the Subscription of a completed Checkout on the row of the client_reference_id user` | pass |
| C11 | `run unit / ✓ carries the client_reference_id of a subscription Checkout Session as the user` | pass |
| C12 | `run billing / ✓ writes nothing when the client_reference_id user does not own the Customer of the Checkout (ow` | pass |
| C12 | `run billing / ✓ writes nothing when the client_reference_id user does not own the Customer of the Checkout (ow` | pass |
| C13 | `run billing / ✓ answers 401 to a token whose user no longer exists` | pass |
| Build | `npm run build --workspace apps/backend` | pass |
| Build | `npm run lint --workspace apps/backend` | pass |

## Output

`Run billing` - exit 0

```
    retries and out-of-order delivery
      ✓ ends in the same state and emits user:planChanged once when the same event arrives twice (3347 ms)
      ✓ emits user:planChanged once when the same event arrives twice at the same time (2386 ms)
      ✓ ends in the state the API reports whatever the order of the events (5612 ms)
      ✓ ends canceled when a slow reread of an older event overlaps the faster reread of the cancellation (6254 ms)
      ✓ does not let a late event of an old, ended Subscription cancel the one the user subscribed to afterwards (1749 ms)
    failures
      ✓ answers 500 and writes nothing when the Stripe API fails to reread the Subscription (1195 ms)
      ✓ undoes subscriptions, plan_tier and the equipment together, and emits nothing, when the last write fails (1204 ms)

Test Suites: 2 passed, 2 total
Tests:       46 passed, 46 total
Snapshots:   0 total
Time:        95.902 s
Ran all test suites matching /billing-/i.
```

`Run unit` - exit 0

```
    ✓ reads the Subscription of invoice.paid from the invoice parent
    ✓ reads the Subscription of invoice.payment_failed from the invoice parent
    ✓ accepts an expanded Customer and an expanded Subscription
    ✓ has no target for an invoice that does not belong to a Subscription
    ✓ reads the Customer and the Subscription of a subscription Checkout Session
    ✓ carries the client_reference_id of a subscription Checkout Session as the user
    ✓ has no Subscription to read for a subscription Checkout Session that carries none
    ✓ has no target for a one-time payment Checkout Session (Pacote)
    ✓ has no target when the event carries no Customer (1 ms)

Test Suites: 2 passed, 2 total
Tests:       33 passed, 33 total
Snapshots:   0 total
Time:        1.746 s, estimated 2 s
Ran all test suites matching /src\/modules\/billing/i.
```
