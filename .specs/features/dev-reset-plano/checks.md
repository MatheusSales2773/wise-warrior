# Seção Desenvolvedor: voltar ao plano Free checks

Build: `npx tsc --noEmit -p apps/backend/tsconfig.json`; `npm run lint --workspace apps/backend`; `npm run lint --workspace apps/frontend`; `npm run lint:openapi`
Run unit: `npm run test --workspace apps/backend -- src/shared/dev-tools src/modules/users/users.service.spec.ts --verbose`
Run api: `TEST_DB_PORT=3327 npm run test:integration --workspace apps/backend -- --testPathPattern 'billing-dev-reset|rename-http|billing-webhook' --verbose`
Run app: `npm test --workspace apps/frontend -- __tests__/settings-screen.test.tsx --verbose`
Plan: `.specs/features/dev-reset-plano/plan.md`

40 checks in 4 slices · 3 one-way doors · 0 open, 0 block

## Checks

### S1 - Rota de reset liberada só por DEV_TOOLS_EMAILS

**C1** - Um e-mail está liberado só se igual a um item da lista, sem espaços nem maiúsculas; vazia, `,` ou ausente libera ninguém (AC 1)
Proof: run unit | ✓ DEV_TOOLS_EMAILS=" Dev@Ex.com , b@ex.com" and e-mail "dev@ex.com" is true

**C2** - `devx@ex.com` não é liberado por `dev@ex.com` (AC 1)
Proof: run unit | ✓ DEV_TOOLS_EMAILS=" Dev@Ex.com , b@ex.com" and e-mail "devx@ex.com" is false

**C3** - Lista `,` e lista vazia liberam ninguém (AC 1)
Proof: run unit | ✓ DEV_TOOLS_EMAILS="," and e-mail "dev@ex.com" is false

**C4** - Variável ausente libera ninguém (AC 1)
Proof: run unit | ✓ DEV_TOOLS_EMAILS=undefined and e-mail "dev@ex.com" is false

**C5** - Não liberado recebe 404 sem chamar o Stripe, mesmo com Assinatura ativa (AC 2)
Proof: run api | ✓ answers 404 without calling Stripe to a user that is not listed, even with an active Subscription

**C6** - Não liberado recebe 404, não 503, com a cobrança desligada (AC 2)
Proof: run api | ✓ answers 404, not 503, to a user that is not listed when billing is not configured

**C7** - Não liberado sem Assinatura recebe 404, não 409 (AC 2)
Proof: run api | ✓ answers 404, not 409, to a user that is not listed and has no Subscription

**C8** - Sem token a rota responde 401 (AC 3)
Proof: run api | ✓ answers 401 without a token

**C9** - Liberado sem `STRIPE_SECRET_KEY` recebe 503 "Assinatura indisponível no momento" (AC 4)
Proof: run api | ✓ answers 503 to a listed user when billing is not configured

**C10** - Liberado sem linha recebe 409 "Nenhuma assinatura para cancelar" sem chamar o Stripe (AC 5)
Proof: run api | ✓ answers 409 without calling Stripe to a listed user that has no row

**C11** - Linha só com Customer recebe 409 (AC 5)
Proof: run api | ✓ answers 409 without calling Stripe to a listed user that has a row with only the Customer

**C12** - Status `canceled` recebe 409 (AC 5)
Proof: run api | ✓ answers 409 without calling Stripe to a listed user that has a canceled Subscription

**C13** - `active` responde 202 sem corpo e cancela a `stripe_subscription_id` (AC 6)
Proof: run api | ✓ answers 202 with no body and cancels now the Subscription of a listed user that is active

**C14** - `trialing` responde 202 e cancela (AC 6)
Proof: run api | ✓ answers 202 with no body and cancels now the Subscription of a listed user that is trialing

**C15** - `past_due` responde 202 e cancela (AC 5, AC 6)
Proof: run api | ✓ answers 202 with no body and cancels now the Subscription of a listed user that is past_due

**C16** - Cancela a Assinatura de quem chama, não a de outro usuário (AC 6)
Proof: run api | ✓ cancels the Subscription of the caller, not of another user

