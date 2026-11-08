# Assinatura premium - S8 checks (Seção Pacotes na Loja)

Build: `npm run typecheck --workspace apps/frontend`; `npm run lint --workspace apps/frontend`
Run packs: `npm test --workspace apps/frontend -- __tests__/market-packs.test.tsx --verbose`
Run market: `npm test --workspace apps/frontend -- __tests__/market-screen.test.tsx --verbose`
Run realtime: `npm test --workspace apps/frontend -- __tests__/realtime-client.test.ts --verbose`
Run billing: `npm test --workspace apps/frontend -- __tests__/billing.test.ts --verbose`
Plan: `.specs/features/assinatura-premium/plan.md`

Issue #362 (`S8`). Replaces the S7 checks (closed in #361). S8 is frontend only: it reads `GET /billing/packs` and calls
`POST /billing/packs/:slug/checkout` (S6 and S7, merged), adds no table, no env var, no backend module and no `imports`, so
`test:auth:integration` is not owed. Tests mock the HTTP functions of the feature and `openStripePage`; nothing reaches the
network. Sprites: none new. The 3 items of the Pacote draw with the sprites already in `sprites.ts` (`Elmo de Escamas`,
`Presa do Dragão`, `Amuleto de Brasa`, approved in S6), so no recolouring fallback is used. No capture draws this screen
(`Differences from the source`: none), so no `.running.png` is owed; the screen follows the cards and tabs of Missões and Itens.

21 checks below · 0 new one-way doors · 0 open questions

## Checks

### S8 - Seção Pacotes na Loja

**C1** - With `available: true` the Loja shows three tabs in the order Missões, Itens, Pacotes (S8.1)
Proof: run packs | ✓ shows the tabs Missões, Itens and Pacotes, in that order, while billing is available

**C2** - With `available: false` the Loja shows only Missões and Itens (S8.1)
Proof: run packs | ✓ shows only Missões and Itens while billing is not available

**C3** - A failed `GET /billing/packs` hides the Pacotes tab and leaves Missões and Itens working (dependency failure, S8.1)
Proof: run packs | ✓ hides the Pacotes tab and keeps Missões and Itens when the packs request fails

**C4** - `?secao=pacotes` opens on Pacotes (S8.2)
Proof: run packs | ✓ opens on Pacotes with ?secao=pacotes

**C5** - Without `secao` the Loja opens on Missões, with the Pacotes tab present (S8.2)
Proof: run packs | ✓ opens on Missões without secao, with the Pacotes tab present

**C6** - `?secao=pacotes` while billing is not available opens Missões, since the tab does not exist (S8.1, S8.2)
Proof: run packs | ✓ opens on Missões with ?secao=pacotes while billing is not available

**C7** - A Pacote the user does not own shows name, description, its 3 items and the button "Comprar por R$ 4,90" (490 cents) (S8.3)
Proof: run packs | ✓ shows the unowned Pacote with name, description, 3 items and Comprar por R$ 4,90

**C8** - An owned Pacote shows the "Adquirido" badge and no buy button (S8.3)
Proof: run packs | ✓ shows Adquirido and no buy button for an owned Pacote

**C9** - The price label is built from `priceCents`: 490 → "R$ 4,90", 1290 → "R$ 12,90", 100000 → "R$ 1000,00" (S8.3)
Proof: run packs | ✓ writes the price in reais from the cents

**C10** - The Prévia of the Pacote shows the 3 items on the hero at once and calls nothing: no equip, no purchase, no checkout (S8.4)
Proof: run packs | ✓ previews the 3 items on the hero at once without persisting anything

**C11** - Tapping "Comprar por R$ 4,90" marks the button busy, calls `POST /billing/packs/dragao/checkout` (slug from the Pacote) and opens the returned url (S8.5)
Proof: run packs | ✓ marks the button busy, requests the checkout of dragao and opens the url

**C12** - The page opens in the same tab on the Web and in the system browser on the native app (S8.5)
Proof: run billing | ✓ leaves for Stripe in the same tab on the Web
Proof: run billing | ✓ hands the page to the system browser on the native app

**C13** - `checkout=success` with the Pacote not owned shows "Confirmando seu pagamento…"; 30 s without `user:packGranted` turns it into "Pagamento recebido. Os itens chegam em instantes." (S8.6)
Proof: run packs | ✓ waits for the payment after checkout=success, then says the items arrive shortly

**C14** - `checkout=success` with the Pacote already owned shows no waiting message (S8.6)
Proof: run packs | ✓ shows no waiting message with checkout=success when the Pacote is already owned

**C15** - `user:packGranted` refetches Pacotes, the profile and the Catálogo, and only those (S8.7)
Proof: run realtime | ✓ refreshes the Pacotes, the profile and the cosmetics catalog when a Pacote is granted

