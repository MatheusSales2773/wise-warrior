# Seção Desenvolvedor: voltar ao plano Free verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at e0700e9 (46 pass, 0 fail); code diff read at 59ee923
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `dev-tools.spec.ts` `DEV_TOOLS_EMAILS=" Dev@Ex.com , b@ex.com" and e-mail "dev@ex.com" is true` | yes |
| C2 | `dev-tools.spec.ts` `... and e-mail "devx@ex.com" is false` | yes |
| C3 | `dev-tools.spec.ts` `DEV_TOOLS_EMAILS="," and e-mail "dev@ex.com" is false` | yes (the empty-string list row is covered only by `''`, which the title filter shows as `""`; both are in the table) |
| C4 | `dev-tools.spec.ts` `DEV_TOOLS_EMAILS=undefined and e-mail "dev@ex.com" is false` | yes |
| C5 | `billing-dev-reset.integration.test.ts` `answers 404 without calling Stripe to a user that is not listed, even with an active Subscription` | yes |
| C6 | `billing-dev-reset.integration.test.ts` `answers 404, not 503, to a user that is not listed when billing is not configured` | yes |
| C7 | `billing-dev-reset.integration.test.ts` `answers 404, not 409, to a user that is not listed and has no Subscription` | yes |
| C8 | `billing-dev-reset.integration.test.ts` `answers 401 without a token` | yes |
| C9 | `billing-dev-reset.integration.test.ts` `answers 503 to a listed user when billing is not configured` | yes |
| C10 | `billing-dev-reset.integration.test.ts` `answers 409 without calling Stripe to a listed user that has no row` | yes |
| C11 | `billing-dev-reset.integration.test.ts` `answers 409 without calling Stripe to a listed user that has a row with only the Customer` | yes |
| C12 | `billing-dev-reset.integration.test.ts` `answers 409 without calling Stripe to a listed user that has a canceled Subscription` | yes |
| C13 | `billing-dev-reset.integration.test.ts` `answers 202 with no body and cancels now ... that is active` | yes |
| C14 | `billing-dev-reset.integration.test.ts` `answers 202 with no body and cancels now ... that is trialing` | yes |
| C15 | `billing-dev-reset.integration.test.ts` `answers 202 with no body and cancels now ... that is past_due` | yes |
| C16 | `billing-dev-reset.integration.test.ts` `cancels the Subscription of the caller, not of another user` | yes (other user's row is seeded first and also listed) |
| C17 | `billing-dev-reset.integration.test.ts` `writes nothing on a 202: the plan and the row stay as they were` | yes |
| C18 | `billing-dev-reset.integration.test.ts` `answers 502, logs the user id and keeps the row when Stripe fails to cancel` | yes |
| C19 | `billing-webhook.integration.test.ts` `writes canceled and turns the plan free when the payload says active and the API says canceled` | yes (drives `subscription.updated`, not `deleted`; the `deleted` path is held by C20) |
| C20 | `billing-webhook.integration.test.ts` `puts the Título back to Aprendiz, empties a category with no Item inicial, restores the Item inicial of Arma and keeps a Pacote item` | yes |
| C21 | `billing-webhook.integration.test.ts` `is emitted once, to the user, with the new plan and only after the commit` | no - drives `customer.subscription.created` to `premium`; the claim sits on the Free transition (AC 9). A `deleted` that emitted after the commit is never asserted; C20 only counts the emit, not its payload or timing |
| C22 | `rename-http.integration.test.ts` `answers devTools true to a listed user and false to the others, on GET and PATCH` | no - the `false` side is asserted on GET only; PATCH is asserted `true` only, so a PATCH that hard-codes `true` or omits the field for others passes |
| C23 | `users.service.spec.ts` `answers devTools for dev@wise.app from DEV_TOOLS_EMAILS (true)` / `(false)` | yes for the configured path; the ConfigService-absent path of `this.config?.get` has no test (see Findings) |
| C24 | `settings-screen.test.tsx` `AC13: lists Desenvolvedor last in the desktop menu, before Sair da conta, and describes it` | yes |
| C25 | `settings-screen.test.tsx` `AC13: lists Desenvolvedor in its own last group of the phone list` | yes |
| C26 | `settings-screen.test.tsx` `AC14: keeps Desenvolvedor out of the menu and the list when devTools is false` + `AC14: keeps Desenvolvedor out while the profile has not loaded` | no - the not-loaded case runs on the desktop menu only (viewport left at web 1440); the phone list while loading is not exercised, and the first test never asserts the phone group header is absent before the profile resolves |
| C27 | `settings-screen.test.tsx` `AC15: takes an account without devTools from /configuracao/dev to /configuracao` | yes |
| C28 | `settings-screen.test.tsx` `AC16: shows "Plano atual" as the Plano section does, and the button, while premium` | yes |
| C29 | `settings-screen.test.tsx` `AC17: shows Free and no button while the plan is free` | yes |
| C30 | `settings-screen.test.tsx` `AC18: asks first, with the dialog copy, and calls nothing` | yes |
| C31 | `settings-screen.test.tsx` `AC19: Voltar closes the dialog and calls nothing` | yes |
| C32 | `settings-screen.test.tsx` `AC20: confirming calls the route once, shows loading, then closes the dialog and says the plan comes back` | yes |
| C33 | `settings-screen.test.tsx` `AC21: shows Free without reloading when user:planChanged arrives` | yes |
| C34 | `settings-screen.test.tsx` `AC22: closes the dialog and shows the server detail of a 409 / 502 / 503` | yes |
| C35 | `settings-screen.test.tsx` `AC22: shows the generic line for any other error` | yes (one status, 500, of the "any other") |
| C36 | `settings-screen.test.tsx` `AC23: shows the Plano loading indicator, then the Plano error with "Tentar novamente"` | yes |
| C37 | `grep -qF 'DEV_TOOLS_EMAILS: ${DEV_TOOLS_EMAILS:-}' docker-compose.yml` | yes (does not check it sits under the backend service) |
| C38 | `grep -q '^DEV_TOOLS_EMAILS=' apps/backend/.env.example` | no - AC 25 also requires the line saying empty frees nobody and staging only; the grep passes without the comment |
| C39 | `npm run lint:openapi && grep -q '/billing/dev/reset-plan' ... && grep -q 'devTools' ...` | no - the greps match the path and the word anywhere; they do not hold 202/401/404/409/502/503 on the route nor `devTools` in the profile schema (the Redocly lint only checks the file is valid) |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| C21 does not prove `user:planChanged` on the Free transition | `billing-webhook.integration.test.ts:389` seeds a free user and sends `customer.subscription.created` to `premium` | in the `deleted` test (line 416 group) assert the single `user:planChanged` has `payload.planTier === 'free'` and `planTierWhenEmitted === 'free'` | `eeac2e7`, C21 (webhook free emit test) |
| C22 PATCH `false` is not asserted | `rename-http.integration.test.ts` new test patches only as listed `ana` | PATCH as `bruno` and expect `devTools` false | `eeac2e7`, C22 (PATCH as bruno) |
| ConfigService-optional path of UsersService is untested, and nothing proves Nest injects it | `users.service.ts:148` `this.config?.get`; every test builds UsersService with a ConfigService stub; `test:auth:integration` (AppModule boot) is not in any proof. A wiring gap would silently make `devTools` false and the route 404 | add a unit case building `UsersService` without ConfigService expecting `devTools` false and `isDevToolsUser` false; add (or cite) a real-AppModule check that a listed email gets `devTools: true` | `6464e05`, C23 (no-ConfigService unit) and C40 (AppModule boot) |
| C26 phone list while the profile loads is untested | `AC14: ... has not loaded` runs at the desktop viewport only | repeat it with `setViewport('android', 390)` and assert no `DESENVOLVEDOR` header | `eeac2e7`, C26 (phone loading test) |
| C38 passes without the documenting comment | `grep '^DEV_TOOLS_EMAILS='` only | grep the comment (`vazia libera ninguém`) too, or a `-B1` check | `eeac2e7`, C38 (comment greps) |
| C39 greps are looser than AC 26 | `grep 'devTools'` matches anywhere in the file; no status codes checked | assert the six codes under `/billing/dev/reset-plan` and `devTools` under the profile schema (e.g. with a small node/yq check) | `eeac2e7`, C39 (status and schema checks) |
| Success message hides when the plan turns Free, unstated in the plan | `dev-content.tsx`: `reset.isSuccess && premium` removes "Assinatura cancelada. O plano volta a Free em instantes." as soon as `user:planChanged` arrives; AC 20 does not say it should go and no test fixes either behaviour | decide: keep the message after Free (drop `&& premium`) or add a test and a plan line for the current behaviour | `eeac2e7`, C33 (test fixes: notice goes away once Free) |

Own examples, run at HEAD as a throwaway integration test (deleted, nothing committed): `status` `unpaid`, `incomplete`, `incomplete_expired`, `paused` with a subscription id all answer 409 without calling Stripe (the other side of the `past_due` boundary); a stored e-mail `DeV@Example.Com` matches the listed `dev@example.com` and a `past_due` row answers 202; a valid token whose user id does not exist answers 404. All held. The 404-before-anything-else ordering holds in code and in C5-C7.
