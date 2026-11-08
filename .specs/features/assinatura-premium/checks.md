# Assinatura premium - S10 checks (Redesenho da tela Plano)

Build: `npm run typecheck --workspace apps/frontend`; `cd apps/frontend && npx eslint src/features/settings __tests__/settings-screen.test.tsx`
Run settings: `npm test --workspace apps/frontend -- __tests__/settings-screen.test.tsx --verbose`
Run billing: `npm test --workspace apps/frontend -- __tests__/billing.test.ts --verbose`
Plan: `.specs/features/assinatura-premium/plan.md`

Issue #380 (`S10`). Replaces the S8 checks (closed in #362). S10 is frontend only: it reads `GET /billing/subscription`, the
profile and the Catálogo (all merged) and adds no route, table, env var, backend module or `imports`, so `test:auth:integration`
is not owed. Tests mock the HTTP functions of the feature and `openStripePage`; nothing reaches the network. Sprites: none new;
the offer and the owned card draw `Manto do Arquimago`, `Cajado Astral` and `Lenda do Foco` with the sprites already in
`sprites.ts` (the Cajado Astral and Lenda do Foco are recoloured from existing art, as S1 recorded), so no new recolouring.
The Figma frames are links, not files in `captures/`, and the app was not run (see `Walked`).

13 checks below · 0 new one-way doors · 0 open questions

## Checks

### S10 - Redesenho da tela Plano

**C1** - The card has the header "◈ PLANO ATUAL" and "Cobrança pelo Stripe", the plan name and the situation line, in every state drawn (P1)
Proof: run settings | ✓ P6, P1: with billing off shows "Free · PREMIUM EM BREVE", no button and no offer
Proof: run settings | ✓ P2, P1: a free plan on desktop shows the card, the offer beside it and "Como funciona" below
Proof: run settings | ✓ P3, P1: an active premium shows "Premium ✦", the renewal, "ATIVO", the Portal button and the owned items

**C2** - Free with billing on shows "Free", "SEM ASSINATURA", the invitation text and "Assinar premium", the offer (hero layers, "Premium ✦", "R$ 9,90/mês", the 3 Itens premium with "✦ PREMIUM" and without "Mestre da Aurora", second button, Stripe note) and, on desktop, "Como funciona" with steps 01 to 03 (P2)
Proof: run settings | ✓ P2, P1: a free plan on desktop shows the card, the offer beside it and "Como funciona" below

**C3** - On a 390 px phone the offer is below the card, "Como funciona" is absent and there are two "Assinar premium" buttons (P2, P10)
Proof: run settings | ✓ P2, P10: a free plan on a 390 px phone shows the offer below the card, without "Como funciona"

**C4** - Either "Assinar premium" button calls `POST /billing/checkout`, both show busy until the url arrives, and the url opens (P2, S5.4)
Proof: run settings | ✓ P2: "Assinar premium" in the card opens the Checkout url, both buttons busy while it loads
Proof: run settings | ✓ P2: "Assinar premium" in the offer opens the Checkout url, both buttons busy while it loads

**C5** - An active premium shows "Premium ✦", "R$ 9,90/MÊS · RENOVA EM 08/12", "ATIVO", "Gerenciar assinatura" opening the Portal, and the card "Seus Itens premium ✦" with the hero and 3 items "Liberado", with no offer (P3, S5.10)
Proof: run settings | ✓ P3, P1: an active premium shows "Premium ✦", the renewal, "ATIVO", the Portal button and the owned items

**C6** - `past_due` shows "PENDENTE", "R$ 9,90/MÊS · PAGAMENTO PENDENTE", the error "A última cobrança não passou. Atualize o cartão para manter o premium." in the card and "Atualizar cartão" opening the Portal, with no "Gerenciar assinatura" (P4, S5.10)
Proof: run settings | ✓ P4: a past_due premium shows "PENDENTE", the in-card error and "Atualizar cartão" opening the Portal

**C7** - With `premiumUntil` the card shows "ATÉ 08/12", "NÃO RENOVA", the unequip notice and "Gerenciar assinatura" (P5)
Proof: run settings | ✓ P5: a premium set to end shows "ATÉ dd/mm", "NÃO RENOVA", the unequip notice and "Gerenciar assinatura"

**C8** - With `available: false` the card shows "Free", "PREMIUM EM BREVE" and its text, with no button, no offer and no "Como funciona" (P6)
Proof: run settings | ✓ P6, P1: with billing off shows "Free · PREMIUM EM BREVE", no button and no offer

