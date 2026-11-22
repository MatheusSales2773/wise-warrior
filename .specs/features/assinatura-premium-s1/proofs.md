# assinatura-premium-s1 proofs

**HEAD**: c518417
**Tree**: clean
**Shell**: /bin/sh
**Result**: 17 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run int / ✓ gives a new Character the three premium items unequipped and equips only the non-premium starters` | pass |
| C2 | `run unit / ✓ does not mark a premium level-1 item as a starter item` | pass |
| C3 | `run int / ✓ seeds the three premium items unequipped for every existing Character and keeps what is equipped` | pass |
| C4 | `run int / ✓ seeds the premium items idempotently and removes them on revert` | pass |
| C5 | `run int / ✓ answers 403 to a free user on a premium item when billing is configured, even with the policy flag` | pass |
| C6 | `run int / ✓ lets a free user equip a premium item while the MVP policy releases it to everyone` | pass |
| C7 | `run int / ✓ lets a premium user equip a premium item when billing is configured` | pass |
| C8 | `run unit / ✓ refuses a Pacote item for sale` | pass |
| C8 | `run int / ✓ refuses to put a premium or Pacote item for sale at the database` | pass |
| C9 | `run web / ✓ captions a premium level-1 item "Plano premium" and never "inicial"` | pass |
| C10 | `run web / ✓ draws the premium items with their own sprite, not the category default` | pass |
| C11 | `run web / ✓ draws the Herói layers of the premium Avatar and Arma, different from the initial ones` | pass |
| C12 | `run int / ✓ lists the three premium items in the Catalog of a new Character as unlocked, unequipped and premiu` | pass |
| Build | `npm run build --workspace apps/backend` | pass |
| Build | `npm run lint --workspace apps/backend` | pass |
| Build | `npm run typecheck --workspace apps/frontend` | pass |
| Build | `npm run lint --workspace apps/frontend` | pass |

## Output

`Run int` - exit 0

```
    ✓ credits 90 welcome coins once to each existing account, skips repeats and reverts cleanly (3071 ms)
    ✓ seeds the Cosmetic Items À venda, clears the old test item, and removes only the seeded ids on revert (3553 ms)
    ✓ adds the Arma category: the Espada to every existing Character, equipped once, and the Cajado and Besta À venda (5338 ms)
    ✓ marks existing Study Sessions as Ciclo and reverts the kind column (2352 ms)
    ✓ moves Madrugador and Cem Sessões to session counts and keeps the Badges already in the Inventário (2985 ms)
    Itens premium (#354)
      ✓ seeds the three premium items unequipped for every existing Character and keeps what is equipped (2585 ms)
      ✓ seeds the premium items idempotently and removes them on revert (2623 ms)
      ✓ refuses to put a premium or Pacote item for sale at the database (2932 ms)

Test Suites: 2 passed, 2 total
Tests:       35 passed, 35 total
Snapshots:   0 total
Time:        139.386 s
Ran all test suites matching /src\/modules\/users\/cosmetics-equip.integration.test.ts|src\/migrations\/migration.integration.test.ts/i.
```

`Run unit` - exit 0

```
    ✓ does not unlock level conditions by session count nor session conditions by level (1 ms)
  isStarterItem
    ✓ marks only level-1 conditions as starter items
    ✓ does not mark a premium level-1 item as a starter item

PASS src/modules/users/users.service.spec.ts (9.582 s)
  UsersService
    ✓ derives the level boundaries from the XP projection and the Título from the equipped item (11 ms)
    ✓ uses the zero-XP projection when the character is missing without writing (2 ms)

Test Suites: 3 passed, 3 total
Tests:       45 passed, 45 total
Snapshots:   0 total
Time:        10.208 s
Ran all test suites matching /src\/modules\/users\/domain\/unlock-condition.spec.ts|src\/modules\/users\/domain\/for-sale.spec.ts|src\/modules\/users\/users.service.spec.ts/i.
```

`Run web` - exit 0

```
    ✓ keeps hero sprites, the body and every layer at the Figma 16×24 grid (1 ms)
    ✓ falls back to the initial Avatar layer without an Avatar or without art for it
    ✓ composes the initial Avatar over the body into the initial class sprite (12 ms)
    ✓ renders at an integer scale and merges same-colour runs (20 ms)
    ✓ rejects fractional scales that would blur pixels (12 ms)
  premium items (#354)
    ✓ captions a premium level-1 item "Plano premium" and never "inicial" (1 ms)
    ✓ draws the premium items with their own sprite, not the category default (1 ms)
    ✓ draws the Herói layers of the premium Avatar and Arma, different from the initial ones

Test Suites: 1 passed, 1 total
Tests:       73 passed, 73 total
Snapshots:   0 total
Time:        1.391 s, estimated 2 s
Ran all test suites matching /__tests__\/character-catalog.test.tsx/i.
```
