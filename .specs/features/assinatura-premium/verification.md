# Assinatura premium - S6 verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at dd29d75
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `billing-packs-http.integration.test.ts` `lists the Pacote do Dragão for sale with its price, its 3 items and owned false` | yes - exact `toEqual` on the whole body: `available`, slug, name, settled description, 490, `brl`, the 3 `{ id, name, category }` in avatar/weapon/accessory order, `owned: false`; the fake Stripe throws on any call |
| C2 | `packs.spec.ts` `lists the Pacotes for sale ordered by name, each with owned false when the user paid none` + `billing-packs-http.integration.test.ts` `orders the Pacotes for sale by name` | no - the unit ids (`a`/`d`/`z`) sort like the names and the HTTP slugs (`alfa`/`dragao`/`zeta`) sort like the names, so a sort by slug at the service or query layer stays green on both |
| C3 | `packs.spec.ts` `marks owned only the Pacote the user paid` + `billing-packs-http.integration.test.ts` `marks owned only for the user who paid the Pacote` | yes - two users over HTTP, `true` for the payer and `false` for the other |
| C4 | `packs.spec.ts` `keeps a paid Pacote that left the shelf, owned, and drops an unpaid one off the shelf` + `billing-packs-http.integration.test.ts` `keeps a paid Pacote listed as owned after it leaves the shelf, and hides it from who did not pay` | yes - `for_sale = 0` in the database; payer sees `[{ dragao, owned: true }]`, the other user gets exactly `{ available: true, packs: [] }` |
| C5 | `billing-packs-http.integration.test.ts` `answers 200 with available false and no Pacote, even to a user who paid one` | yes - real `AppModule` with every billing key deleted, a paying user, exact `{ available: false, packs: [] }` |
| C6 | `billing-packs-http.integration.test.ts` `answers 401 without a token` | yes |
| C7 | `unlock-condition.spec.ts` `reads a Pacote condition with its slug`, `reads the malformed condition %p as no condition` (`pack:`, `pack:Dragão`, `pack:a b`), `never unlocks a Pacote item by level, sessions or as an Item inicial` | yes - exact parse; `isUnlockedAtLevel(99)`, sessions 1000/1000 and `isStarterItem(_, false)` all `false` |
| C8 | `billing-packs-http.integration.test.ts` `returns the Pacote items in the Catálogo with the pack condition, locked until the Pacote is paid` + `cosmetics-http.integration.test.ts` `gives a new user the three starter items, ...` and `unlocks every item up to the character level ...` | yes - condition, `requiresPremium: false`, `forSale: false`, `unlocked` false then true per item; the full Catálogo lists the 3 locked for a new user and for the level-12 veteran |
| C9 | `character-catalog.test.tsx` `captions an owned Pacote item "Do Pacote do Dragão" and lets a free plan wear it` + `captions a Pacote item the user does not own "Do Pacote do Dragão" too, locked` | yes - `optionsFor(..., 'free')` gives `owned` with the caption for all 3; unowned gives `locked` and the same caption |
| C10 | `character-catalog.test.tsx` `orders and describes a locked Pacote item with the items for sale, ahead of the Raid items` | yes - `lockedByPurchase`, the exact hint, and the Raid item put first in the input comes second (a stable sort with equal rank would fail it) |
| C11 | `billing-packs-http.integration.test.ts` `keeps the Pacote items and the Itens premium out of the Loja Itens section, and refuses to put them on sale` | yes - non-empty shelf, none of the 7 ids; each `UPDATE ... price = 100, for_sale = 1` refused by `CHK_cosmetic_items_for_sale` (price in range, so the refusal comes from the condition) |
| C12 | `migration.integration.test.ts` `creates packs and pack_payments with the Pacote do Dragão and its 3 items, ...` + `applies every migration in order and reverts them all down to an empty schema` | yes - seed row and 3 items exact; `UQ_packs_slug`, `CHK_packs_price_cents` (0), both unique keys on `pack_payments`, cascade on user delete, both tables and the `pack:%` items gone on revert |
| C13 | `character-catalog.test.tsx` `draws each Pacote item with its own recoloured sprite, not the category default` + `draws the Elmo, the Presa and the Amuleto on the Herói, ...` | yes - sprite differs from the category fallback and exists; Herói pixel strings differ from the bare slot and from Armadura do Lobo, Espada and Selo dos Madrugadores |
| C14 | `auth.integration.test.ts` (`npm run test:auth:integration --workspace apps/backend`) | yes - boots the real `AppModule`; `billing-packs-http` also boots it with `Pack`/`PackPayment` registered |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| C2 does not tell the name order from the slug order: a sort by `slug` added at the service or query layer leaves both proofs green | `billing-packs-http.integration.test.ts` `orders the Pacotes for sale by name`: slugs `alfa`/`dragao`/`zeta` sort exactly like `Pacote Alfa`/`Pacote do Dragão`/`Pacote Zeta`; `packs.spec.ts` ids `a`/`d`/`z` sort exactly like the names. A throwaway at HEAD with slug `aaa` named "Pacote Zeta" and slug `zzz` named "Pacote Ábaco" came back in name order, so the code is right today; the proof would not catch a regression | in the HTTP test give the extra Pacotes slugs that sort against their names (e.g. `zeta` for "Pacote Alfa", `alfa` for "Pacote Zeta") || 6bba4c4 - slugs `zz-alfa`/`aa-zeta` and ids `z`/`a` now sort against the names; C2 proves it |

Probed with throwaway tests at HEAD, deleted afterwards (not committed):

- HTTP: a for-sale Pacote whose slug sorts before its name, and an off-sale Pacote with no items paid by one user. The payer got `zzz` (owned, `items: []`), `dragao`, `aaa`; the other user got `dragao`, `aaa`. Passed.
- Unit: `parseUnlockCondition` refuses `pack:dragao\n`, ` pack:dragao`, `pack:dragao:x`, `PACK:dragao`, `pack:DRAGAO` and `pack :dragao`, accepts `pack:dragao-2`, and still reads `raid:pack:dragao` as a Raid. `visiblePacks` returns `[]` for an empty shelf and for an off-sale Pacote paid by nobody. Passed. (`pack:-` parses as slug `-`. The plan does not define the slug grammar, so this is not a finding.)
- Rules the diff touched that no check names: `billing-webhook.integration.test.ts` with the new `Pack`/`PackPayment` repository providers passes (32/32) at HEAD. The other backend readers of `parseUnlockCondition` (`for-sale.ts`, `isUnlockedAtLevel`, `isUnlockedBySessionCounts`, `isStarterItem`, `milestoneProgress`) treat `pack` as not purchasable, not unlocked and not starter. On the frontend, every branch over `UnlockCondition` (`ownedCaption`, `describeUnlockCondition`, `cosmeticItemState`) handles `pack`, and typecheck enforces it.