**C9** - "Confirmando sua assinatura…" turns into "Pagamento recebido. O plano atualiza em instantes." after 30 s and goes away when `user:planChanged` brings premium (P7, S5.5, S5.12)
Proof: run settings | ✓ P7, S5.5, S5.12: waits for user:planChanged after ?checkout=success, then shows premium without reloading

**C10** - A `409`, `502` or `503` from the checkout shows the server message above the card (not in it) and frees both buttons; `?checkout=cancel` shows no message (P7, S5.11, S5.6)
Proof: run settings | ✓ P7: shows the server message of 409 above the card and frees the buttons
Proof: run settings | ✓ P7: shows the server message of 502 above the card and frees the buttons
Proof: run settings | ✓ P7: shows the server message of 503 above the card and frees the buttons
Proof: run settings | ✓ S5.6: back with ?checkout=cancel shows the free state with no error

**C11** - The Plano item of the desktop menu shows "PREMIUM ✦" for a premium plan and "Free" for a free plan with billing on (P8)
Proof: run settings | ✓ P8: the menu shows "PREMIUM ✦" for a premium plan and the plan name otherwise
Proof: run settings | ✓ P8: the menu keeps "Free" for a free plan with billing on

**C12** - The suites of Configuração and of billing keep passing with the same testIDs (P9)
Proof: run settings | ✓ points each item of the inner menu at its own address
Proof: run billing | ✓ leaves for Stripe in the same tab on the Web

**C13** - The Plano shows at 1440 px and at 390 px, and the buttons keep the accessible names "Assinar premium", "Gerenciar assinatura" and "Atualizar cartão" (P10)
Proof: run settings | ✓ P2, P10: a free plan on a 390 px phone shows the offer below the card, without "Como funciona"
Proof: run settings | ✓ opens the Plano atual: Free · premium em breve row on its own screen and returns with ‹ Configuração

## Coverage

This slice consumes `GET /api/v1/billing/subscription` (S5, merged), `POST /api/v1/billing/checkout` (S3) and `POST /api/v1/billing/portal` (S4) and owns no route. Startup configuration: S10 adds no bootstrap setting and no module `imports`.

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| card states drawn (5) | Free C2 · Premium ativo C5 · Pagamento pendente C6 · Cancelada C7 · Em breve C8 | - |
| cards of the screen (4) | Plano atual C1 · Oferta C2 · Como funciona C2 · Seus Itens premium C5 | - |
| Itens premium of the offer (3) | Manto do Arquimago C2 · Cajado Astral C2 · Lenda do Foco C2 | - |
| messages above the card (4) | Confirmando C9 · Pagamento recebido C9 · erro de abertura C10 · cancel (none) C10 | - |
| checkout failure statuses (3) | 409 C10 · 502 C10 · 503 C10 | - |
| layouts (2) | desktop C2 · 390 px C3 | - |
| buttons that open Stripe (4) | Assinar premium (card) C4 · Assinar premium (offer) C4 · Gerenciar assinatura C5 · Atualizar cartão C6 | - |
| menu meta of Plano (2) | PREMIUM ✦ C11 · Free C11 | - |

## Swept

- validation: existing - `billingErrorMessage` shows server text only for 409, 502 and 503 (S5.11, `billing.test.ts`)
- failure modes: C10 (buttons freed), existing - the load failure of the plan keeps its retry (S5)
- idempotency: C4 (both buttons busy while the url is fetched, so no second tap)
- authorization: existing - `getAuthenticatedHttpClient` and the backend `401` (S5)
- concurrency: n/a - one request per tap, no shared write
- data lifecycle: n/a - the screen only reads; nothing is stored
- dependency failure: existing - a failed Catálogo leaves the offer without the item rows, a failed profile draws the hero without equipment; neither blocks the buttons
- state transitions: C9 (free to premium by `user:planChanged`), C5 to C8 (each state)
- observability: n/a - the frontend has no logging requirement in this slice

## Handoff

- **Settled mid-build:** user: "Sim, deve seguir" - follow #380 as the contract and update the plan with a new slice
- **Dispatched:** none yet
- **Boundary:** none yet
- **Abandoned:** none
- **Walked:** not walked in a running app: it needs the backend with MySQL and a Stripe test account, which the open question `blocks go-live` still holds. The screen is exercised by 15 component tests at 1440 px and 390 px.
