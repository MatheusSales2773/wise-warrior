# assinatura-premium proofs

**HEAD**: 76ad7a4
**Tree**: clean
**Shell**: /bin/sh
**Result**: 30 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run packs / ✓ lists the Pacote do Dragão for sale with its price, its 3 items and owned false` | pass |
| C2 | `run unit / ✓ lists the Pacotes for sale ordered by name, each with owned false when the user paid none` | pass |
| C2 | `run packs / ✓ orders the Pacotes for sale by name` | pass |
| C3 | `run unit / ✓ marks owned only the Pacote the user paid` | pass |
| C3 | `run packs / ✓ marks owned only for the user who paid the Pacote` | pass |
| C4 | `run unit / ✓ keeps a paid Pacote that left the shelf, owned, and drops an unpaid one off the shelf` | pass |
| C4 | `run packs / ✓ keeps a paid Pacote listed as owned after it leaves the shelf, and hides it from who did not pay` | pass |
| C5 | `run packs / ✓ answers 200 with available false and no Pacote, even to a user who paid one` | pass |
| C6 | `run packs / ✓ answers 401 without a token` | pass |
| C7 | `run unit / ✓ reads a Pacote condition with its slug` | pass |
| C7 | `run unit / ✓ reads the malformed condition "pack:" as no condition` | pass |
| C7 | `run unit / ✓ reads the malformed condition "pack:Dragão" as no condition` | pass |
| C7 | `run unit / ✓ never unlocks a Pacote item by level, sessions or as an Item inicial` | pass |
| C8 | `run packs / ✓ returns the Pacote items in the Catálogo with the pack condition, locked until the Pacote is pai` | pass |
| C8 | `run catalog / ✓ gives a new user the three starter items, equipped, and shows the rest of the Catalog locked` | pass |
| C8 | `run catalog / ✓ unlocks every item up to the character level without duplicating it when the rule runs again` | pass |
| C9 | `run frontend / ✓ captions an owned Pacote item "Do Pacote do Dragão" and lets a free plan wear it` | pass |
| C9 | `run frontend / ✓ captions a Pacote item the user does not own "Do Pacote do Dragão" too, locked` | pass |
| C10 | `run frontend / ✓ orders and describes a locked Pacote item with the items for sale, ahead of the Raid items` | pass |
| C11 | `run packs / ✓ keeps the Pacote items and the Itens premium out of the Loja Itens section, and refuses to put t` | pass |
| C12 | `run migration / ✓ creates packs and pack_payments with the Pacote do Dragão and its 3 items, one Pagamento per` | pass |
| C12 | `run migration / ✓ applies every migration in order and reverts them all down to an empty schema` | pass |
| C13 | `run frontend / ✓ draws each Pacote item with its own recoloured sprite, not the category default` | pass |
| C13 | `run frontend / ✓ draws the Elmo, the Presa and the Amuleto on the Herói, each different from the slot without ` | pass |
| C14 | `npm run test:auth:integration --workspace apps/backend` | pass |
| Build | `npm run build --workspace apps/backend` | pass |
| Build | `npm run lint --workspace apps/backend` | pass |
| Build | `npm run typecheck --workspace apps/frontend` | pass |
| Build | `npm run lint --workspace apps/frontend` | pass |
| Build | `npm run lint:openapi` | pass |

## Output

`Run packs` - exit 0

```
    ✓ lists the Pacote do Dragão for sale with its price, its 3 items and owned false (68 ms)
    ✓ orders the Pacotes for sale by name (50 ms)
    ✓ marks owned only for the user who paid the Pacote (82 ms)
    ✓ keeps a paid Pacote listed as owned after it leaves the shelf, and hides it from who did not pay (94 ms)
    ✓ answers 401 without a token (1 ms)
    ✓ returns the Pacote items in the Catálogo with the pack condition, locked until the Pacote is paid (53 ms)
    ✓ keeps the Pacote items and the Itens premium out of the Loja Itens section, and refuses to put them on sale (51 ms)
  GET /billing/packs without STRIPE_SECRET_KEY, over HTTP against MySQL
    ✓ answers 200 with available false and no Pacote, even to a user who paid one (54 ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        4.511 s
Ran all test suites matching /billing-packs-http/i.
```

`Run unit` - exit 0

```
    ✓ maps the Stripe status paused to free
    ✓ gives free to a user with no Subscription
    ✓ gives free to a status Stripe adds later

PASS src/modules/billing/domain/packs.spec.ts
  visiblePacks
    ✓ lists the Pacotes for sale ordered by name, each with owned false when the user paid none (12 ms)
    ✓ marks owned only the Pacote the user paid (1 ms)
    ✓ keeps a paid Pacote that left the shelf, owned, and drops an unpaid one off the shelf

Test Suites: 6 passed, 6 total
Tests:       90 passed, 90 total
Snapshots:   0 total
Time:        4.382 s
Ran all test suites matching /src\/modules\/billing\/domain|src\/modules\/users\/domain/i.
```

`Run catalog` - exit 0

```

PASS src/modules/users/cosmetics-http.integration.test.ts
  Cosmetics Catalog HTTP contract against MySQL
    ✓ requires authentication (630 ms)
    ✓ gives a new user the three starter items, equipped, and shows the rest of the Catalog locked (519 ms)
    ✓ exposes forSale: true for the item on sale and false for a level item (553 ms)
    ✓ derives the profile Título and equipment from the equipped Cosmetic Items (672 ms)
    ✓ leaves an item with a malformed unlock condition out of the Catalog instead of failing it (570 ms)
    ✓ unlocks every item up to the character level without duplicating it when the rule runs again (643 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        3.943 s, estimated 4 s
Ran all test suites matching /cosmetics-http/i.
```

`Run frontend` - exit 0

```
    ✓ draws the premium items with their own sprite, not the category default
    ✓ draws the Herói layers of the premium Avatar and Arma, different from the initial ones (1 ms)
    ✓ draws the Cajado Astral weapon layer on the Herói, apart from the Cajado layer (51 ms)
  Pacote do Dragão items (#360)
    ✓ captions an owned Pacote item "Do Pacote do Dragão" and lets a free plan wear it
    ✓ captions a Pacote item the user does not own "Do Pacote do Dragão" too, locked (1 ms)
    ✓ orders and describes a locked Pacote item with the items for sale, ahead of the Raid items
    ✓ draws each Pacote item with its own recoloured sprite, not the category default
    ✓ draws the Elmo, the Presa and the Amuleto on the Herói, each different from the slot without it and from its source art (129 ms)

Test Suites: 1 passed, 1 total
Tests:       84 passed, 84 total
Snapshots:   0 total
Time:        0.854 s, estimated 1 s
Ran all test suites matching /__tests__\/character-catalog.test.tsx/i.
```

`Run migration` - exit 0

```
    ✓ adds the Arma category: the Espada to every existing Character, equipped once, and the Cajado and Besta À venda (1161 ms)
    ✓ marks existing Study Sessions as Ciclo and reverts the kind column (1181 ms)
    ✓ moves Madrugador and Cem Sessões to session counts and keeps the Badges already in the Inventário (1440 ms)
    ✓ creates subscriptions with one row per user, Customer and Subscription, deletes it with the user, and drops it on revert (1401 ms)
    ✓ creates packs and pack_payments with the Pacote do Dragão and its 3 items, one Pagamento per user, Pacote and session, and drops them on revert (1458 ms)
    Itens premium (#354)
      ✓ seeds the three premium items unequipped for every existing Character and keeps what is equipped (1276 ms)
      ✓ seeds the premium items idempotently and removes them on revert (1243 ms)
      ✓ refuses to put a premium or Pacote item for sale at the database (1410 ms)

Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        26.283 s, estimated 31 s
Ran all test suites matching /migration.integration/i.
```

`npm run test:auth:integration --workspace apps/backend` - exit 0

```
> @wise/backend@0.1.0 test:auth:integration
> jest --runInBand --testRegex '.*auth.integration.test.ts$'

PASS src/modules/auth/auth.integration.test.ts (8.753 s)
<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
PASS src/modules/auth/universal-auth.integration.test.ts

Test Suites: 2 passed, 2 total
Tests:       14 passed, 14 total
Snapshots:   0 total
Time:        12.583 s
Ran all test suites.
```
