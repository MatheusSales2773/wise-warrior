# dev-reset-plano proofs

**HEAD**: 8de9d6e
**Tree**: clean
**Shell**: /bin/sh
**Result**: 45 pass, 2 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run unit / ✓ DEV_TOOLS_EMAILS=" Dev@Ex.com , b@ex.com" and e-mail "dev@ex.com" is true` | pass |
| C2 | `run unit / ✓ DEV_TOOLS_EMAILS=" Dev@Ex.com , b@ex.com" and e-mail "devx@ex.com" is false` | pass |
| C3 | `run unit / ✓ DEV_TOOLS_EMAILS="," and e-mail "dev@ex.com" is false` | pass |
| C4 | `run unit / ✓ DEV_TOOLS_EMAILS=undefined and e-mail "dev@ex.com" is false` | pass |
| C5 | `run api / ✓ answers 404 without calling Stripe to a user that is not listed, even with an active Subscription` | pass |
| C6 | `run api / ✓ answers 404, not 503, to a user that is not listed when billing is not configured` | pass |
| C7 | `run api / ✓ answers 404, not 409, to a user that is not listed and has no Subscription` | pass |
| C8 | `run api / ✓ answers 401 without a token` | pass |
| C9 | `run api / ✓ answers 503 to a listed user when billing is not configured` | pass |
| C10 | `run api / ✓ answers 409 without calling Stripe to a listed user that has no row` | pass |
| C11 | `run api / ✓ answers 409 without calling Stripe to a listed user that has a row with only the Customer` | pass |
| C12 | `run api / ✓ answers 409 without calling Stripe to a listed user that has a canceled Subscription` | pass |
| C13 | `run api / ✓ answers 202 with no body and cancels now the Subscription of a listed user that is active` | pass |
| C14 | `run api / ✓ answers 202 with no body and cancels now the Subscription of a listed user that is trialing` | pass |
| C15 | `run api / ✓ answers 202 with no body and cancels now the Subscription of a listed user that is past_due` | pass |
| C16 | `run api / ✓ cancels the Subscription of the caller, not of another user` | pass |
| C17 | `run api / ✓ writes nothing on a 202: the plan and the row stay as they were` | pass |
| C18 | `run api / ✓ answers 502, logs the user id and keeps the row when Stripe fails to cancel` | pass |
| C19 | `run api / ✓ writes canceled and turns the plan free when the payload says active and the API says canceled` | pass |
| C20 | `run api / ✓ puts the Título back to Aprendiz, empties a category with no Item inicial, restores the Item inici` | **fail** |
| C21 | `run api / ✓ is emitted once, to the user, with the new plan and only after the commit` | pass |
| C22 | `run api / ✓ answers devTools true to a listed user and false to the others, on GET and PATCH` | pass |
| C23 | `run unit / ✓ answers devTools for dev@wise.app from DEV_TOOLS_EMAILS (true)` | pass |
| C24 | `run app / ✓ AC13: lists Desenvolvedor last in the desktop menu, before Sair da conta, and describes it` | pass |
| C25 | `run app / ✓ AC13: lists Desenvolvedor in its own last group of the phone list` | pass |
| C26 | `run app / ✓ AC14: keeps Desenvolvedor out of the menu and the list when devTools is false` | pass |
| C26 | `run app / ✓ AC14: keeps Desenvolvedor out while the profile has not loaded` | pass |
| C27 | `run app / ✓ AC15: takes an account without devTools from /configuracao/dev to /configuracao` | pass |
| C28 | `run app / ✓ AC16: shows "Plano atual" as the Plano section does, and the button, while premium` | pass |
| C29 | `run app / ✓ AC17: shows Free and no button while the plan is free` | pass |
| C30 | `run app / ✓ AC18: asks first, with the dialog copy, and calls nothing` | pass |
| C31 | `run app / ✓ AC19: Voltar closes the dialog and calls nothing` | pass |
| C32 | `run app / ✓ AC20: confirming calls the route once, shows loading, then closes the dialog and says the plan com` | pass |
| C33 | `run app / ✓ AC21: shows Free without reloading when user:planChanged arrives` | pass |
| C34 | `run app / ✓ AC22: closes the dialog and shows the server detail of a 409` | pass |
| C34 | `run app / ✓ AC22: closes the dialog and shows the server detail of a 502` | pass |
| C34 | `run app / ✓ AC22: closes the dialog and shows the server detail of a 503` | pass |
| C35 | `run app / ✓ AC22: shows the generic line for any other error` | pass |
| C36 | `run app / ✓ AC23: shows the Plano loading indicator, then the Plano error with "Tentar novamente"` | pass |
| C37 | `grep -qF 'DEV_TOOLS_EMAILS: ${DEV_TOOLS_EMAILS:-}' docker-compose.yml` | pass |
| C38 | `grep -q '^DEV_TOOLS_EMAILS=' apps/backend/.env.example` | pass |
| C39 | `npm run lint:openapi && grep -q '/billing/dev/reset-plan' docs/api/openapi.yaml && grep -q 'devTools' docs/api` | pass |
| Run api | `TEST_DB_PORT=3327 npm run test:integration --workspace apps/backend -- --testPathPattern 'billing-dev-reset/re` | **fail** - exit 1 |
| Build | `npx tsc --noEmit -p apps/backend/tsconfig.json` | pass |
| Build | `npm run lint --workspace apps/backend` | pass |
| Build | `npm run lint --workspace apps/frontend` | pass |
| Build | `npm run lint:openapi` | pass |

