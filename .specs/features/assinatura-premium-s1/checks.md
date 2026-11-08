# Assinatura premium S1 (#354) checks

Build: `npm run build --workspace apps/backend`; `npm run lint --workspace apps/backend`; `npm run typecheck --workspace apps/frontend`; `npm run lint --workspace apps/frontend`
Run unit: `npm run test --workspace apps/backend -- --verbose src/modules/users/domain/unlock-condition.spec.ts src/modules/users/domain/for-sale.spec.ts src/modules/users/users.service.spec.ts`
Run int: `npm run test:integration --workspace apps/backend -- --verbose src/modules/users/cosmetics-equip.integration.test.ts src/migrations/migration.integration.test.ts`
Run web: `npm run test --workspace apps/frontend -- --verbose __tests__/character-catalog.test.tsx`
Plan: `.specs/features/assinatura-premium/plan.md` (shared by the slices S1-S9; this folder holds only S1)

## Intent

Issue #354 (parent #353), slice S1 of the approved plan `assinatura-premium`: os 3 Itens premium ✦
("Manto do Arquimago" avatar, "Cajado Astral" weapon, "Lenda do Foco" title, todos `level:1` e
`requires_premium = 1`) passam a estar no Inventário de todo Character, desequipados, e bloqueados
para `free` quando a cobrança (`STRIPE_SECRET_KEY`) está configurada. O Item inicial passa a ser
`level:1` e não premium. A gaveta mostra o selo "Plano premium" e cada item desenha o sprite próprio.

