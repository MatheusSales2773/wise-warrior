# Assinatura premium S1 verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at c518417
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `cosmetics-equip.integration.test.ts` `gives a new Character the three premium items unequipped and equips only the non-premium starters` | yes - asserts the 3 premium rows with `equipped=false` and the exact equipped list `['Aprendiz','Capuz do Erudito','Espada']` |
| C2 | `unlock-condition.spec.ts` `does not mark a premium level-1 item as a starter item` | yes |
| C3 | `migration.integration.test.ts` `seeds the three premium items unequipped for every existing Character and keeps what is equipped` | yes - level 20 and level 1 Characters, exact rows, veteran still wears Mestre da Aurora |
| C4 | `migration.integration.test.ts` `seeds the premium items idempotently and removes them on revert` | yes - re-running `up` keeps an equipped Manto, `down` empties the rows |
| C5 | `cosmetics-equip.integration.test.ts` `answers 403 to a free user on a premium item when billing is configured, even with the policy flag true` | yes - status, `detail` and unchanged equipment |
| C6 | `cosmetics-equip.integration.test.ts` `lets a free user equip a premium item while the MVP policy releases it to everyone with no billing configured` | yes |
| C7 | `cosmetics-equip.integration.test.ts` `lets a premium user equip a premium item when billing is configured` | yes |
| C8 | `for-sale.spec.ts` `refuses a Pacote item for sale` + `migration.integration.test.ts` `refuses to put a premium or Pacote item for sale at the database` | no - the unit test uses `not.toBeNull()` for the Pacote case, so the claim "o domínio devolve o motivo" is not held (any message passes); the DB half holds (three cases, CHECK name in the regex) |
| C9 | `character-catalog.test.tsx` `captions a premium level-1 item "Plano premium" and never "inicial"` | yes - the three categories, plus equipped and premium-plan cases |
| C10 | `character-catalog.test.tsx` `draws the premium items with their own sprite, not the category default` | yes |
| C11 | `character-catalog.test.tsx` `draws the Herói layers of the premium Avatar and Arma, different from the initial ones` | yes for the Avatar layer (via `avatarLayerFor`); the Arma half only checks the `weaponLayers` entry, see Findings |
| C12 | `cosmetics-equip.integration.test.ts` `lists the three premium items in the Catalog of a new Character as unlocked, unequipped and premium` | yes - exact objects over the HTTP Catalog |

## Own examples

- Domain: `forSaleViolation` with `pack:outro` (another slug), premium with `level:5`, price 301, `forSale=false` with `pack:dragao`, and `isStarterItem` on `level:2` premium and not premium. All behaved as the plan says (throwaway spec, deleted).
- Equip: billing configured and `COSMETICS_PREMIUM_FOR_ALL=false`: free gets 403 on "Lenda do Foco" and 204 on the non-premium "Aprendiz"; after `plan_tier='premium'` the same item equips and the others stay (throwaway integration test, deleted).

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| C8's unit test does not hold the returned reason for a Pacote item | `for-sale.spec.ts` `refuses a Pacote item for sale` uses `.not.toBeNull()`; a wrong message or a violation for the wrong reason (e.g. the price branch) still passes | assert the message of `forSaleViolation` for `pack:dragao` (the "Só um item com Condição de desbloqueio de compra..." text) |  `018301d` - C8 now asserts the exact reason |
| C11's Arma half does not go through the Herói render path | `character-catalog.test.tsx` only checks `weaponLayers['Cajado Astral']` is defined and differs from `Cajado`/`Espada`; nothing shows the Hero draws it when "Cajado Astral" is the equipped weapon (`layered-hero.tsx` reads `weaponLayers[equipped.weapon.name]`) | render the Herói layers with `weapon: { name: 'Cajado Astral' }` and assert the `character-hero-layer-weapon` layer uses that sprite |  `018301d` - C11 `draws the Cajado Astral weapon layer on the Herói, apart from the Cajado layer` |
