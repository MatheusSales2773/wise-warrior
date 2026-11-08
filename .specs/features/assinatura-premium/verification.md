# Assinatura premium verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 696d7c9
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `apps/frontend/__tests__/market-packs.test.tsx` `shows the tabs Missões, Itens and Pacotes, in that order, while billing is available` | yes |
| C2 | `apps/frontend/__tests__/market-packs.test.tsx` `shows only Missões and Itens while billing is not available` | yes |
| C3 | `apps/frontend/__tests__/market-packs.test.tsx` `hides the Pacotes tab and keeps Missões and Itens when the packs request fails` | yes |
| C4 | `apps/frontend/__tests__/market-packs.test.tsx` `opens on Pacotes with ?secao=pacotes` | yes |
| C5 | `apps/frontend/__tests__/market-packs.test.tsx` `opens on Missões without secao, with the Pacotes tab present` | yes |
| C6 | `apps/frontend/__tests__/market-packs.test.tsx` `opens on Missões with ?secao=pacotes while billing is not available` | yes |
| C7 | `apps/frontend/__tests__/market-packs.test.tsx` `shows the unowned Pacote with name, description, 3 items and Comprar por R$ 4,90` | yes |
| C8 | `apps/frontend/__tests__/market-packs.test.tsx` `shows Adquirido and no buy button for an owned Pacote` | yes |
| C9 | `apps/frontend/__tests__/market-packs.test.tsx` `writes the price in reais from the cents` | yes - 3 examples as the plan fixes; 5, 99, 1005, 0 also hold (throwaway) |
| C10 | `apps/frontend/__tests__/market-packs.test.tsx` `previews the 3 items on the hero at once without persisting anything` | yes - does not assert the hero sprite itself, only the 3 items |
| C11 | `apps/frontend/__tests__/market-packs.test.tsx` `marks the button busy, requests the checkout of dragao and opens the url` | yes |
| C12 | `billing.test.ts` `leaves for Stripe in the same tab on the Web` / `hands the page to the system browser on the native app` | yes - S5 tests of openStripePage; C11 proves the card calls it |
| C13 | `apps/frontend/__tests__/market-packs.test.tsx` `waits for the payment after checkout=success, then says the items arrive shortly` | no - advances 30 s then checks the late line; never asserts "Confirmando" still shows just before 30 s, so a shorter timer passes |
| C14 | `apps/frontend/__tests__/market-packs.test.tsx` `shows no waiting message with checkout=success when the Pacote is already owned` | yes |
| C15 | `realtime-client.test.ts` `refreshes the Pacotes, the profile and the cosmetics catalog when a Pacote is granted` | yes |
| C16 | `realtime-client.test.ts` `listens to user:packGranted once and stops on dispose` | yes |
| C17 | `apps/frontend/__tests__/market-packs.test.tsx` `shows Adquirido and the Inventário notice when user:packGranted arrives` | yes for the case it names (Pacotes open); the notice does not appear if the grant arrives while another tab is open (see Findings) |
| C18 | `apps/frontend/__tests__/market-packs.test.tsx` `shows the Pacotes with no message after checkout=cancel` | yes |
| C19 | `apps/frontend/__tests__/market-packs.test.tsx` `shows the server message on 404/409/502/503 and frees the button` x4, `shows a generic line on any other failure and frees the button`; `billing.test.ts` `uses the server detail on 404 only when the caller lists it` | yes - "frees" is checked as busy falsy; busy itself is C11 |
| C20 | `apps/frontend/__tests__/market-packs.test.tsx` `keeps the Moedas balance in Missões/Itens`, `hides the Moedas balance and the Extrato link in Pacotes`, two opening-text tests | no - desktop viewport (1440) only; the compact branch (PurseChip hidden) has no test (throwaway at 390 passed) |
| C21 | `market-screen.test.tsx` `leads with the purse and lists each Mission in its state`, `switches to Itens through the URL and previews the first item to buy` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| S8.7 notice "Itens do Pacote do Dragão no seu Inventário" is lost when `user:packGranted` arrives with the Loja open on Missões or Itens, then the user opens Pacotes (no check holds it) | `market-screen.tsx` PacksSection: `seen` ref lives in the Pacotes section, which is unmounted on other tabs; the in-code `shortcut:` comment admits it; plan S8.7 says WHEN the event arrives, with the Loja open | lift the owned-flip detection into MarketScreen, or accept and record it in plan `Differences`; add a test (grant on Missões, then switch to Pacotes) | c6e9a9d - C17 `keeps the Inventário notice for a grant that arrives while another tab is open` |
| C13 does not hold the 30 s bound | test advances 30 000 ms and checks the late line; nothing asserts "Confirmando seu pagamento…" at ~29 s | after the first findByText advance 29 000 ms and assert the waiting line still shows, then 1 000 more | c6e9a9d - C13 now asserts the waiting line at 29 s, the late line after 30 s |
| C20 only runs at 1440 px | `market-packs.test.tsx` `keeps the Moedas balance in ...` and `hides ...` call no `setViewport` below desktop; the compact `PurseChip` branch has its own `showPurse` condition | run the Pacotes hide case at 390 px | c6e9a9d - C20 `hides the Moedas balance and the Extrato link in Pacotes at 390 px` |
| `checkout=success` with two Pacotes, one owned, still shows "Confirmando seu pagamento…" (throwaway, by design of `some(!owned)`) | `confirming = checkout === 'success' && packs.some(!owned)`; only one Pacote is sold today, but the return URL carries no slug | none now; note in plan that it assumes one Pacote, or key on the returned slug | accepted - plan row `Detalhes da seção Pacotes (S8)` now says the wait assumes one Pacote on sale (the return URL has no slug) |
