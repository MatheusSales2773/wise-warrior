# Issue #37 — Controles e feedback acessíveis

Implementa o recorte de controles do plano M2 de 04/09/2026. As decisões da
issue são o contrato: cinco componentes independentes de dados, autenticação,
Router e estado de produto, exportados por `@/design-system`.

## Interfaces

| Componente | Contrato público |
| --- | --- |
| `WiseButton` | `label`, `onPress`, `variant` primary/secondary/ghost/danger, `size` medium/large, `loading`, `disabled`, nome acessível opcional |
| `WiseField` | `label`, `nativeID` opcional (gerado por `useId` quando ausente), `helpText`, `error`, props de `TextInput` e `ref` |
| `FeedbackMessage` | `variant` info/success/warning/error, `message`, `title` opcional |
| `ProgressBar` | `value`, `minimumValue=0`, `maximumValue=100`, ou `indeterminate=true`; nome acessível opcional |
| `ResourcePill` | `label`, `icon` decorativo opcional; `onPress` exige `accessibilityLabel` |

Os controles usam tokens Ouro/Índigo e primitivas nativas. O alvo físico mínimo
é 44×44, sem extensão por hitSlop. O slot do indicador do botão permanece no
layout em todos os estados. O campo preserva IDs e substitui ajuda por erro,
com descrição ARIA na Web e hint no nativo. Texto e glifos decorativos distinguem
feedback sem depender só de cor; os glifos ficam fora da árvore acessível.
O botão danger usa texto claro sobre superfície escura e borda vermelha: o vermelho
da paleta como fundo não atingiria 4,5:1 com as cores de texto disponíveis.

O progresso limita apenas a apresentação e preserva o número original na
acessibilidade. O indeterminado usa um segmento pulsante com duração de 240ms
por transição; preferência reduzida mantém o segmento estático, com duração
efetiva zero e sem iniciar loop. A preferência é lida do sistema.

## Verificação

As fronteiras de testes foram confirmadas pelo usuário: componentes renderizados,
interação, props públicas e acessibilidade, incluindo saída Web real.
Os testes Jest usam React Native Testing Library para nativo e React DOM com
o React Native Web instalado para verificar IDs, ARIA e estilos de foco.
O jsdom não calcula dimensões físicas; a estabilidade de largura é verificada
pelo layout invariável e pelo slot sempre presente.

Gates: typecheck, lint, Jest, Expo install --check, Expo Doctor, exportação
Web/iOS/Android, smoke de entrega Docker/nginx e integração de migrations em
MySQL 8 descartável. Nenhuma tela de produto recebe dados de demonstração.

O gate global de lint revelou ausência de configuração no backend. Foi adicionada
configuração para ESLint 8.57.1 e typescript-eslint 8.69.0 com regras recomendadas,
removido um import sem uso e removidos dois `any` desnecessários de teste existente.

## Documentação oficial consultada

Versões confirmadas no lockfile: React 19.2.3, React Native 0.86.3,
React Native Web 0.21.2, Expo 57.0.20, TypeScript 6.0.3 no frontend,
Jest 29.7.0 e React Native Testing Library 14.0.1.

- [React useId](https://react.dev/reference/react/useId): IDs estáveis entre renders.
- [React Native 0.86 acessibilidade](https://reactnative.dev/docs/0.86/accessibility): estado disabled/busy, valores de progresso, label e live regions Android.
- [React Native Pressable](https://reactnative.dev/docs/0.86/pressable): eventos e área física de interação.
- [React Native TextInput](https://reactnative.dev/docs/0.86/textinput): repasse de teclado, autofill e segurança.
- [React Native Animated](https://reactnative.dev/docs/0.86/animated): animação e cancelamento de loop.
- [React Native Web acessibilidade](https://necolas.github.io/react-native-web/docs/accessibility/): propriedades ARIA; o renderer 0.21.2 também foi inspecionado localmente.
- [Expo testes unitários](https://docs.expo.dev/develop/unit-testing/) e [Jest 29.7](https://jestjs.io/docs/29.7/getting-started).
- [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html): contratos discriminados para ações e progresso.
- [typescript-eslint configuração legada](https://typescript-eslint.io/getting-started/legacy-eslint-setup/): reparo do lint existente do backend.
- [WCAG 2.2 contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): contraste do rótulo danger.

## Revisão final

Base: `16f75132d30f57d9d2f96b3af59107041c3a8205`.

### Standards

A revisão Luna xhigh apontou dois requisitos: tokenizar a largura do segmento
indeterminado e corrigir o contraste danger. Ambos foram corrigidos. Também
apontou duplicação do estilo de foco, agora compartilhado em `control-styles`.
Nenhuma pendência desses achados permanece.

### Spec

A tentativa de revisão Luna xhigh foi interrompida por limite de uso antes de
produzir relatório. A revisão foi concluída localmente, conferindo os cinco
contratos e os oito critérios de aceite contra implementação e testes.
Nenhum requisito faltante identificado. O reparo de lint do backend é a extensão
de escopo necessária para aprovar o comando de lint da raiz.

Validação: 113 testes frontend, 30 backend e 1 integração MySQL aprovados;
typecheck e lint dos dois workspaces, Expo Doctor 21/21, exportações das três
plataformas, build backend e smoke Docker/nginx aprovados. As verificações
de acessibilidade são automatizadas; não representam uma sessão manual com
VoiceOver ou TalkBack.
