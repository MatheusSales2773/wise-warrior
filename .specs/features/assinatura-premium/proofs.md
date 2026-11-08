# assinatura-premium proofs

**HEAD**: 9bfba48
**Tree**: clean
**Shell**: /bin/sh
**Result**: 57 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run webhook / ✓ answers 400 and touches nothing when the Stripe-Signature header is missing` | pass |
| C2 | `run webhook / ✓ answers 400 and touches nothing when the signature was made with another secret` | pass |
| C3 | `run webhook / ✓ answers 400 when the body was changed after it was signed` | pass |
| C4 | `run webhook / ✓ answers 200 and writes nothing for customer.subscription.trial_will_end` | pass |
| C4 | `run webhook / ✓ answers 200 and writes nothing for invoice.created` | pass |
| C4 | `run webhook / ✓ answers 200 and writes nothing for payment_intent.succeeded` | pass |
| C4 | `run unit / ✓ lists exactly the 6 types of S2.2` | pass |
| C5 | `run webhook / ✓ answers 200, writes nothing and logs the event id` | pass |
| C6 | `run webhook / ✓ writes canceled and turns the plan free when the payload says active and the API says canceled` | pass |
| C7 | `run webhook / ✓ stores current_period_end from the Subscription item and cancel_at from the API` | pass |
| C8 | `run unit / ✓ reads the Customer and the Subscription of customer.subscription.created` | pass |
| C8 | `run unit / ✓ reads the Customer and the Subscription of customer.subscription.updated` | pass |
| C8 | `run unit / ✓ reads the Customer and the Subscription of customer.subscription.deleted` | pass |
| C8 | `run unit / ✓ reads the Subscription of invoice.paid from the invoice parent` | pass |
| C8 | `run unit / ✓ reads the Subscription of invoice.payment_failed from the invoice parent` | pass |
| C8 | `run unit / ✓ reads the Customer and the Subscription of a subscription Checkout Session` | pass |
| C8 | `run unit / ✓ has no target for a one-time payment Checkout Session (Pacote)` | pass |
| C8 | `run unit / ✓ has no target for an invoice that does not belong to a Subscription` | pass |
| C8 | `run webhook / ✓ rereads the Subscription for an invoice event and for a subscription Checkout Session` | pass |
| C9 | `run unit / ✓ maps the Stripe status active to premium` | pass |
| C9 | `run unit / ✓ maps the Stripe status trialing to premium` | pass |
| C9 | `run unit / ✓ maps the Stripe status past_due to premium` | pass |
| C9 | `run unit / ✓ maps the Stripe status canceled to free` | pass |
| C9 | `run unit / ✓ maps the Stripe status unpaid to free` | pass |
| C9 | `run unit / ✓ maps the Stripe status incomplete to free` | pass |
| C9 | `run unit / ✓ maps the Stripe status incomplete_expired to free` | pass |
| C9 | `run unit / ✓ maps the Stripe status paused to free` | pass |
| C9 | `run unit / ✓ gives free to a user with no Subscription` | pass |
| C9 | `run unit / ✓ gives free to a status Stripe adds later` | pass |
| C9 | `run webhook / ✓ status active leaves the plan premium` | pass |
| C9 | `run webhook / ✓ status trialing leaves the plan premium` | pass |
| C9 | `run webhook / ✓ status past_due leaves the plan premium` | pass |
| C9 | `run webhook / ✓ status canceled leaves the plan free` | pass |
| C9 | `run webhook / ✓ status unpaid leaves the plan free` | pass |
| C9 | `run webhook / ✓ status incomplete leaves the plan free` | pass |
| C9 | `run webhook / ✓ status incomplete_expired leaves the plan free` | pass |
| C9 | `run webhook / ✓ status paused leaves the plan free` | pass |
| C10 | `run webhook / ✓ keeps premium for an active Subscription that ends in the future` | pass |
| C11 | `run webhook / ✓ is emitted once, to the user, with the new plan and only after the commit` | pass |
| C12 | `run webhook / ✓ is not emitted when the plan stays the same` | pass |
| C13 | `run webhook / ✓ puts the Título back to Aprendiz, empties a category with no Item inicial, restores the Item i` | pass |
| C14 | `run webhook / ✓ keeps the Pacote item equipped and emits no equipment change when only a Pacote item was equip` | pass |
| C15 | `run webhook / ✓ leaves the Inventário untouched: the premium items stay owned, only unequipped` | pass |
| C16 | `run webhook / ✓ ends in the same state and emits user:planChanged once when the same event arrives twice` | pass |
| C17 | `run webhook / ✓ emits user:planChanged once when the same event arrives twice at the same time` | pass |
| C18 | `run webhook / ✓ ends in the state the API reports whatever the order of the events` | pass |
| C18 | `run webhook / ✓ ends canceled when a slow reread of an older event overlaps the faster reread of the cancellat` | pass |
| C18 | `run webhook / ✓ does not let a late event of an old, ended Subscription cancel the one the user subscribed to ` | pass |
| C19 | `run webhook / ✓ answers 500 and writes nothing when the Stripe API fails to reread the Subscription` | pass |
| C20 | `run webhook / ✓ undoes subscriptions, plan_tier and the equipment together, and emits nothing, when the last w` | pass |
| C21 | `run unit / ✓ creates the application with rawBody enabled` | pass |
| C22 | `run migration / ✓ creates subscriptions with one row per user, Customer and Subscription, deletes it with the ` | pass |
| C22 | `run migration / ✓ applies every migration in order and reverts them all down to an empty schema` | pass |
| C23 | `run unit / ✓ has no undefined module in the import graph` | pass |
| C23 | `npm run test:auth:integration --workspace apps/backend` | pass |
| Build | `npm run build --workspace apps/backend` | pass |
| Build | `npm run lint --workspace apps/backend` | pass |

## Output

`Run webhook` - exit 0

```
    retries and out-of-order delivery
      ✓ ends in the same state and emits user:planChanged once when the same event arrives twice (1260 ms)
      ✓ emits user:planChanged once when the same event arrives twice at the same time (1649 ms)
      ✓ ends in the state the API reports whatever the order of the events (1991 ms)
      ✓ ends canceled when a slow reread of an older event overlaps the faster reread of the cancellation (2098 ms)
      ✓ does not let a late event of an old, ended Subscription cancel the one the user subscribed to afterwards (1342 ms)
    failures
      ✓ answers 500 and writes nothing when the Stripe API fails to reread the Subscription (1862 ms)
      ✓ undoes subscriptions, plan_tier and the equipment together, and emits nothing, when the last write fails (1570 ms)

