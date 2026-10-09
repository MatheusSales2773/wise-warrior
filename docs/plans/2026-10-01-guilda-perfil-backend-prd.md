# PRD — Concluir backend de Guilda, Raids e Personagem (Perfil)

**Data:** 01/10/2026
**Branch de origem:** `develop` (a partir do commit `6083dd9`)
**Escopo:** semanas 11–12 do `docs/cronograma.md` — Guildas (#11), notificações/WebSocket (#12), Raids (#18, #20), perfil/inventário/equipagem (#22), segurança (#13)
**Vocabulário:** Study Session, Character, Guild, Raid, Raid Contribution, Cosmetic Item e Session multi-dispositivo, conforme `docs/PRD.md`.

## 1. Contexto

A tela **Personagem** foi entregue em `feat/perfil-personagem` usando só o que o backend já expõe: perfil, progressão e a lista de dispositivos conectados. A tela **Guilda** continua como `PlaceholderScreen`, porque o backend não permite montá-la de forma útil. Este PRD lista o que falta nos módulos `guilds`, `raids`, `users` e `realtime` para fechar as duas telas, em fatias verticais (backend + OpenAPI + testes + frontend) que podem virar issues.

Os módulos existem, mas foram escritos para o scaffold da Fase 1 e nunca foram dimensionados para uma UI. O contrato atual (`docs/api/openapi.yaml`) cobre apenas `POST /guilds`, `GET /guilds/{id}`, `POST /guilds/{id}/members`, `GET /raids/{id}`, `GET /raids/{id}/ranking` e `POST /raids/{id}/join`.

## 2. Diagnóstico do que existe

### 2.1 Guildas (`apps/backend/src/modules/guilds`)

| Capacidade | Estado |
|---|---|
| Criar guilda (`POST /guilds`), líder automático | pronto |
| Detalhe por id (`GET /guilds/:id`: nome, nível, `memberCount`) | pronto |
| Entrar (`POST /guilds/:id/members`), idempotente | pronto, mas sem convite, limite de membros ou regra de guilda única |
| **Descobrir a própria guilda** | **ausente** — o cliente não tem como saber o `guildId` do usuário |
| **Listar/buscar guildas** | **ausente** |
| **Listar membros** (nome, nível, papel) | **ausente** — só existe `memberCount` |
| **Sair da guilda / transferir liderança** | **ausente** |
| Nível da guilda | a coluna existe, mas nada o altera |
| Chat (`guild-chat-message.entity.ts`) | só a entidade; é Fase 2 (ADR-004 e PRD §15) |

### 2.2 Raids (`apps/backend/src/modules/raids`)

| Capacidade | Estado |
|---|---|
| `GET /raids/:id`, ranking, contribuição vinda de `SessionsService` | pronto |
| **Criar raid** (semanal, UC02) | **ausente** — nenhum endpoint, job nem seed cria `Raid` |
| **Achar a raid ativa de uma guilda** | **ausente** — só há busca por id da raid |
| Participar (`POST /raids/:id/join`) | só valida e não persiste nada; a participação é "implícita na primeira contribuição" |
| Ranking | devolve `userId` e XP, **sem `displayName`** — a UI não consegue exibi-lo |
| Expiração | só calculada em tempo de leitura; `status` fica `active` para sempre se ninguém contribuir |
| **Autorização** | `GET /raids/:id` e `/ranking` aceitam **qualquer usuário autenticado**, mesmo de fora da guilda (vazamento entre guildas) |
| Evento `raid:progress` | emitido em `emitToGuild`, sem contrato AsyncAPI e sem cliente no app |

### 2.3 Personagem (`apps/backend/src/modules/users`)

| Capacidade | Estado |
|---|---|
| `GET /users/me`, `GET /users/me/sessions` | prontos e **já consumidos** pela tela |
| **Inventário** (itens desbloqueados + equipados) | **ausente** — `PATCH /users/me/cosmetics/:itemId` existe, mas não há como listar |
| Catálogo de cosméticos | **ausente** — a tabela `cosmetic_items` não tem seed nem endpoint |
| **Desbloqueio** | **ausente** — `unlockCondition` ("level:5", "raid:...") é só texto; nada insere em `user_cosmetic_items` |
| Desequipar | ausente (equipar só troca por item da mesma categoria) |
| Revogar dispositivo (`DELETE /users/me/sessions/:id`) | existe, mas devolve **401** para sessão inexistente (deveria ser 404) |
| `/users/me` não traz itens equipados nem data de criação | ausente |

### 2.4 Frontend / transporte

- `HttpClient` (`apps/frontend/src/core/api/api-client.ts`) só tem `get`, `post` e `patch`. Falta `delete`, necessário para revogar dispositivos e sair da guilda.
- O interceptor de sessão trata 401 como sessão expirada e tenta recuperar a autenticação. Hoje, revogar uma sessão inexistente (401) poderia derrubar o usuário. Corrigir o status no backend (3.3) evita isso.
- Não há cliente Socket.IO nem `asyncapi.yaml`.

## 3. Fatias propostas

Ordem pensada para que cada fatia entregue algo visível e para que a anterior destrave a próxima. Cada uma inclui contrato OpenAPI, migration quando houver mudança de schema, testes (unit + integração + e2e do fluxo) e o frontend correspondente.

### Fatia 1 — Minha guilda e descoberta (destrava a tela Guilda)

**Backend**
- `GET /guilds/me` → `{ guild: GuildDetail, role } | 404`, usando a membership do usuário.
- `GET /guilds?search=&cursor=&limit=` → guildas com `id`, `name`, `level`, `memberCount`. Paginação por cursor, `limit` máximo 20, ordenação estável.
- Regra de guilda única por usuário (decisão em 4.1): `POST /guilds` e `POST /guilds/:id/members` retornam 409 se o usuário já tem guilda. Índice único em `guild_memberships.user_id`, via migration.

**Frontend** (`features/guild/`, no padrão `api.ts` / `queries.ts` / `guild-screen.tsx`)
- Sem guilda: estado vazio com "Criar guilda" (formulário com `WiseField`, nome de 3 a 60 caracteres) e "Buscar guildas".
- Lista de busca com "Entrar".

**Aceite:** um usuário novo cria uma guilda, recarrega a página e a vê; um segundo usuário a encontra pela busca e entra; tentar entrar numa segunda guilda mostra erro claro.

### Fatia 2 — Membros e saída

**Backend**
- `GET /guilds/:id/members` → `{ userId, displayName, level, title, role, joinedAt }[]`; restrito a membros da guilda (403 caso contrário).
- `DELETE /guilds/:id/members/me` → sair. Se o líder sair, a liderança passa ao membro mais antigo; se era o último, a guilda é encerrada (decisão em 4.2).

**Frontend:** seção "Membros" na tela, com papel visível, e botão "Sair da guilda" com confirmação (precisa de `delete` no `HttpClient`, ver 3.5).

### Fatia 3 — Raids: criação, raid ativa e autorização

**Backend**
- Criação de raid semanal. Opções em 4.3; recomendação: job agendado (`@nestjs/schedule`) que cria uma raid por guilda por semana, mais `POST /guilds/:id/raids` só para o líder em ambiente de teste.
- `GET /guilds/:id/raids/active` → raid ativa ou 404.
- **Autorização:** `GET /raids/:id` e `/ranking` exigem ser membro da guilda da raid (403). Este é um bug de segurança e vai também na fatia de #13.
- Transição `active → expired` por job, não só calculada em leitura.
- `GET /raids/:id/ranking` passa a devolver `displayName` e `level`.
- `POST /raids/:id/join` deixa de ser no-op: persiste participação (tabela `raid_participations`) para a UI mostrar "Você está nesta raid" antes da primeira contribuição. Ou então é removido do contrato (decisão em 4.4).

**Frontend:** card da raid ativa com título, `ProgressBar` de `progressXp/goalXp`, tempo restante, ranking e botão "Participar". A Forja já aceita `mode: 'guild'` + `raidId` no início da sessão; ligar o seletor "Sessão de guilda" à raid ativa.

### Fatia 4 — Tempo real da guilda

- Escrever `docs/api/asyncapi.yaml` (já listado como pendente no PRD §7.5) com `raid:progress` e `level-up`.
- Cliente Socket.IO no frontend (`core/realtime/`), autenticado com o access token e com reconexão após refresh de token (ADR-009), atualizando o cache do TanStack Query ao receber `raid:progress`.
- Teste de integração: contribuição em uma sessão atualiza o card em outro dispositivo sem recarregar.

### Fatia 5 — Inventário e equipagem do Personagem

**Backend**
- Seed versionado de `cosmetic_items` (migration) com ao menos um item por categoria (`avatar`, `badge`, `title`, `accessory`).
- Serviço de desbloqueio: ao subir de nível (`ProgressionService`) e ao concluir raid, avalia `unlockCondition` (`level:N`, `raid:slug`) e insere em `user_cosmetic_items`, de forma idempotente e dentro da transação já existente.
- `GET /users/me/cosmetics` → catálogo com `unlocked`, `equipped`, `requiresPremium` e `unlockCondition` dos bloqueados.
- `DELETE /users/me/cosmetics/:itemId/equipped` (desequipar).
- `GET /users/me` passa a incluir `equipped: { category, itemId, name }[]`.

**Frontend:** seção "Inventário" na tela Personagem, em grade por categoria, com item bloqueado mostrando a condição e item premium mostrando o selo; equipar/desequipar com atualização otimista e rollback; erro 403 premium com mensagem própria (ADR-007).

### Fatia 6 — Gestão de dispositivos (complementa a tela já entregue)

- Backend: `DELETE /users/me/sessions/:id` devolve **404** (não 401) para sessão inexistente ou de outro usuário; `OpenAPI` documenta o 404.
- Frontend: `delete` no `HttpClient` (e no `createSessionAwareHttpClient`), botão "Encerrar" por dispositivo e "Sair de todos os dispositivos". Revogar o dispositivo atual, ou todos, chama o `logout()` do `AuthContext` em vez de só invalidar a lista.

### Fatia 7 — Edição de perfil e conquistas (UC03/UC04, menor prioridade)

- `PATCH /users/me` (`displayName`) com validação e rate limit.
- Conquistas do UC04: modelo `achievements` + `user_achievements`, regras mínimas (primeira sessão, sequência de 7 dias, primeira raid concluída) e seção "Conquistas" na tela.
- Pode escorregar para a Fase 2 sem bloquear o MVP.

## 4. Decisões do time

Fechadas em sessão de grilling em 08/10/2026. Glossário em `CONTEXT.md` (seção Guilda e Raid).

1. **Guilda única por usuário:** sim, com índice único em `guild_memberships.user_id` (entregue na Fatia 1).
2. **Fim da guilda quando o último membro sai:** a guilda é apagada, e suas raids vão junto; as Study Sessions mantêm o histórico (entregue na Fatia 2).
3. **Origem das raids:** um job semanal cria uma raid por guilda, de segunda 00:00 a domingo 23:59:59 em `America/Sao_Paulo`. A meta é de 1.500 XP por membro, congelada na criação. Uma guilda criada no meio da semana ganha a raid na hora, com meta proporcional aos dias restantes. O título vem da **Missão** da semana, escolhida por rodízio igual para todas as guildas. Escolher Missões compradas na Loja fica para o futuro.
4. **`POST /raids/:id/join`:** persiste a participação (UC02 e #18). A Forja oferece "Participar e iniciar" numa ação só.
5. **Nível da guilda:** começa em 1 e sobe um nível a cada raid com Meta batida.
6. **Entrada em guilda:** aberta. Convite fica para a Fase 2.
7. **Meta batida antes do fim da semana:** a raid continua aceitando contribuições até `endsAt`, e o resultado é fechado só no fim.
8. **Ranking interno:** é o ranking de contribuição da raid da semana; não existe outro.
9. **Recompensa de raid:** o Cosmetic Item da Missão (`raid:<slug>`), dado no fim da raid com Meta batida a cada participante que ainda é membro e tem pelo menos uma contribuição.

## 5. Fora de escopo

Chat de guilda e notificações push (Fase 2, ADR-004), Companheiro (ADR-004), gateway de pagamento (ADR-007), moderação de guildas e transferência de liderança manual.

## 6. Critérios transversais de qualidade

- Cada endpoint novo entra em `docs/api/openapi.yaml` (`npm run lint:openapi` limpo) e tem teste de integração contra MySQL no padrão `*.integration.test.ts` já usado.
- Mudanças de schema só via migration versionada; o teste `migration.integration.test.ts` deve continuar passando, incluindo downgrade.
- Autorização por guilda testada com um usuário de fora (403) em todo endpoint novo e nos existentes de `raids`.
- Frontend: cada tela com estados de carregamento, erro com "Tentar novamente", vazio e atualização parcial, como em `dashboard-screen.tsx`; testes de componente e um spec Playwright por fluxo crítico em `apps/frontend/e2e/`.
- Acessibilidade: rótulos e papéis semânticos como no Dashboard; sem cor como único indicador.
- Gate local antes de PR: `npm run verify:quality`. No GitHub, as issues seguem `docs/agents/issue-tracker.md` e entram com o label `needs-triage`.

## 7. Sequenciamento sugerido

| Semana | Fatias |
|---|---|
| 11 (16–22/10) | 1, 2, 6 e o início da 3 (autorização) |
| 12 (23–29/10) | 3, 4, 5; a 7 só se sobrar tempo |

Como a 1 destrava a tela Guilda inteira e a 3 corrige um vazamento de dados entre guildas, essas duas são as de maior valor e risco.
