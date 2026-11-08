# assinatura-premium proofs

**HEAD**: 60955c4
**Tree**: clean
**Shell**: /bin/sh
**Result**: 31 pass, 2 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run settings / ✓ P6, P1: with billing off shows "Free · PREMIUM EM BREVE", no button and no offer` | pass |
| C1 | `run settings / ✓ P2, P1: a free plan on desktop shows the card, the offer beside it and "Como funciona" below` | pass |
| C1 | `run settings / ✓ P3, P1: an active premium shows "Premium ✦", the renewal, "ATIVO", the Portal button and the ` | pass |
| C2 | `run settings / ✓ P2, P1: a free plan on desktop shows the card, the offer beside it and "Como funciona" below` | pass |
| C3 | `run settings / ✓ P2, P10: a free plan on a 390 px phone shows the offer below the card, without "Como funciona` | pass |
| C4 | `run settings / ✓ P2: "Assinar premium" in the card opens the Checkout url, both buttons busy while it loads` | pass |
| C4 | `run settings / ✓ P2: "Assinar premium" in the offer opens the Checkout url, both buttons busy while it loads` | pass |
| C5 | `run settings / ✓ P3, P1: an active premium shows "Premium ✦", the renewal, "ATIVO", the Portal button and the ` | pass |
| C6 | `run settings / ✓ P4: a past_due premium shows "PENDENTE", the in-card error and "Atualizar cartão" opening the` | pass |
| C7 | `run settings / ✓ P5: a premium set to end shows "ATÉ dd/mm", "NÃO RENOVA", the unequip notice and "Gerenciar a` | pass |
| C8 | `run settings / ✓ P6, P1: with billing off shows "Free · PREMIUM EM BREVE", no button and no offer` | pass |
| C9 | `run settings / ✓ P7, S5.5, S5.12: waits for user:planChanged after ?checkout=success, then shows premium witho` | pass |
| C10 | `run settings / ✓ P7: shows the server message of 409 above the card and frees the buttons` | pass |
| C10 | `run settings / ✓ P7: shows the server message of 502 above the card and frees the buttons` | pass |
| C10 | `run settings / ✓ P7: shows the server message of 503 above the card and frees the buttons` | pass |
| C10 | `run settings / ✓ S5.6: back with ?checkout=cancel shows the free state with no error` | pass |
| C11 | `run settings / ✓ P8: the menu shows "PREMIUM ✦" for a premium plan and the plan name otherwise` | pass |
| C11 | `run settings / ✓ P8: the menu keeps "Free" for a free plan with billing on` | pass |
| C12 | `run settings / ✓ points each item of the inner menu at its own address` | pass |
| C12 | `run billing / ✓ leaves for Stripe in the same tab on the Web` | pass |
| C13 | `run settings / ✓ P2, P10: a free plan on a 390 px phone shows the offer below the card, without "Como funciona` | pass |
| C13 | `run settings / ✓ opens the Plano atual: Free · premium em breve row on its own screen and returns with ‹ Confi` | pass |
| C14 | `run settings / ✓ P8: the menu keeps the plan name when the profile is premium but billing is off` | pass |
| C15 | `run settings / ✓ P4: past_due wins over premiumUntil` | pass |
| C15 | `run settings / ✓ P5: dates use the São Paulo calendar (01:00Z of the 9th is still the 8th)` | pass |
| C15 | `run settings / ✓ P3: an active premium without renewsAt shows only "R$ 9,90/MÊS"` | pass |
| C16 | `run settings / ✓ P2: shows at most 3 Itens premium and survives a failed Catálogo` | pass |
| C16 | `run settings / ✓ P2: a failed Catálogo leaves the offer with its buttons and no item rows` | pass |
| C16 | `run settings / ✓ P10: a active premium on a 390 px phone keeps "Gerenciar assinatura" and stacks the owned ite` | **no test ran** |
| C16 | `run settings / ✓ P10: a past_due premium on a 390 px phone keeps "Atualizar cartão" and stacks the owned items` | **no test ran** |
| C16 | `run settings / ✓ P2, P7: lays the offer beside the card and the messages above it (child order)` | pass |
| Build | `npm run typecheck --workspace apps/frontend` | pass |
| Build | `cd apps/frontend && npx eslint src/features/settings __tests__/settings-screen.test.tsx` | pass |

## Output

`Run settings` - exit 0

```
    on phones
      ✓ shows the current name and the 2–60 rule, with Salvar off until the name changes (46 ms)
      ✓ keeps Salvar off for the invalid name "" (38 ms)
      ✓ keeps Salvar off for the invalid name "A" (40 ms)
      ✓ keeps Salvar off for the invalid name "   " (37 ms)
      ✓ keeps Salvar off for the invalid name "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" (53 ms)
      ✓ saves the trimmed name, confirms it and updates the cached profile (42 ms)
      ✓ says so when there is no connection and keeps the typed name to try again (57 ms)
      ✓ shows a generic failure for a server error (59 ms)

Test Suites: 1 passed, 1 total
Tests:       76 passed, 76 total
Snapshots:   0 total
Time:        5.604 s, estimated 6 s
Ran all test suites matching /__tests__\/settings-screen.test.tsx/i.
```

`Run billing` - exit 0

```
  openStripePage (S5.4)
    ✓ leaves for Stripe in the same tab on the Web (5 ms)
    ✓ hands the page to the system browser on the native app (2 ms)
  billingErrorMessage (S5.11)
    ✓ uses the server detail on 404 only when the caller lists it (a Pacote) (1 ms)
    ✓ uses the server detail on 409
    ✓ uses the server detail on 502
    ✓ uses the server detail on 503 (1 ms)
    ✓ falls back to a generic line for other failures (1 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        0.46 s, estimated 1 s
Ran all test suites matching /__tests__\/billing.test.ts/i.
```