Test Suites: 1 passed, 1 total
Tests:       31 passed, 31 total
Snapshots:   0 total
Time:        68.129 s, estimated 167 s
Ran all test suites matching /billing-webhook/i.
```

`Run unit` - exit 0

```
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
PASS src/app.module.spec.ts (7.064 s)
  AppModule wiring
    ✓ has no undefined module in the import graph (3 ms)

PASS src/main.spec.ts (7.129 s)
  main bootstrap
    ✓ creates the application with rawBody enabled (53 ms)

Test Suites: 4 passed, 4 total
Tests:       34 passed, 34 total
Snapshots:   0 total
Time:        7.54 s
Ran all test suites matching /src\/modules\/billing|src\/main.spec.ts|src\/app.module.spec.ts/i.
```

`Run migration` - exit 0

```
    ✓ dates the Meta batida, reopens the Raids of the current week and keeps one Contribution per Study Session (1414 ms)
    ✓ keeps the rotation Missões free, lets priced Missões leave the rotation and drops them on downgrade (991 ms)
    ✓ seeds the four Missões for sale with off-sale reward items, reverts them and reapplies (1463 ms)
    ✓ credits 90 welcome coins once to each existing account, skips repeats and reverts cleanly (1500 ms)
    ✓ seeds the Cosmetic Items À venda, clears the old test item, and removes only the seeded ids on revert (931 ms)
    ✓ adds the Arma category: the Espada to every existing Character, equipped once, and the Cajado and Besta À venda (1531 ms)
    ✓ marks existing Study Sessions as Ciclo and reverts the kind column (2006 ms)
    ✓ moves Madrugador and Cem Sessões to session counts and keeps the Badges already in the Inventário (1987 ms)
    ✓ creates subscriptions with one row per user, Customer and Subscription, deletes it with the user, and drops it on revert (1921 ms)

Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
Snapshots:   0 total
Time:        30.265 s, estimated 40 s
Ran all test suites matching /migration.integration/i.
```

`npm run test:auth:integration --workspace apps/backend` - exit 0

```
> @wise/backend@0.1.0 test:auth:integration
> jest --runInBand --testRegex '.*auth.integration.test.ts$'

PASS src/modules/auth/auth.integration.test.ts (11.485 s)
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
PASS src/modules/auth/universal-auth.integration.test.ts

Test Suites: 2 passed, 2 total
Tests:       14 passed, 14 total
Snapshots:   0 total
Time:        16.374 s, estimated 17 s
Ran all test suites.
```
