# dev-reset-plano proofs

**HEAD**: b16756c
**Tree**: clean
**Shell**: /bin/sh
**Result**: 50 pass, 0 fail

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
| C20 | `run api / ✓ puts the Título back to Aprendiz, empties a category with no Item inicial, restores the Item inici` | pass |
| C21 | `run api / ✓ is emitted once with free, after the commit, when the Subscription is deleted` | pass |
| C22 | `run api / ✓ answers devTools true to a listed user and false to the others, on GET and PATCH` | pass |
| C23 | `run unit / ✓ answers devTools for dev@wise.app from DEV_TOOLS_EMAILS (true)` | pass |
| C23 | `run unit / ✓ answers devTools false when no ConfigService is provided` | pass |
| C24 | `run app / ✓ AC13: lists Desenvolvedor last in the desktop menu, before Sair da conta, and describes it` | pass |
| C25 | `run app / ✓ AC13: lists Desenvolvedor in its own last group of the phone list` | pass |
| C26 | `run app / ✓ AC14: keeps Desenvolvedor out of the menu and the list when devTools is false` | pass |
| C26 | `run app / ✓ AC14: keeps Desenvolvedor out while the profile has not loaded` | pass |
| C26 | `run app / ✓ AC14: keeps Desenvolvedor out of the phone list while the profile has not loaded` | pass |
| C27 | `run app / ✓ AC15: takes an account without devTools from /configuracao/dev to /configuracao` | pass |
| C28 | `run app / ✓ AC16: shows "Plano atual" as the Plano section does, and the button, while premium` | pass |
| C29 | `run app / ✓ AC17: shows Free and no button while the plan is free` | pass |
| C30 | `run app / ✓ AC18: asks first, with the dialog copy, and calls nothing` | pass |
| C31 | `run app / ✓ AC19: Voltar closes the dialog and calls nothing` | pass |
| C32 | `run app / ✓ AC20: confirming calls the route once, shows loading, then closes the dialog and says the plan com` | pass |
| C33 | `run app / ✓ AC21: shows Free without reloading when user:planChanged arrives` | pass |
| C33 | `run app / ✓ AC20, AC21: the cancel notice goes away once the plan is Free` | pass |
| C34 | `run app / ✓ AC22: closes the dialog and shows the server detail of a 409` | pass |
| C34 | `run app / ✓ AC22: closes the dialog and shows the server detail of a 502` | pass |
| C34 | `run app / ✓ AC22: closes the dialog and shows the server detail of a 503` | pass |
| C35 | `run app / ✓ AC22: shows the generic line for any other error` | pass |
| C36 | `run app / ✓ AC23: shows the Plano loading indicator, then the Plano error with "Tentar novamente"` | pass |
| C37 | `grep -qF 'DEV_TOOLS_EMAILS: ${DEV_TOOLS_EMAILS:-}' docker-compose.yml` | pass |
| C38 | `grep -q '^DEV_TOOLS_EMAILS=' apps/backend/.env.example && grep -q 'Vazia libera ninguém' apps/backend/.env.exa` | pass |
| C39 | `npm run lint:openapi && for c in 202 401 404 409 502 503; do awk '/^  \/billing\/dev\/reset-plan:/{f=1;next} /` | pass |
| C40 | `TEST_DB_PORT=3327 npm run test:auth:integration --workspace apps/backend` | pass |
| Build | `npx tsc --noEmit -p apps/backend/tsconfig.json` | pass |
| Build | `npm run lint --workspace apps/backend` | pass |
| Build | `npm run lint --workspace apps/frontend` | pass |
| Build | `npm run lint:openapi` | pass |

## Output

`Run unit` - exit 0

