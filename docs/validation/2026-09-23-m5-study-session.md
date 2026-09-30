# Validação parcial da issue 74 — Study Session solo

**Data:** 23/09/2026

**Branch:** `feat/issue-74-luna`

**Status:** parcial; não fechar a issue até executar MySQL, E2E e QA nativo.

**Escopo:** esta entrega verifica Study Session solo, online e em primeiro plano;
não adiciona dependência de runtime nem implementa matéria, controle por outra
Session, background/offline, descanso Pomodoro, Guilda, Raid ou Perfil. `mysql2`
é dependência de desenvolvimento do workspace frontend para a fixture E2E que
prepara dados somente na stack Compose descartável.

## Matriz curta do contrato

| Operação | Entrada | Sucesso | Erros relevantes |
| --- | --- | --- | --- |
| `POST /sessions` | `Idempotency-Key`; duração opcional `900/1500/3000` (padrão `1500`) | `201` com snapshot | `400`; `409 study-session-active` ou `idempotency-key-reused` |
| `GET /sessions/active` | Bearer | `200` com snapshot e `canControl`, ou `204` | `401` |
| `POST /sessions/{id}/{pause,resume,stop}` | Bearer, `Idempotency-Key`, `expectedVersion` | `200` com snapshot canônico | `404` indistinguível para id ausente/alheio; `409` estável por conflito |
| `POST /sessions/{id}/complete` | Bearer, `Idempotency-Key`, `expectedVersion` para Study Session canônica | `200` com snapshot canônico; compatibilidade legada documentada | `404` indistinguível; `409` estável por conflito |
| `PATCH /sessions/{id}/heartbeat` | Bearer | `204` | `404` oculto; `409` se outra Session tentar controlar |
| `GET /sessions/recent`, `GET /sessions/metrics` | Bearer | `200` | `401` |

O snapshot não serializa `initiatingSessionId`; em M5, `subject` é `null`.
O controller preserva os códigos documentados. A revisão do OpenAPI cobriu os
presets, cabeçalho, versão esperada, conflitos, schemas e exemplos; o lint é
válido com um warning já existente para o servidor local `localhost`.

## Gate e versões

`verify:m5:quality` compõe `verify:m4:quality`, que já inclui build, lint,
testes unitários, migrações, integração de autenticação, typecheck e export
universal, lint OpenAPI e integração do backend. `verify:m5` adiciona o E2E Web
real. A CI chama `npm run verify:m5` e publica artefatos Playwright em falha.

Versões registradas após `npm ci`:

| Tecnologia | Versão |
| --- | --- |
| Node.js / npm | 22.22.3 / 10.9.8 |
| NestJS / TypeORM / MySQL2 | 10.4.22 / 0.3.31 / 3.24.3 |
| MySQL / Docker Compose | `mysql:8.0` / 5.1.2 |
| TypeScript backend / frontend | 5.9.3 / 6.0.3 |
| React / React Native / Expo / Expo Router | 19.2.3 / 0.86.3 / 57.0.24 / 57.0.22 |
| TanStack Query / Jest / RNTL / Playwright | 5.102.8 / 29.7.0 / 14.0.1 / 1.63.0 |
| Redocly CLI | 2.53.2 |