**C17** - Depois do 202, `plan_tier` e `subscriptions` ficam como estavam (AC 7)
Proof: run api | ✓ writes nothing on a 202: the plan and the row stay as they were

**C18** - Falha do Stripe responde 502 "Não foi possível cancelar a assinatura", loga o id do usuário e mantém a linha (AC 8)
Proof: run api | ✓ answers 502, logs the user id and keeps the row when Stripe fails to cancel

**C19** - O webhook `canceled` grava free (AC 9)
Proof: run api | ✓ writes canceled and turns the plan free when the payload says active and the API says canceled

**C20** - Ao virar free, os Itens premium ✦ saem do equipamento e o Pacote fica (AC 9)
Proof: run api | ✓ puts the Título back to Aprendiz, empties a category with no Item inicial, restores the Item inicial of Arma and keeps a Pacote item

**C21** - Ao cancelar, `user:planChanged` é emitido uma vez com `free`, depois do commit (AC 9)
Proof: run api | ✓ is emitted once with free, after the commit, when the Subscription is deleted

### S2 - devTools no perfil

**C22** - `GET /users/me` e `PATCH /users/me` respondem `devTools` true ao liberado e false aos demais, nos dois verbos (AC 10, 11, 12)
Proof: run api | ✓ answers devTools true to a listed user and false to the others, on GET and PATCH

**C23** - O perfil deriva `devTools` de `DEV_TOOLS_EMAILS` e sem `ConfigService` é false (AC 10, 11)
Proof: run unit | ✓ answers devTools for dev@wise.app from DEV_TOOLS_EMAILS (true)
Proof: run unit | ✓ answers devTools false when no ConfigService is provided

### S3 - Seção Desenvolvedor em Configuração

**C24** - Menu e lista mostram Desenvolvedor por último, com a descrição (AC 13)
Proof: run app | ✓ AC13: lists Desenvolvedor last in the desktop menu, before Sair da conta, and describes it

**C25** - A lista do celular tem o grupo próprio por último (AC 13)
Proof: run app | ✓ AC13: lists Desenvolvedor in its own last group of the phone list

**C26** - Sem `devTools`, ou com o perfil carregando, a seção não aparece (AC 14)
Proof: run app | ✓ AC14: keeps Desenvolvedor out of the menu and the list when devTools is false
Proof: run app | ✓ AC14: keeps Desenvolvedor out while the profile has not loaded
Proof: run app | ✓ AC14: keeps Desenvolvedor out of the phone list while the profile has not loaded

**C27** - Sem `devTools`, `/configuracao/dev` leva a `/configuracao` (AC 15)
Proof: run app | ✓ AC15: takes an account without devTools from /configuracao/dev to /configuracao

**C28** - Premium mostra "Plano atual" como a seção Plano e o botão (AC 16)
Proof: run app | ✓ AC16: shows "Plano atual" as the Plano section does, and the button, while premium

**C29** - Free mostra "Free" e esconde o botão (AC 17)
Proof: run app | ✓ AC17: shows Free and no button while the plan is free

**C30** - Tocar no botão abre o diálogo com o texto e não chama a rota (AC 18)
Proof: run app | ✓ AC18: asks first, with the dialog copy, and calls nothing

**C31** - "Voltar" fecha o diálogo sem chamar a rota (AC 19)
Proof: run app | ✓ AC19: Voltar closes the dialog and calls nothing

**C32** - "Cancelar assinatura" chama a rota uma vez, mostra carregamento, fecha e avisa (AC 20)
Proof: run app | ✓ AC20: confirming calls the route once, shows loading, then closes the dialog and says the plan comes back

**C33** - `user:planChanged` troca a seção para Free sem recarregar (AC 21)
Proof: run app | ✓ AC21: shows Free without reloading when user:planChanged arrives
Proof: run app | ✓ AC20, AC21: the cancel notice goes away once the plan is Free

