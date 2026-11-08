# assinatura-premium proofs

**HEAD**: c171a2f
**Tree**: dirty - develop/
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
      ✓ opens the Portal for the Customer of the caller that returns to the Plano screen (429 ms)
      ✓ answers 409 to a user that never opened a Checkout (460 ms)
      ✓ answers 409 to a user whose row has no Subscription (537 ms)
      ✓ answers 503 when billing is not configured (857 ms)
      ✓ answers 502 and keeps the row when Stripe fails to create the Portal session (713 ms)
      ✓ answers 401 without a token to the Portal (682 ms)
    GET /billing/subscription
      ✓ answers premiumUntil with the cancel_at of a premium user that cancelled in the Portal (830 ms)
      ✓ answers 401 without a token to the subscription (804 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        6.613 s, estimated 10 s
Ran all test suites matching /billing-portal/i.
```

`Run webhook` - exit 0

```
    retries and out-of-order delivery
      ✓ ends in the same state and emits user:planChanged once when the same event arrives twice (237 ms)
      ✓ emits user:planChanged once when the same event arrives twice at the same time (237 ms)
      ✓ ends in the state the API reports whatever the order of the events (231 ms)
      ✓ ends canceled when a slow reread of an older event overlaps the faster reread of the cancellation (737 ms)
      ✓ does not let a late event of an old, ended Subscription cancel the one the user subscribed to afterwards (168 ms)
    failures
      ✓ answers 500 and writes nothing when the Stripe API fails to reread the Subscription (169 ms)
      ✓ undoes subscriptions, plan_tier and the equipment together, and emits nothing, when the last write fails (189 ms)

Test Suites: 1 passed, 1 total
Tests:       34 passed, 34 total
Snapshots:   0 total
Time:        8.454 s, estimated 13 s
Ran all test suites matching /billing-webhook/i.
```

`Run unit` - exit 0

```
    ✓ gives free to a status Stripe adds later (1 ms)

PASS src/modules/billing/domain/subscription-view.spec.ts
  subscriptionView
    ✓ renews at the period end when nothing was cancelled (5 ms)
    ✓ ends at cancel_at instead of renewing when the Subscription was cancelled
    ✓ passes the status of the row through untranslated
    ✓ has no dates and no status for a user with no Subscription row (1 ms)
    ✓ reports billing available only when Stripe is configured (1 ms)

Test Suites: 3 passed, 3 total
Tests:       38 passed, 38 total
Snapshots:   0 total
Time:        4.602 s, estimated 6 s
Ran all test suites matching /src\/modules\/billing/i.
```