**C16** - The socket listens to `user:packGranted` once and stops on dispose (S8.7)
Proof: run realtime | ✓ listens to user:packGranted once and stops on dispose

**C17** - When the grant arrives the screen shows "Adquirido" and the notice "Itens do Pacote do Dragão no seu Inventário", and the waiting message goes away (S8.7)
Proof: run packs | ✓ shows Adquirido and the Inventário notice when user:packGranted arrives

**C18** - `checkout=cancel` shows the Pacotes section with no error and no waiting message (S8.8)
Proof: run packs | ✓ shows the Pacotes with no message after checkout=cancel

**C19** - A `404`, `409`, `502` or `503` from the checkout route shows the server's message and frees the button; any other failure shows the generic line (S8.9)
Proof: run packs | ✓ shows the server message on 404 and frees the button
Proof: run packs | ✓ shows the server message on 409 and frees the button
Proof: run packs | ✓ shows the server message on 502 and frees the button
Proof: run packs | ✓ shows the server message on 503 and frees the button
Proof: run packs | ✓ shows a generic line on any other failure and frees the button
Proof: run billing | ✓ uses the server detail on 404 only when the caller lists it

**C20** - The Pacotes section shows no Moedas balance and no Extrato link, the other sections still do, and the opening text covers Moedas and Pacotes while billing is available (S8.10)
Proof: run packs | ✓ keeps the Moedas balance in Missões
Proof: run packs | ✓ keeps the Moedas balance in Itens
Proof: run packs | ✓ hides the Moedas balance and the Extrato link in Pacotes
Proof: run packs | ✓ mentions the Pacotes in the opening text while billing is available
Proof: run packs | ✓ leaves the Pacotes out of the opening text while billing is not available

**C21** - The existing Missões and Itens sections keep working with the new tab in place: the Missões list, and `?secao=itens` opening Itens (S8.2, regression)
Proof: run market | ✓ leads with the purse and lists each Mission in its state
Proof: run market | ✓ switches to Itens through the URL and previews the first item to buy

## Coverage

Other routes of the Surface belong to other slices (`/api/v1/billing/subscription` S5, `/api/v1/billing/checkout` S3, `/api/v1/billing/portal` S4, `/api/v1/billing/webhook` S2). This slice consumes `GET /api/v1/billing/packs` (S6, merged) and `POST /api/v1/billing/packs/:slug/checkout` (S7, merged) and owns no route. Startup configuration: S8 adds no bootstrap setting and no module `imports`.

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| Loja tabs (3) | Missões C1 · Itens C1 · Pacotes C1 | - |
| tabs by `available` (2) | `true` C1 · `false` C2 | - |
| `secao` values (4) | `pacotes` C4 · absent C5 · `itens` C21 · `pacotes` with `available: false` C6 | - |
| Pacote card parts, S8.3 (6) | name C7 · description C7 · 3 items C7 · button text C7 · "Adquirido" C8 · no button when owned C8 | - |
| Pacote items (3) | Elmo de Escamas C7 C10 · Presa do Dragão C7 C10 · Amuleto de Brasa C7 C10 | - |
| `checkout` values (3) | `success` not owned C13 · `success` owned C14 · `cancel` C18 | - |
| checkout route failures (5) | 404 C19 · 409 C19 · 502 C19 · 503 C19 · other C19 | - |
| platforms (2) | Web C12 · native C12 | - |
| refetched on `user:packGranted` (3) | Pacotes C15 · profile C15 · Catálogo C15 | - |
| price examples (3) | 490 C9 · 1290 C9 · 100000 C9 | - |
| sections with the Moedas balance (3) | Missões C20 · Itens C20 · Pacotes (hidden) C20 | - |

## Swept

- validation: C9 (cents to reais), C19 (only the four statuses carry the server text; 500 shows the generic line)
- failure modes: C19 (the button is freed), C3 (packs request fails)
- idempotency: C11 (the busy button blocks a second tap while the url is being fetched)
- authorization: existing - `getAuthenticatedHttpClient` sends the token and the backend answers `401` (S7 C8)
- concurrency: n/a - one request per tap, and the backend serialises the grant (S7 C12)
- data lifecycle: C10 (the Prévia persists nothing), C17 (the Inventário is refetched, not patched locally)
- dependency failure: C3, C19
- state transitions: C13 → C17 (waiting → granted), C8 (owned), C14 (success with the Pacote already granted)
- observability: n/a - the frontend has no logging requirement in this slice

## Handoff

- **Settled mid-build:** none
- **Dispatched:** none yet
- **Boundary:** none yet
- **Abandoned:** none
- **Walked:** none yet
