# Validação da issue 60 — layout e acessibilidade do Dashboard

**Data:** 17/09/2026
**Escopo:** composição responsiva e acessível do Dashboard universal
**Branch:** `feat/issue-60-m4-dashboard`

## Comparação com a referência visual

A referência `docs/Wise Warrior _standalone_.html` foi consultada nos estilos
`.dashboard`, `.hero-card` e `.activity`. Ela orienta uma coluna principal,
uma lateral estreita para atividade, um hero com ornamento dourado e linhas
divisórias discretas entre itens.

## Matriz versionada e documentação consultada

As decisões usam as versões instaladas no workspace: React Native `0.86.3`,
React Native Web `0.21.2`, Expo `57.0.23`, React `19.2.3`, TanStack Query
`5.102.8`, Jest `29.7.0` e React Native Testing Library `14.0.1`. Foram
consultadas as referências oficiais de [acessibilidade do React Native
0.86](https://reactnative.dev/docs/0.86/accessibility), [`RefreshControl`
0.86](https://reactnative.dev/docs/0.86/refreshcontrol), [acessibilidade do
React Native Web](https://necolas.github.io/react-native-web/docs/accessibility/),
[TanStack Query para React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)
e [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/). Elas confirmam o
`refreshing` controlado, `accessibilityValue`/`accessibilityLiveRegion`, a
necessidade de foco Web e a integração de foco por `AppState` já existente.

As adaptações para o Dashboard real são:

- os tokens existentes de índigo, ouro, pergaminho, Cinzel e Inter permanecem
  a fonte da identidade; nenhum HTML, CSS ou dado demonstrativo da referência é
  incorporado;
- Web a partir de 900 px usa a composição em duas colunas, enquanto Web estreita,
  iOS e Android mantêm a ordem boas-vindas, progressão e atividade;
- os cards usam conteúdo interno com `cardInset`, limites flexíveis e quebra de
  texto para suportar nomes, matérias e mensagens longas;
- a atividade continua sendo um conjunto limitado de `View`s dentro do
  `ScrollView` de `Screen`, sem `FlatList`, `VirtualizedList` ou `ScrollView`
  aninhado;
- `Screen` recebe `safeAreaEdges={[]}` porque o `AppShell` autenticado já
  reserva safe areas e a navegação inferior.

## Evidência automatizada

- `npm test --workspace apps/frontend -- --runInBand __tests__/dashboard-screen.test.tsx`
  — 24 testes passando;
- `npm run typecheck --workspace apps/frontend` — passando;
- `npm run lint --workspace apps/frontend` — passando;
- `npm test` — 14 suítes/116 testes do backend e 32 suítes/331 testes do
  frontend passando;
- `npm run build --workspace apps/frontend` — export Web passando;
- `npm run export:bundles --workspace apps/frontend` — bundles Web, iOS e
  Android exportados;
- `git diff --check` — passando.

Os testes cobrem 320/390 px, Web larga, iOS/Android em largura grande,
ausência de título, conteúdo longo com fonte ampliada, ordem semântica, safe
area, `ProgressBar` com role/nome/valor, loading busy, erros parciais —
incluindo falha de atualização do perfil com cache —, refresh e ação Web.

As cores são os tokens já auditados no gate M2: texto primário/secundário em
cards, preenchimento da progressão e feedback de erro/sucesso atendem aos
limiares WCAG AA documentados em
[`2026-09-05-m2-universal-gate.md`](2026-09-05-m2-universal-gate.md).

## QA manual universal

Ainda requer execução em navegador/dispositivo com API real: foco por teclado e
outline Web, fonte ampliada, VoiceOver, TalkBack, pull-to-refresh, rotação,
safe areas físicas e movimento reduzido. Essa evidência não é simulada pelos
testes de componentes.