**C34** - 409, 502 e 503 mostram o `detail` do servidor e fecham o diálogo (AC 22)
Proof: run app | ✓ AC22: closes the dialog and shows the server detail of a 409
Proof: run app | ✓ AC22: closes the dialog and shows the server detail of a 502
Proof: run app | ✓ AC22: closes the dialog and shows the server detail of a 503

**C35** - Outro erro mostra a linha genérica (AC 22)
Proof: run app | ✓ AC22: shows the generic line for any other error

**C36** - Carregando e erro do plano são os da seção Plano, com "Tentar novamente" (AC 23)
Proof: run app | ✓ AC23: shows the Plano loading indicator, then the Plano error with "Tentar novamente"

### S4 - Configuração e contratos

**C37** - `docker-compose.yml` repassa `DEV_TOOLS_EMAILS: ${DEV_TOOLS_EMAILS:-}` ao backend (AC 24)
Proof: `grep -qF 'DEV_TOOLS_EMAILS: ${DEV_TOOLS_EMAILS:-}' docker-compose.yml`

**C38** - `.env.example` documenta `DEV_TOOLS_EMAILS` (AC 25)
Proof: `grep -q '^DEV_TOOLS_EMAILS=' apps/backend/.env.example && grep -q 'Vazia libera ninguém' apps/backend/.env.example && grep -q 'Só para staging' apps/backend/.env.example`

**C39** - O OpenAPI descreve a rota com 202, 401, 404, 409, 502 e 503 e `devTools` no perfil, e o lint passa (AC 26)
Proof: `npm run lint:openapi && for c in 202 401 404 409 502 503; do awk '/^  \/billing\/dev\/reset-plan:/{f=1;next} /^  \//{f=0} f' docs/api/openapi.yaml | grep -q "\"$c\":" || exit 1; done && awk '/^    UserProfile:/{f=1;next} /^    [A-Z]/{f=0} f' docs/api/openapi.yaml | grep -c 'devTools' | grep -qv '^0$'`

**C40** - O `AppModule` real continua subindo com a rota e o `UsersService` novos: a suíte de auth, que o sobe, fica verde (AC 2, 10)
Proof: `TEST_DB_PORT=3327 npm run test:auth:integration --workspace apps/backend`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `DEV_TOOLS_EMAILS` examples, AC 1 (5) | liberado com espaços/maiúsculas C1 · `devx` C2 · vazia C3 · `,` C3 · ausente C4 | - |
| `POST /billing/dev/reset-plan` statuses (6) | 202 C13 · 401 C8 · 404 C5 · 409 C10 · 502 C18 · 503 C9 | - |
| 409 cases, AC 5 (4) | sem linha C10 · só Customer C11 · canceled C12 · past_due segue C15 | - |
| 202 statuses, AC 6 (3) | active C13 · trialing C14 · past_due C15 | - |
| one-way doors, Landing (3) | env var C1-C5 · `devTools` C22 · `subscriptions.cancel` C13 | - |
| `GET`/`PATCH /users/me` (2) | GET C22 · PATCH C22 | - |
| source controls (0) | no binding capture | - |
| startup config: `DEV_TOOLS_EMAILS` (3 places) | docker-compose C37 · `.env.example` C38 · `ConfigService` read by UsersService C23 | - |

## Swept

- validation: C1-C4
- failure modes: C18
- idempotency: n/a - o Stripe responde uma assinatura já cancelada com erro, que vira 502; a segunda chamada cai antes em 409 quando o webhook já gravou `canceled`
- authorization: C5, C6, C7, C8
- concurrency: n/a - ferramenta de uma pessoa; duas chamadas seguidas viram um 202 e, depois, 409/502 sem gravação
- data lifecycle: C17, C20
- dependency failure: C18
- state transitions: C12, C19
- observability: C18

## Handoff

- **Settled mid-build:** none
- **Dispatched:** Verifier at `e0700e9` (screens: n/a, no capture binds)
- **Boundary:** C1-C39 closed at `8de9d6e`
- **Abandoned:** nothing
- **Walked:** no browser walk yet; no capture binds this feature, so no picture: the section is proven by the C24-C36 tests
