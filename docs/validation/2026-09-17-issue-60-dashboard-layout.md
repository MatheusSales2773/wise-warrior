# Validação da issue 60 — layout e acessibilidade do Dashboard

**Data:** 17/09/2026  
**Escopo:** composição responsiva e acessível do Dashboard universal  
**Branch:** `feat/issue-60-m4-dashboard`

## Comparação com a referência visual

A referência `docs/Wise Warrior _standalone_.html` foi consultada nos estilos
`.dashboard`, `.hero-card` e `.activity`. Ela orienta uma coluna principal,
uma lateral estreita para atividade, um hero com ornamento dourado e linhas
divisórias discretas entre itens.

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
  — 21 testes passando;
- `npm run typecheck --workspace apps/frontend` — passando;
- `npm run lint --workspace apps/frontend` — passando;
- `git diff --check` — passando.

Os testes cobrem 320/390 px, Web larga, iOS/Android em largura grande,
ausência de título, conteúdo longo, ordem semântica, safe area, `ProgressBar`
com role/nome/valor, loading busy, erros parciais, refresh e ação Web.

## QA manual universal

Ainda requer execução em navegador/dispositivo com API real: foco por teclado e
outline Web, fonte ampliada, VoiceOver, TalkBack, pull-to-refresh, rotação,
safe areas físicas e movimento reduzido. Essa evidência não é simulada pelos
testes de componentes.