## Output

`Run unit` - exit 0

```
    ✓ DEV_TOOLS_EMAILS="," and e-mail "" is false
    ✓ DEV_TOOLS_EMAILS=undefined and e-mail "dev@ex.com" is false

PASS src/modules/users/users.service.spec.ts
  UsersService
    ✓ derives the level boundaries from the XP projection and the Título from the equipped item (7 ms)
    ✓ uses the zero-XP projection when the character is missing without writing (2 ms)
    ✓ answers devTools for dev@wise.app from DEV_TOOLS_EMAILS (true) (1 ms)
    ✓ answers devTools for hero@wise.app from DEV_TOOLS_EMAILS (false) (1 ms)

Test Suites: 2 passed, 2 total
Tests:       11 passed, 11 total
Snapshots:   0 total
Time:        4.098 s
Ran all test suites matching /src\/shared\/dev-tools|src\/modules\/users\/users.service.spec.ts/i.
```

`Run api` - exit 1

```
      ✓ answers 409 without calling Stripe to a listed user that has a canceled Subscription (4372 ms)
      ✓ answers 502, logs the user id and keeps the row when Stripe fails to cancel (4244 ms)

Test Suites: 1 failed, 2 passed, 3 total
Tests:       1 failed, 60 passed, 61 total
Snapshots:   0 total
Time:        94.073 s
Ran all test suites matching /billing-dev-reset|rename-http|billing-webhook/i.
npm error Lifecycle script `test:integration` failed with error:
npm error code 1
npm error path /Users/guilherme/.t3/worktrees/wise-warrior/t3-fca4a424/apps/backend
npm error workspace @wise/backend@0.1.0
npm error location /Users/guilherme/.t3/worktrees/wise-warrior/t3-fca4a424/apps/backend
npm error command failed
npm error command sh -c jest --maxWorkers=3 --globalSetup '<rootDir>/test/integration-global-setup.ts' --globalTeardown '<rootDir>/test/integration-global-teardown.ts' --testRegex '.*integration.test.ts$' --testPathPattern 'billing-dev-reset|rename-http|billing-webhook' --verbose
```

`Run app` - exit 0

```
    on phones
      ✓ shows the current name and the 2–60 rule, with Salvar off until the name changes (36 ms)
      ✓ keeps Salvar off for the invalid name "" (34 ms)
      ✓ keeps Salvar off for the invalid name "A" (34 ms)
      ✓ keeps Salvar off for the invalid name "   " (33 ms)
      ✓ keeps Salvar off for the invalid name "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" (34 ms)
      ✓ saves the trimmed name, confirms it and updates the cached profile (40 ms)
      ✓ says so when there is no connection and keeps the typed name to try again (38 ms)
      ✓ shows a generic failure for a server error (36 ms)

Test Suites: 1 passed, 1 total
Tests:       78 passed, 78 total
Snapshots:   0 total
Time:        4.591 s, estimated 6 s
Ran all test suites matching /__tests__\/settings-screen.test.tsx/i.
```

`grep -qF 'DEV_TOOLS_EMAILS: ${DEV_TOOLS_EMAILS:-}' docker-compose.yml` - exit 0

```
(no output)
```

`grep -q '^DEV_TOOLS_EMAILS=' apps/backend/.env.example` - exit 0

```
(no output)
```

`npm run lint:openapi && grep -q '/billing/dev/reset-plan' docs/api/openapi.yaml && grep -q 'devTools' docs/api` - exit 0

```


    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║  A new version of Redocly CLI (2.76.0) is available.  ║
    ║  Update now: `npm i -g @redocly/cli@latest`.          ║
    ║  Changelog: https://redocly.com/docs/cli/changelog/   ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝

validating docs/api/openapi.yaml...
docs/api/openapi.yaml: validated in 81ms

Woohoo! Your API description is valid. 🎉
You have 1 warning.
```