As decisões sensíveis à versão seguiram a [documentação TypeORM 0.3 de
transações](https://typeorm.io/docs/advanced-topics/transactions/) e [locks no
QueryBuilder](https://typeorm.io/docs/query-builder/select-query-builder/), o
[locking read do MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html), a
[sintaxe de triggers do MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/triggers.html) e a
[semântica de `INSERT IGNORE`](https://dev.mysql.com/doc/refman/8.0/en/insert.html), a
[documentação oficial do cliente MySQL2 Promise](https://sidorares.github.io/node-mysql2/docs/examples/connections/create-connection), a
[referência do Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), o
[React Native 0.86](https://reactnative.dev/docs/0.86/components-and-apis), o
[TanStack Query para React Native](https://tanstack.com/query/latest/docs/framework/react/react-native),
o [lint Redocly](https://redocly.com/docs/cli/commands/lint),
o [Playwright 1.63](https://playwright.dev/docs/clock) e a
[sintaxe GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

## Resultados automatizados

| Comando/evidência | Resultado |
| --- | --- |
| `npm ci` | Passou: 1.503 pacotes adicionados; o audit reportou 39 vulnerabilidades e nenhuma correção automática foi aplicada. A tentativa `npm ci --offline` não encontrou `type-fest@0.20.2`; a repetição autorizada com acesso ao registry concluiu. |
| `npm run build --workspace apps/backend` e `npm run lint --workspace apps/backend` | Passaram. |
| `npm test --workspace apps/backend` | 21 suítes, 160 testes passaram. Os dois testes HTTP que fazem bind em loopback precisaram da permissão de loopback do executor. |
| `npm run typecheck --workspace apps/frontend` e `npm run lint --workspace apps/frontend` | Passaram. |
| `npm run verify:m1 --workspace apps/frontend` (como parte de `verify:m2`) | Typecheck, lint, 36 suítes/362 testes, `expo install --check`, Expo Doctor 21/21 e bundles Web/iOS/Android passaram. |
| `npm run build --workspace apps/frontend` | Export Web passou. |
| `npm run test:e2e --workspace apps/frontend -- --list` | Descobriu 15 cenários Playwright, incluindo o fluxo novo com XP e a preservação do cancelamento; não executou navegador/serviços. |
| `npm run lint:openapi` | Válido; um warning de `localhost` em `docs/api/openapi.yaml:13`. |
| `npm run verify:m5:quality` | Parcial. Build, lint e 160 testes unitários passaram; a execução parou na migration test porque `127.0.0.1:3306` recusou conexão. Nenhum teste de migration ou integração MySQL foi concluído. |
| `npm run verify:m2 --workspace apps/frontend` | Typecheck, lint, 362 testes, Expo Doctor e exports multiplataforma passaram. O comando foi interrompido no smoke `test:delivery` porque o socket OrbStack não respondeu ao Docker CLI. |
| `docker info` e `docker compose up -d --wait mysql` | Não concluídos: o socket `~/.orbstack/run/docker.sock` não disponibilizou o daemon, mesmo com a tentativa de execução autorizada. |
| `npm run verify:m5` / E2E Web real | O comando exato foi iniciado. Parou na migration test pelo mesmo `ECONNREFUSED 127.0.0.1:3306`, antes do restante da qualidade e do E2E. CI ainda não foi executada; link ficará disponível após abrir o PR. |

`npm run verify:m5:quality` foi iniciado com `EXPO_NO_DOTENV=1`,
`EXPO_PUBLIC_API_URL=https://api.ci.invalid/v1` e `TEST_DB_*` apontando para
`127.0.0.1:3306` (`root`/`root`), como na CI. O erro ocorreu antes da bateria
de integrações. O E2E usa somente a porta `E2E_DB_PORT` da stack Compose
descartável para mover `started_at` e `run_deadline_at` da sessão criada pela UI.

## QA manual não executado

- Web: não executados viewport móvel/desktop, teclado, foco, fonte ampliada,
  redução de movimento e verificação manual de anúncios assistivos; a stack
  autenticada depende do Docker indisponível.
- iOS: não executado. `xcrun simctl list devices booted` informou que o
  CoreSimulatorService está indisponível.
- Android: não executado. `adb` e `emulator` não estão instalados.
- CI: não executada; registrar o link depois da abertura do PR.

Os exports nativos confirmam bundling, mas não substituem execução em dispositivo.
Esta validação não autoriza marcar a issue #74 como concluída até que o gate
MySQL/E2E e o checklist manual iOS/Android sejam realizados.
