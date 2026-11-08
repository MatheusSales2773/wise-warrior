# Assinatura premium - S6 checks (Pacote do Dragão listado)

Build: `npm run build --workspace apps/backend`; `npm run lint --workspace apps/backend`; `npm run typecheck --workspace apps/frontend`; `npm run lint --workspace apps/frontend`; `npm run lint:openapi`
Run unit: `npm test --workspace apps/backend -- src/modules/billing/domain src/modules/users/domain --verbose`
Run packs: `npm run test:integration --workspace apps/backend -- --testPathPattern billing-packs-http --verbose`
Run catalog: `npm run test:integration --workspace apps/backend -- --testPathPattern cosmetics-http --verbose`
Run migration: `npm run test:integration --workspace apps/backend -- --testPathPattern migration.integration --verbose`
Run frontend: `npm test --workspace apps/frontend -- __tests__/character-catalog.test.tsx --verbose`
Plan: `.specs/features/assinatura-premium/plan.md`

Issue #360 (`S6`). This file covers only S6; S1 and S2 were closed in their own runs and S3-S5, S7-S9 are other
issues. S6 creates door 2 (`packs`, `pack_payments`) and the Pacote half of door 3 (`pack:<slug>` and the seed of the
Pacote do Dragão with its 3 items). S7 writes `pack_payments`; here the tests insert a Pagamento directly. Tests run
against a MySQL 8.0 (`TEST_DB_*`) with a fake Stripe client, never against Stripe.

14 checks below · 2 one-way doors touched (2, 3) · 0 open questions

## Checks

### S6 - Pacote do Dragão listado

**C1** - With billing available, `GET /billing/packs` answers `200` with `available: true` and the Pacote do Dragão: `slug` `dragao`, `name` "Pacote do Dragão", the settled `description`, `priceCents: 490`, `currency: "brl"`, the 3 items `{ id, name, category }` (Elmo de Escamas avatar, Presa do Dragão weapon, Amuleto de Brasa accessory) and `owned: false` for a user who paid nothing (S6.1)
Proof: run packs | ✓ lists the Pacote do Dragão for sale with its price, its 3 items and owned false

**C2** - The Pacotes for sale come ordered by `name`: "Pacote Alfa", "Pacote do Dragão", "Pacote Zeta" (S6.1)
Proof: run unit | ✓ lists the Pacotes for sale ordered by name, each with owned false when the user paid none
Proof: run packs | ✓ orders the Pacotes for sale by name

**C3** - `owned` is per user: `true` for the user with a Pagamento of the Pacote, `false` for another user (S6.1)
Proof: run unit | ✓ marks owned only the Pacote the user paid
Proof: run packs | ✓ marks owned only for the user who paid the Pacote

**C4** - A Pacote with `for_sale = false` stays listed with `owned: true` for the user who paid it, and is absent for a user who did not (`packs: []`) (S6.2)
Proof: run unit | ✓ keeps a paid Pacote that left the shelf, owned, and drops an unpaid one off the shelf
Proof: run packs | ✓ keeps a paid Pacote listed as owned after it leaves the shelf, and hides it from who did not pay

**C5** - Without `STRIPE_SECRET_KEY`, `GET /billing/packs` answers `200` `{ "available": false, "packs": [] }`, even to a user who paid a Pacote (S6.3)
Proof: run packs | ✓ answers 200 with available false and no Pacote, even to a user who paid one

**C6** - `GET /billing/packs` without a token answers `401` (Surface)
Proof: run packs | ✓ answers 401 without a token

**C7** - `pack:dragao` parses to `{ type: 'pack', slug: 'dragao' }`; `pack:`, `pack:Dragão` and `pack:a b` are malformed; a Pacote condition is never unlocked by level, by Study Sessions or as an Item inicial (S6.4)
Proof: run unit | ✓ reads a Pacote condition with its slug
Proof: run unit | ✓ reads the malformed condition "pack:" as no condition
Proof: run unit | ✓ reads the malformed condition "pack:Dragão" as no condition
Proof: run unit | ✓ never unlocks a Pacote item by level, sessions or as an Item inicial

**C8** - `GET /users/me/cosmetics` returns the 3 Pacote items with `unlockCondition` `{ "type": "pack", "slug": "dragao" }`, `requiresPremium: false`, `forSale: false`, locked for a new user and unlocked once in the Inventário; the full Catálogo of a new user and of a level-12 Character lists them locked (S6.4)
Proof: run packs | ✓ returns the Pacote items in the Catálogo with the pack condition, locked until the Pacote is paid
Proof: run catalog | ✓ gives a new user the three starter items, equipped, and shows the rest of the Catalog locked
Proof: run catalog | ✓ unlocks every item up to the character level without duplicating it when the rule runs again

**C9** - The frontend captions an owned Pacote item "Do Pacote do Dragão" and lets a `free` plan wear it; a Pacote item the user does not own is captioned "Do Pacote do Dragão" too, locked (S6.4, settled mid-build)
Proof: run frontend | ✓ captions an owned Pacote item "Do Pacote do Dragão" and lets a free plan wear it
Proof: run frontend | ✓ captions a Pacote item the user does not own "Do Pacote do Dragão" too, locked

**C10** - A locked Pacote item orders with the items for sale (`lockedByPurchase`), ahead of the Raid items, and the category hint reads "Os itens desta categoria são comprados na Loja." (settled mid-build)
Proof: run frontend | ✓ orders and describes a locked Pacote item with the items for sale, ahead of the Raid items

