# assinatura-premium proofs

**HEAD**: 674075a
**Tree**: clean
**Shell**: /bin/sh
**Result**: 17 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run portal / ✓ answers 201 with the Portal url for a user with a Subscription` | pass |
| C2 | `run portal / ✓ opens the Portal for the Customer of the caller that returns to the Plano screen` | pass |
| C3 | `run portal / ✓ answers 409 to a user that never opened a Checkout` | pass |
| C4 | `run portal / ✓ answers 409 to a user whose row has no Subscription` | pass |
| C5 | `run portal / ✓ answers 503 when billing is not configured` | pass |
| C6 | `run portal / ✓ answers 502 and keeps the row when Stripe fails to create the Portal session` | pass |
| C7 | `run portal / ✓ answers 401 without a token to the Portal` | pass |
| C8 | `run webhook / ✓ keeps premium for an active Subscription that ends in the future (cancel_at set)` | pass |
| C9 | `run portal / ✓ answers premiumUntil with the cancel_at of a premium user that cancelled in the Portal` | pass |
| C10 | `run unit / ✓ renews at the period end when nothing was cancelled` | pass |
| C10 | `run unit / ✓ ends at cancel_at instead of renewing when the Subscription was cancelled` | pass |
| C10 | `run unit / ✓ passes the status of the row through untranslated` | pass |
| C10 | `run unit / ✓ has no dates and no status for a user with no Subscription row` | pass |
| C10 | `run unit / ✓ reports billing available only when Stripe is configured` | pass |
| C11 | `run portal / ✓ answers 401 without a token to the subscription` | pass |
| Build | `npm run build --workspace apps/backend` | pass |
| Build | `npm run lint --workspace apps/backend` | pass |

## Output

`Run portal` - exit 0

```
      ✓ opens the Portal for the Customer of the caller that returns to the Plano screen (409 ms)
      ✓ answers 409 to a user that never opened a Checkout (414 ms)
      ✓ answers 409 to a user whose row has no Subscription (411 ms)
      ✓ answers 503 when billing is not configured (400 ms)
      ✓ answers 502 and keeps the row when Stripe fails to create the Portal session (577 ms)
      ✓ answers 401 without a token to the Portal (468 ms)
    GET /billing/subscription
      ✓ answers premiumUntil with the cancel_at of a premium user that cancelled in the Portal (622 ms)
      ✓ answers 401 without a token to the subscription (530 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        5.331 s, estimated 9 s
Ran all test suites matching /billing-portal/i.
```

`Run webhook` - exit 0

```
    retries and out-of-order delivery
      ✓ ends in the same state and emits user:planChanged once when the same event arrives twice (199 ms)
      ✓ emits user:planChanged once when the same event arrives twice at the same time (203 ms)
      ✓ ends in the state the API reports whatever the order of the events (194 ms)
      ✓ ends canceled when a slow reread of an older event overlaps the faster reread of the cancellation (712 ms)
      ✓ does not let a late event of an old, ended Subscription cancel the one the user subscribed to afterwards (143 ms)
    failures
      ✓ answers 500 and writes nothing when the Stripe API fails to reread the Subscription (164 ms)
      ✓ undoes subscriptions, plan_tier and the equipment together, and emits nothing, when the last write fails (175 ms)

Test Suites: 1 passed, 1 total
Tests:       34 passed, 34 total
Snapshots:   0 total
Time:        7.885 s, estimated 11 s
Ran all test suites matching /billing-webhook/i.
```

`Run unit` - exit 0

```
    ✓ reads the Subscription of invoice.paid from the invoice parent
    ✓ reads the Subscription of invoice.payment_failed from the invoice parent
    ✓ accepts an expanded Customer and an expanded Subscription
    ✓ has no target for an invoice that does not belong to a Subscription (1 ms)
    ✓ reads the Customer and the Subscription of a subscription Checkout Session
    ✓ carries the client_reference_id of a subscription Checkout Session as the user
    ✓ has no Subscription to read for a subscription Checkout Session that carries none
    ✓ has no target for a one-time payment Checkout Session (Pacote) (1 ms)
    ✓ has no target when the event carries no Customer

Test Suites: 3 passed, 3 total
Tests:       38 passed, 38 total
Snapshots:   0 total
Time:        4.254 s, estimated 5 s
Ran all test suites matching /src\/modules\/billing/i.
```
