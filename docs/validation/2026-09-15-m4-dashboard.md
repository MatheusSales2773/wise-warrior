# Validação da issue 61 — gate do Dashboard universal

**Data do registro:** 17/09/2026
**Escopo:** quality gates M3/M4 e E2E Web real do Dashboard
**Branch:** `develop`

## Composição dos gates

Os atalhos na raiz são a fonte única dos comandos de aceite:

| Gate | Composição automatizada |
| --- | --- |
| `verify:m3:quality` | build, lint, testes unitários, migrations e integração de autenticação do backend; depois o `verify:m2` existente do frontend |
| `verify:m4:quality` | `verify:m3:quality`, lint OpenAPI e toda a integração do backend contra MySQL |
| `verify:m4` | `verify:m4:quality` e o E2E Web real |

O workflow executa a baseline M3, a quality gate M4 e, somente depois, o E2E
Web. Pull requests e pushes para `develop` e `main` usam o mesmo caminho.
O E2E não inclui QA nativo manual.

## Matriz de versões

Versões resolvidas no workspace no registro desta validação:

| Tecnologia | Versão |
| --- | --- |
| Node.js / npm | 22.22.3 / 10.9.8 (ambiente local; CI usa Node 22) |
| TypeScript (backend / frontend) | 5.9.3 / 6.0.3 |
| NestJS / TypeORM / MySQL2 / Socket.IO | 10.4.22 / 0.3.31 / 3.24.3 / 4.8.3 |
| React / React Native / React Native Web | 19.2.3 / 0.86.3 / 0.21.2 |
| Expo / Expo Router | 57.0.23 / 57.0.21 |
| TanStack Query / Jest / RNTL | 5.102.8 / 29.7.0 / 14.0.1 |
| Playwright / Redocly CLI | 1.63.0 / 2.53.2 |
| MySQL / Docker Compose | `mysql:8.0` / versão do runner (v5.1.2 local) |

Cada job de quality também imprime `node --version`, `npm --version`,
`npm ls --depth=0 --workspaces --include-workspace-root` e `docker compose
version` no log da CI.

As decisões de execução seguem a documentação oficial do [Playwright CI e
webServer](https://playwright.dev/docs/ci),
[Docker Compose — startup order](https://docs.docker.com/compose/how-tos/startup-order/),
[Jest 29.7 CLI](https://jestjs.io/docs/29.7/cli), [Redocly lint](https://redocly.com/docs/cli/commands/lint)
e [sintaxe de workflows do GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

## Evidência automatizada

### Backend e MySQL

- `apps/backend/src/modules/progression/progression.integration.test.ts` mantém
  o cenário `hydrates BIGINT as number and preserves two sequential XP credits`:
  dois créditos (`100` e `1.314`) são reidratados pelo MySQL como soma `1.414`
  e elevam o personagem ao nível 2.
- `apps/backend/src/migrations/migration.integration.test.ts` aplica e reverte
  as migrations em um schema vazio e verifica, com `EXPLAIN`, o índice
  `IDX_study_sessions_user_id_ended_at_id` na consulta de atividade recente.
- `apps/backend/src/modules/sessions/sessions.integration.test.ts` verifica
  atividade recente, estado vazio `200 []`, métricas, descarte e isolamento
  entre usuários.

### E2E Web

`apps/frontend/e2e/auth.spec.ts` e `apps/frontend/e2e/dashboard.spec.ts` executam
13 cenários Chromium com um contexto novo por teste. O Dashboard cobre:

- cadastro real, nível 1, `0 XP` e atividade vazia confirmada por `200 []`;
- criação e encerramento de uma Study Session pela API e observação após
  `Atualizar dados`;
- isolamento e limpeza de cache ao sair e cadastrar outra conta;
- falha parcial de `/sessions/recent` sem perder o perfil;
- access token expirado, uma única renovação por `/auth/refresh` e replay da
  consulta protegida.

Traces, vídeos, screenshots, `storageState` e relatórios do Playwright ficam em
caminhos ignorados e só podem ser anexados pela CI em caso de falha. Nenhum
desses artefatos faz parte do repositório.

## Resultados da execução

| Comando/evidência | Resultado registrado |
| --- | --- |
| `npm run verify:m3:quality` | Passou: backend 16 suítes/121 testes, migrations 2/2, auth integration 12/12, frontend 32 suítes/334 testes, Expo Doctor 21/21, bundles Web/iOS/Android e delivery smoke. |
| `npm run verify:m4:quality` | Passou: baseline M3, OpenAPI válido com um warning preexistente para `localhost` e integração MySQL 5 suítes/18 testes. |
| E2E Web real | Passou: 13/13 cenários Chromium com a imagem oficial `mcr.microsoft.com/playwright:v1.63.0-noble`; a stack Compose descartável foi removida ao final. |
| MySQL / EXPLAIN | Passou nos testes de integração: dois créditos XP sequenciais, `200 []`, isolamento por usuário e uso do índice de atividade recente. |

As execuções locais usaram `NODE_ENV=test`, `EXPO_NO_DOTENV=1` e uma URL pública
inválida não sensível; a CI registra essas versões e executa os mesmos gates em
serviço MySQL próprio.

## QA fora do comando automatizado

O gate não simula QA nativo. Permanecem como inspeção manual os cenários físicos
de VoiceOver/TalkBack, teclado, rotação, safe area, background/foreground,
Dynamic Type, pull-to-refresh e movimento reduzido, conforme o registro da
[issue 60](2026-09-17-issue-60-dashboard-layout.md).