**C11** - `GET /shop/items` lists none of the 3 Pacote items nor the 4 Itens premium, and the database refuses `for_sale = 1` on each of them (`CHK_cosmetic_items_for_sale`) (S6.5)
Proof: run packs | ✓ keeps the Pacote items and the Itens premium out of the Loja Itens section, and refuses to put them on sale

**C12** - The migration creates `packs` (slug unique, `price_cents > 0`) and `pack_payments` (one per user and Pacote, one per Checkout session, deleted with the user), seeds the Pacote do Dragão at 490 `brl` for sale and its 3 items with `pack:dragao`, not premium, not for sale; reverting drops both tables and the 3 items; the whole chain still applies and reverts (doors 2, 3)
Proof: run migration | ✓ creates packs and pack_payments with the Pacote do Dragão and its 3 items, one Pagamento per user, Pacote and session, and drops them on revert
Proof: run migration | ✓ applies every migration in order and reverts them all down to an empty schema

**C13** - The 3 Pacote items are drawn with the approved Figma art (Sprite/Avatar/Elmo de Escamas, Sprite/Arma/Presa do Dragão, Sprite/Acessório/Amuleto de Brasa and their Sprite/Item icons): each differs from its category default in the drawer, the Presa layer sits on the Figma pixels, and on the Herói each layer differs from the empty slot and from the nearest existing art (Armadura do Lobo, Espada, Selo dos Madrugadores)
Proof: run frontend | ✓ draws each Pacote item with its own sprite, not the category default
Proof: run frontend | ✓ places the Presa do Dragão layer exactly where the Figma sprite draws it
Proof: run frontend | ✓ draws the Elmo, the Presa and the Amuleto on the Herói, each different from the slot without it and from the nearest existing art

**C14** - Adding `Pack` and `PackPayment` to `BillingModule`'s `TypeOrmModule.forFeature` leaves the real `AppModule` bootable (ADR-001)
Proof: npm run test:auth:integration --workspace apps/backend

## Coverage

The other routes of the plan's Surface belong to other slices: `/api/v1/billing/webhook` (S2), `/api/v1/billing/subscription` (S5), `/api/v1/billing/checkout` (S3), `/api/v1/billing/portal` (S4) and `/api/v1/billing/packs/:slug/checkout` (S7). Door 6 (contracts) is S9; S6 adds only what it changes:
`GET /billing/packs` and the `pack` `UnlockCondition` in `docs/api/openapi.yaml` (checked by `npm run lint:openapi` in Build).

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /api/v1/billing/packs` statuses (2) | 200 C1 C5 · 401 C6 | - |
| Pacote fields (7) | `slug` C1 · `name` C1 · `description` C1 · `priceCents` C1 · `currency` C1 · `items` C1 · `owned` C1 C3 C4 | - |
| design doc Pack states (6) | for sale, not owned C1 · paid C3 · off sale, paid C4 · off sale, not paid C4 · billing off C5 · item of Pacote on sale refused C11 | - |
| Pacote items (3) | Elmo de Escamas C1 C8 C12 C13 · Presa do Dragão C1 C8 C12 C13 · Amuleto de Brasa C1 C8 C12 C13 | - |
| items kept out of the Loja Itens section (7) | Elmo de Escamas C11 · Presa do Dragão C11 · Amuleto de Brasa C11 · Manto do Arquimago C11 · Cajado Astral C11 · Lenda do Foco C11 · Mestre da Aurora C11 | - |
| frontend Pacote item states (2) | owned C9 · not owned C9 C10 | - |
| doors touched (2) | 2 `packs`/`pack_payments` C12 · 3 `pack:<slug>` and the Pacote seed C7 C12 | - |

## Swept

- validation: C7 (malformed `pack:` conditions); C11 (for-sale CHECK at the database)
- failure modes: C5 (billing not configured)
- idempotency: n/a - S6 only reads; the Pagamento write is S7
- authorization: C6; C3 (`owned` read only from the caller's own Pagamentos)
- concurrency: n/a - no write in S6
- data lifecycle: C4 (paid Pacote kept after it leaves the shelf), C12 (Pagamento deleted with the user)
- dependency failure: C5; the listing never calls Stripe (the fake throws on any call in C1-C4)
- state transitions: C4 (for sale to off sale)
- observability: n/a - a read with no side effect

## Handoff

- **Settled mid-build:** the 3 Pacote sprites were approved in Figma (user: "os sprites foram aprovados no figma sim"), so they replace the recolour fallback; `packs.description` = "Elmo, presa e amuleto forjados no fogo de um dragão. Ficam com você para sempre, em qualquer plano." (user: recommended option); a Pacote item without ownership reads "Do Pacote do Dragão", orders with the items for sale and the hint says "comprados na Loja" (user: "Mesmo rótulo"). Both recorded in the plan's Assumptions.
- **Dispatched:** Verifier at dd29d75 (diff 78c19f6..dd29d75), sent; screens sub-agent n/a (no capture)
- **Boundary:** C1-C14 closed; the Verifier's C2 finding closed by 6bba4c4; proofs.md green (30 pass)
- **Abandoned:** none
- **Walked:** n/a - S6 changes no screen a capture draws; the drawer captions are proven by C9 and C10
