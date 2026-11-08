# assinatura-premium proofs

**HEAD**: 832f15d
**Tree**: clean
**Shell**: /bin/sh
**Result**: 36 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run packs / ✓ shows the tabs Missões, Itens and Pacotes, in that order, while billing is available` | pass |
| C2 | `run packs / ✓ shows only Missões and Itens while billing is not available` | pass |
| C3 | `run packs / ✓ hides the Pacotes tab and keeps Missões and Itens when the packs request fails` | pass |
| C4 | `run packs / ✓ opens on Pacotes with ?secao=pacotes` | pass |
| C5 | `run packs / ✓ opens on Missões without secao, with the Pacotes tab present` | pass |
| C6 | `run packs / ✓ opens on Missões with ?secao=pacotes while billing is not available` | pass |
| C7 | `run packs / ✓ shows the unowned Pacote with name, description, 3 items and Comprar por R$ 4,90` | pass |
| C8 | `run packs / ✓ shows Adquirido and no buy button for an owned Pacote` | pass |
| C9 | `run packs / ✓ writes the price in reais from the cents` | pass |
| C10 | `run packs / ✓ previews the 3 items on the hero at once without persisting anything` | pass |
| C11 | `run packs / ✓ marks the button busy, requests the checkout of dragao and opens the url` | pass |
| C12 | `run billing / ✓ leaves for Stripe in the same tab on the Web` | pass |
| C12 | `run billing / ✓ hands the page to the system browser on the native app` | pass |
| C13 | `run packs / ✓ waits for the payment after checkout=success, then says the items arrive shortly` | pass |
| C14 | `run packs / ✓ shows no waiting message with checkout=success when the Pacote is already owned` | pass |
| C15 | `run realtime / ✓ refreshes the Pacotes, the profile and the cosmetics catalog when a Pacote is granted` | pass |
| C16 | `run realtime / ✓ listens to user:packGranted once and stops on dispose` | pass |
| C17 | `run packs / ✓ shows Adquirido and the Inventário notice when user:packGranted arrives` | pass |
| C17 | `run packs / ✓ keeps the Inventário notice for a grant that arrives while another tab is open` | pass |
| C18 | `run packs / ✓ shows the Pacotes with no message after checkout=cancel` | pass |
| C19 | `run packs / ✓ shows the server message on 404 and frees the button` | pass |
| C19 | `run packs / ✓ shows the server message on 409 and frees the button` | pass |
| C19 | `run packs / ✓ shows the server message on 502 and frees the button` | pass |
| C19 | `run packs / ✓ shows the server message on 503 and frees the button` | pass |
| C19 | `run packs / ✓ shows a generic line on any other failure and frees the button` | pass |
| C19 | `run billing / ✓ uses the server detail on 404 only when the caller lists it` | pass |
| C20 | `run packs / ✓ keeps the Moedas balance in Missões` | pass |
| C20 | `run packs / ✓ keeps the Moedas balance in Itens` | pass |
| C20 | `run packs / ✓ hides the Moedas balance and the Extrato link in Pacotes at 1440 px` | pass |
| C20 | `run packs / ✓ hides the Moedas balance and the Extrato link in Pacotes at 390 px` | pass |
| C20 | `run packs / ✓ mentions the Pacotes in the opening text while billing is available` | pass |
| C20 | `run packs / ✓ leaves the Pacotes out of the opening text while billing is not available` | pass |
| C21 | `run market / ✓ leads with the purse and lists each Mission in its state` | pass |
| C21 | `run market / ✓ switches to Itens through the URL and previews the first item to buy` | pass |
| Build | `npm run typecheck --workspace apps/frontend` | pass |
| Build | `npm run lint --workspace apps/frontend` | pass |

## Output

`Run packs` - exit 0

```
    ✓ shows the server message on 502 and frees the button (67 ms)
    ✓ shows the server message on 503 and frees the button (107 ms)
    ✓ shows a generic line on any other failure and frees the button (105 ms)
  coming back from the Checkout
    ✓ waits for the payment after checkout=success, then says the items arrive shortly (18 ms)
    ✓ shows no waiting message with checkout=success when the Pacote is already owned (52 ms)
    ✓ shows Adquirido and the Inventário notice when user:packGranted arrives (19 ms)
    ✓ keeps the Inventário notice for a grant that arrives while another tab is open (66 ms)
    ✓ shows the Pacotes with no message after checkout=cancel (11 ms)

Test Suites: 1 passed, 1 total
Tests:       27 passed, 27 total
Snapshots:   0 total
Time:        2.023 s, estimated 3 s
Ran all test suites matching /__tests__\/market-packs.test.tsx/i.
```

`Run billing` - exit 0

```
  openStripePage (S5.4)
    ✓ leaves for Stripe in the same tab on the Web (2 ms)
    ✓ hands the page to the system browser on the native app (2 ms)
  billingErrorMessage (S5.11)
    ✓ uses the server detail on 404 only when the caller lists it (a Pacote)
    ✓ uses the server detail on 409 (1 ms)
    ✓ uses the server detail on 502
    ✓ uses the server detail on 503
    ✓ falls back to a generic line for other failures

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        0.249 s, estimated 1 s
Ran all test suites matching /__tests__\/billing.test.ts/i.
```

`Run realtime` - exit 0

```
    ✓ also refreshes the Raid when the guild session that ended elsewhere had counted for it
    ✓ does not cancel a read already in flight, which may be bringing the canonical result (4 ms)
    ✓ registers the listener once and removes it on dispose
    ✓ refetches the active session after a reconnection, where events may have been missed
    ✓ keeps the pure invalidation rule usable outside the socket
  chat channel on the same socket
    ✓ answers a command with the gateway ack once connected, and refuses while disconnected
    ✓ fails a command in flight as soon as the connection drops
    ✓ lets screens listen to room events and stop listening

Test Suites: 1 passed, 1 total
Tests:       43 passed, 43 total
Snapshots:   0 total
Time:        0.252 s, estimated 1 s
Ran all test suites matching /__tests__\/realtime-client.test.ts/i.
```

`Run market` - exit 0

```
    ✓ keeps the balance and explains a purchase the server refused (417 ms)
    ✓ switches to Itens through the URL and previews the first item to buy (58 ms)
    ✓ buys an item, refreshes the Inventário and equips it on request (125 ms)
    ✓ filters the items by category and shows what is missing for the selected one (30 ms)
    ✓ says so when nothing is for sale (54 ms)
    ✓ offers a retry when the Loja cannot load (399 ms)
  Mercado on a phone
    ✓ shows the purse as a chip that opens the Extrato (423 ms)
    ✓ opens the sheet from a tile and explains a price the balance does not cover (65 ms)

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
Snapshots:   0 total
Time:        3.686 s, estimated 4 s
Ran all test suites matching /__tests__\/market-screen.test.tsx/i.
```
