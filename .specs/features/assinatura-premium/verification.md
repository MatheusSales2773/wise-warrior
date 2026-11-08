# Assinatura premium (S4, #357) verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at e715f5b
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `billing-portal.integration.test.ts` `answers 201 with the Portal url for a user with a Subscription` | yes |
| C2 | `billing-portal.integration.test.ts` `opens the Portal for the Customer of the caller that returns to the Plano screen` | yes - a second user's row with another Customer is seeded; asserts exact `customer` and `return_url` |
| C3 | `billing-portal.integration.test.ts` `answers 409 to a user that never opened a Checkout` | yes |
| C4 | `billing-portal.integration.test.ts` `answers 409 to a user whose row has no Subscription` | yes |
| C5 | `billing-portal.integration.test.ts` `answers 503 when billing is not configured` | yes |
| C6 | `billing-portal.integration.test.ts` `answers 502 and keeps the row when Stripe fails to create the Portal session` | yes |
| C7 | `billing-portal.integration.test.ts` `answers 401 without a token to the Portal` | yes |
| C8 | `billing-webhook.integration.test.ts` `keeps premium for an active Subscription that ends in the future (cancel_at set)` | yes |
| C9 | `billing-portal.integration.test.ts` `answers premiumUntil with the cancel_at of a premium user that cancelled in the Portal` | yes |
| C10 | `subscription-view.spec.ts` `renews at the period end when nothing was cancelled`; `ends at cancel_at instead of renewing when the Subscription was cancelled`; `has no dates and no status for a user with no Subscription row`; `reports billing available only when Stripe is configured` | no - `status` is only ever `'active'` |
| C11 | `billing-portal.integration.test.ts` `answers 401 without a token to the subscription` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| C10 says `status` is the row's, but every test with a row uses `'active'`, so `status: row ? 'active' : null` passes all four unit tests and C9 | `subscription-view.spec.ts` `row` const (`status: 'active'`); `billing-portal.integration.test.ts` C9 seeds `status: 'active'` | in `subscription-view.spec.ts`, assert a non-`active` status (e.g. `past_due`) comes back as is | c171a2f - C10 now proved by `passes the status of the row through untranslated` |

Own examples run at HEAD as a throwaway integration test (deleted, nothing committed). All matched the plan:
a free user whose row has a past `cancel_at` and status `canceled` gets 200 with `premiumUntil` equal to that past date and `renewsAt: null`
(literal S5.1, the UI keys on `planTier`); a premium row with null `current_period_end` and no `cancel_at` gives `renewsAt: null`;
with no Stripe client `GET /billing/subscription` is 200 `available: false` and the Portal is 503;
a second row with the same Customer is rejected by `UQ_subscriptions_stripe_customer_id`, so the Customer cannot belong to two users;
a valid token of a user that no longer exists gets 401.
