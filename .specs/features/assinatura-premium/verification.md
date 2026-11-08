# Assinatura premium verification

**Verdict**: PASS
**Proofs**: `proofs.md` at d3fa7ed
**Verifier**: independent sub-agent (author != verifier)

Scope: S3 (issue #356), diff `9301cb9..d3fa7ed`.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `billing-checkout.integration.test.ts` `creates the Customer, stores it and answers 201 with the session url for a free user with no row` | yes - asserts 201, the exact `{ url }`, one `customers.create` and the single row with `stripeSubscriptionId` and `status` null |
| C2 | `billing-checkout.integration.test.ts` `opens a subscription session for the premium Price that returns to the Plano screen` | yes - `toEqual` on the whole params object, so an extra or changed field fails |
| C3 | `billing-checkout.integration.test.ts` `reuses the stored Customer of a free user and creates no other` | yes |
| C4 | `billing-checkout.integration.test.ts` `creates one Customer and one row for two calls in a row` | yes |
| C5 | `billing-checkout.integration.test.ts` `creates one Customer and one row for two calls at the same time` | yes - with the `pessimistic_write` lock removed it fails (`[201, 500]`) |
| C6 | `billing-checkout.integration.test.ts` `answers 409 to a premium user without calling Stripe` | yes - checks status, detail and no Stripe call; the "subscriptions not touched" half is only checked with no row present (own example with a row also passes at HEAD) |
| C7 | `billing-checkout.integration.test.ts` `answers 503 when billing is not configured` | yes |
| C8 | `billing-checkout.integration.test.ts` `answers 502 and leaves no row when Stripe fails to create the Customer` | yes |
| C9 | `billing-checkout.integration.test.ts` `answers 502 and leaves no new row when Stripe fails to create the session`; `keeps the existing row unchanged when Stripe fails to create the session` | yes |
| C10 | `billing-checkout.integration.test.ts` `answers 401 without a token` | yes - the guard is overridden with a fake that only applies if `@UseGuards(JwtAuthGuard)` is on the route |
| C11 | `billing-webhook.integration.test.ts` `stores the Subscription of a completed Checkout on the row of the client_reference_id user`; `webhook-event.spec.ts` `carries the client_reference_id of a subscription Checkout Session as the user` | yes - the unit test (`toStrictEqual`) fails when `userId` is dropped from the target; the integration test asserts subscription id, reread status and `premium` |
| C12 | `billing-webhook.integration.test.ts` `writes nothing when the client_reference_id user does not own the Customer of the Checkout (own row: false)`; `(own row: true)` | no at d3fa7ed - only covered a `client_reference_id` user with no row; closed by 71a6c52 (own-row case fails under the `userId`-only lookup) |
| C13 | `billing-checkout.integration.test.ts` `answers 401 to a token whose user no longer exists` | appended after this review for the second finding |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| C12's test does not hold the "owns the Customer" half of S3.6: a webhook that finds the row by `client_reference_id` alone and ignores the event's Customer passes every proof | Mutated `billing.service.ts` lookup to `where: target.userId ? { userId: target.userId } : { stripeCustomerId: target.customerId }`: C11 and C12 stay green; a throwaway test where the `client_reference_id` user has their own row (`cus_other`) fails, because the other user's row gets `CUSTOMER`'s Subscription and turns `premium` | add a C12 case where the `client_reference_id` user has a row with another Customer and assert both rows and both `plan_tier` unchanged | 71a6c52 - `it.each` own row false/true, both rows and plans asserted; C12 |
| `POST /billing/checkout` has a `404` "Usuário não encontrado" branch that the plan's Surface does not list (`201`, `409`, `502`, `503`, `401`) and no check proves | `billing.service.ts:80` | drop it (e.g. answer `401`) or add `404` to the Surface and the S9 OpenAPI entry, with a check | 71a6c52 - answers `401` (already in the Surface); C13 |