Fora desta fatia, por decisão do usuário: os itens do Pacote do Dragão ("Elmo de Escamas", "Presa do
Dragão", "Amuleto de Brasa") são da #360, que corre em paralelo noutro agente; a S1 não os cria nem
desenha seus sprites. O mecanismo de sprite por nome serve a eles sem mudança.

12 checks in 1 slice · 0 one-way doors beyond the plan's door 3 (ids fixos do seed) · 0 open

## Checks

### S1 - Itens premium no Inventário de todo Character

**C1** - Um cadastro novo ganha "Manto do Arquimago", "Cajado Astral" e "Lenda do Foco" com `equipped = false`, e fica equipado com "Aprendiz" (Título), "Capuz do Erudito" (Avatar) e "Espada" (Arma), nunca com os premium (AC S1.1)
Proof: run int | ✓ gives a new Character the three premium items unequipped and equips only the non-premium starters

**C2** - `isStarterItem` é falso para um item `level:1` premium e verdadeiro para um `level:1` não premium (AC S1.1)
Proof: run unit | ✓ does not mark a premium level-1 item as a starter item

**C3** - A migration dá os 3 Itens premium desequipados a cada Character existente, e o Character de nível 20 com "Mestre da Aurora" equipado continua com ele equipado (AC S1.2)
Proof: run int | ✓ seeds the three premium items unequipped for every existing Character and keeps what is equipped

**C4** - Rodar a migration de novo não duplica e não desequipa nada, e o `down` remove os 3 itens (AC S1.2)
Proof: run int | ✓ seeds the premium items idempotently and removes them on revert

**C5** - Com `STRIPE_SECRET_KEY` definido e `COSMETICS_PREMIUM_FOR_ALL=true`, um usuário `free` que equipa um Item premium recebe `403` "Item exclusivo do plano premium" e nada muda no equipamento (AC S1.3)
Proof: run int | ✓ answers 403 to a free user on a premium item when billing is configured, even with the policy flag true

**C6** - Sem `STRIPE_SECRET_KEY` e com a flag `true`, o usuário `free` equipa o Item premium como hoje (AC S1.3)
Proof: run int | ✓ lets a free user equip a premium item while the MVP policy releases it to everyone

**C7** - Com `STRIPE_SECRET_KEY` definido, um usuário `premium` equipa o Item premium (AC S1.3)
Proof: run int | ✓ lets a premium user equip a premium item when billing is configured

**C8** - Um item premium, ou de Condição `pack:dragao`, não pode ser posto À venda: o domínio devolve o motivo e o CHECK do banco recusa o INSERT (AC S1.4)
Proof: run unit | ✓ refuses a Pacote item for sale
Proof: run int | ✓ refuses to put a premium or Pacote item for sale at the database

**C9** - A gaveta mostra os Itens premium para `free` com a legenda "Plano premium", nunca "Avatar inicial", "Título inicial" ou "Arma inicial", também quando o item já está equipado (AC S1.5)
Proof: run web | ✓ captions a premium level-1 item "Plano premium" and never "inicial"

**C10** - "Manto do Arquimago", "Cajado Astral" e "Lenda do Foco" têm sprite próprio, diferente do padrão da categoria (AC S1.6)
Proof: run web | ✓ draws the premium items with their own sprite, not the category default

**C11** - A camada de Avatar do Herói com "Manto do Arquimago" equipado é diferente da do "Capuz do Erudito", e "Cajado Astral" tem camada de Arma própria (AC S1.6)
Proof: run web | ✓ draws the Herói layers of the premium Avatar and Arma, different from the initial ones
Proof: run web | ✓ draws the Cajado Astral weapon layer on the Herói, apart from the Cajado layer

**C12** - O Catálogo (`GET /users/me/cosmetics`) de um cadastro novo traz os 3 itens com `requiresPremium: true`, `unlocked: true` e `equipped: false` (AC S1.1, leitor)
Proof: run int | ✓ lists the three premium items in the Catalog of a new Character as unlocked, unequipped and premium

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| Itens premium do seed (3) | Manto do Arquimago C1 C3 C10 C11 · Cajado Astral C1 C3 C10 C11 · Lenda do Foco C1 C3 C10 | - |
| categorias equipadas no cadastro (3) | avatar C1 · title C1 · weapon C1 | - |
| `PATCH /users/me/cosmetics/:id` para Item premium, por plano e cobrança (4) | free+cobrança+flag true C5 · free+sem cobrança+flag true C6 · premium+cobrança C7 · free+cobrança+flag false C5 (existente: `answers 403 to a free user on a premium item once the policy flag is off`) | - |
| regra À venda recusada (3) | premium `level:1` C8 · premium `purchase` C8 · `pack:dragao` C8 | - |
| legendas da gaveta para premium (3 categorias) | avatar C9 · title C9 · weapon C9 | - |
| lugares que leem `isStarterItem`/inicial (2) | `grantStarterInventory` C1 C2 · `ownedCaption` do `catalog.ts` C9 | - |

## Swept

- validation: existing - `forSaleViolation` e o CHECK `CHK_cosmetic_items_for_sale` recusam À venda premium; C8 prova também `pack:`
- failure modes: C3 (a migration roda numa só transação por statement idempotente; rodar de novo é C4)
- idempotency: C4
- authorization: C5, C6, C7
- concurrency: existing - `equipCosmeticItem` trava a linha do usuário (`ends with exactly one item equipped per category when equips race in the same category`)
- data lifecycle: C3, C4 (backfill, e `down` remove os itens e suas linhas de Inventário por `ON DELETE CASCADE`)
- dependency failure: n/a - a S1 não chama o Stripe; só lê se `STRIPE_SECRET_KEY` está definido
- state transitions: n/a - desequipar ao fim da Assinatura é a S2
- observability: n/a - sem requisito de log nesta fatia

## Out of scope

| Excluded | Why |
| --- | --- |
| Itens do Pacote do Dragão e seus sprites | #360, em paralelo noutro agente; decisão do usuário |
| Condição `pack:<slug>` em `parseUnlockCondition` e no Catálogo | S6.4 (#360); a S1 só prova que `pack:dragao` já não pode ir À venda |
| Desequipar ao fim da Assinatura, `BillingModule` | S2 (#355) |
| Glossário, OpenAPI e ADR | S9 (#359) |
| Arte final do Figma | Fallback aprovado no plano: recoloração dos sprites existentes até a arte ser aprovada |

## Handoff

- **Settled mid-build:** user: "A S1 não cria os itens do Pacote do Dragão, que são da #360."
- **Dispatched:** Verifier at `c518417` (fresh sub-agent) `returned`, screens: n/a - no capture
- **Boundary:** C1-C12 closed at `f29f271`
- **Abandoned:** nothing. Condição `pack:` em `parseUnlockCondition` fica para a #360 (S6.4); `pack:dragao` já é recusado À venda por não ser `purchase`.
- **Walked:** not walked in a browser: no capture binds this slice and the drawer is covered by C9-C11 tests. Steps for the user: run the backend with `STRIPE_SECRET_KEY` set, open Personagem > gaveta de Avatar/Arma/Título as a `free` user and check that "Manto do Arquimago", "Cajado Astral" and "Lenda do Foco" read "Plano premium" and are disabled.