```
    ✓ DEV_TOOLS_EMAILS=undefined and e-mail "dev@ex.com" is false

PASS src/modules/users/users.service.spec.ts
  UsersService
    ✓ derives the level boundaries from the XP projection and the Título from the equipped item (8 ms)
    ✓ uses the zero-XP projection when the character is missing without writing (2 ms)
    ✓ answers devTools for dev@wise.app from DEV_TOOLS_EMAILS (true) (2 ms)
    ✓ answers devTools for hero@wise.app from DEV_TOOLS_EMAILS (false) (1 ms)
    ✓ answers devTools false when no ConfigService is provided (1 ms)

Test Suites: 2 passed, 2 total
Tests:       12 passed, 12 total
Snapshots:   0 total
Time:        3.061 s
Ran all test suites matching /src\/shared\/dev-tools|src\/modules\/users\/users.service.spec.ts/i.
```

`Run api` - exit 0

```
    retries and out-of-order delivery
      ✓ ends in the same state and emits user:planChanged once when the same event arrives twice (1184 ms)
      ✓ emits user:planChanged once when the same event arrives twice at the same time (1179 ms)
      ✓ ends in the state the API reports whatever the order of the events (1123 ms)
      ✓ ends canceled when a slow reread of an older event overlaps the faster reread of the cancellation (1777 ms)
      ✓ does not let a late event of an old, ended Subscription cancel the one the user subscribed to afterwards (1135 ms)
    failures
      ✓ answers 500 and writes nothing when the Stripe API fails to reread the Subscription (1182 ms)
      ✓ undoes subscriptions, plan_tier and the equipment together, and emits nothing, when the last write fails (886 ms)

Test Suites: 3 passed, 3 total
Tests:       62 passed, 62 total
Snapshots:   0 total
Time:        52.832 s, estimated 58 s
Ran all test suites matching /billing-dev-reset|rename-http|billing-webhook/i.
```

`Run app` - exit 0

```
    on phones
      ✓ shows the current name and the 2–60 rule, with Salvar off until the name changes (30 ms)
      ✓ keeps Salvar off for the invalid name "" (28 ms)
      ✓ keeps Salvar off for the invalid name "A" (27 ms)
      ✓ keeps Salvar off for the invalid name "   " (28 ms)
      ✓ keeps Salvar off for the invalid name "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" (28 ms)
      ✓ saves the trimmed name, confirms it and updates the cached profile (33 ms)
      ✓ says so when there is no connection and keeps the typed name to try again (31 ms)
      ✓ shows a generic failure for a server error (29 ms)

Test Suites: 1 passed, 1 total
Tests:       80 passed, 80 total
Snapshots:   0 total
Time:        3.535 s, estimated 4 s
Ran all test suites matching /__tests__\/settings-screen.test.tsx/i.
```

`grep -qF 'DEV_TOOLS_EMAILS: ${DEV_TOOLS_EMAILS:-}' docker-compose.yml` - exit 0

```
(no output)
```

`grep -q '^DEV_TOOLS_EMAILS=' apps/backend/.env.example && grep -q 'Vazia libera ninguém' apps/backend/.env.exa` - exit 0

```
(no output)
```

`npm run lint:openapi && for c in 202 401 404 409 502 503; do awk '/^  \/billing\/dev\/reset-plan:/{f=1;next} /` - exit 0

```


    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║  A new version of Redocly CLI (2.76.0) is available.  ║
    ║  Update now: `npm i -g @redocly/cli@latest`.          ║
    ║  Changelog: https://redocly.com/docs/cli/changelog/   ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝

validating docs/api/openapi.yaml...
docs/api/openapi.yaml: validated in 63ms

Woohoo! Your API description is valid. 🎉
You have 1 warning.
```

`TEST_DB_PORT=3327 npm run test:auth:integration --workspace apps/backend` - exit 0

```
> @wise/backend@0.1.0 test:auth:integration
> jest --runInBand --testRegex '.*auth.integration.test.ts$'

PASS src/modules/auth/auth.integration.test.ts (13.528 s)
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
PASS src/modules/auth/universal-auth.integration.test.ts

Test Suites: 2 passed, 2 total
Tests:       14 passed, 14 total
Snapshots:   0 total
Time:        18.102 s, estimated 20 s
Ran all test suites.
```
