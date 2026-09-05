# Plano de implementação — M2 Design system e navegação universal

**Data:** 04/09/2026

**Status:** Pronto para implementação

**Milestone:** M2 — Design system e navegação

**Depende de:** M1 — Fundação Expo universal concluída

**Fontes de produto:**

- `docs/plans/2026-09-03-react-native-migration-prioritization-design.md`;
- `docs/plans/2026-09-03-react-native-universal-design.md`;
- `docs/plans/2026-09-03-react-native-universal-discovery.md`;
- `docs/PRD.md`;
- `docs/Wise Warrior _standalone_.html`, somente como referência visual.

## 1. Resultado esperado

Ao concluir a M2, `apps/frontend` terá a base visual e o shell de navegação que
serão reutilizados por M3–M7 em Web, iOS e Android. A entrega inclui:

- tema Ouro/Índigo convertido em tokens TypeScript sem valores visuais dispersos;
- fontes Cinzel, Inter e JetBrains Mono empacotadas e carregadas sem depender da
  rede em runtime;
- primitivas próprias para texto, botões, campos, cards, feedback, progresso e
  estrutura de tela;
- sidebar na Web desktop e navegação inferior em celulares;
- os mesmos destinos, URLs e estados ativos nas três plataformas;
- tratamento explícito de safe areas, teclado, foco visível, leitor de tela,
  alvos de toque e movimento reduzido;
- entradas futuras visíveis e indisponíveis com o rótulo “Em breve”;
- telas neutras de transição para os quatro destinos funcionais, sem dados
  fictícios e sem antecipar autenticação ou features.

A M2 não cria telas de produto completas. Seu resultado é um contrato de UI
executável, acessível e testado sobre o qual Login, Dashboard, Perfil, Guilda e
Study Session serão construídos.

## 2. Estado confirmado antes da mudança

### Stack instalada em 04/09/2026

| Tecnologia | Versão confirmada | Papel na M2 |
| --- | --- | --- |
| Expo | `57.0.20` | runtime universal e instalação compatível |
| Expo Router | `57.0.19` | rotas por arquivo, links e layout compartilhado |
| React Native | `0.86.3` | primitivas, estilos, acessibilidade e responsividade |
| React Native Web | `0.21.x` | renderização da mesma UI na Web |
| React | `19.2.3` | composição e hooks |
| TypeScript | `6.0.3` | tokens, variantes e catálogo de navegação tipados |
| Jest | `29.7.x` | testes unitários e de componentes |
| React Native Testing Library | `14.0.1` | testes de interação e acessibilidade |

A M1 está registrada como concluída no commit `dfd81eb`. A aplicação atual tem
somente `/`, `+not-found`, validação de `EXPO_PUBLIC_API_URL` e o gate universal.
Não existem ainda tokens, fontes, biblioteca de componentes ou rotas de produto.

### Dependências previstas

Instalar pelo `expo install`, aceitando somente versões compatíveis com o SDK 57:

```bash
npm exec --workspace apps/frontend -- expo install \
  expo-font expo-splash-screen expo-linear-gradient react-native-svg @expo/vector-icons
```

Antes de alterar o lockfile, registrar no PR ou commit as versões resolvidas por
`expo install --check`. Não instalar NativeWind, Tailwind, biblioteca completa de
componentes, tema pronto ou pacote de navegação paralelo ao Expo Router.

Fontes serão arquivos estáticos locais, acompanhados das respectivas licenças
OFL. Usar somente os pesos realmente necessários:

- Cinzel 600 e 700 para títulos e marcas;
- Inter 400, 500, 600 e 700 para corpo e controles;
- JetBrains Mono 500 e 600 para números e metadados.

## 3. Decisões de implementação

### 3.1 Um único shell adaptativo

O grupo `src/app/(app)` terá um layout com `Slot` e `AppNavigation`. O catálogo de
destinos será uma estrutura TypeScript única consumida por sidebar e barra
inferior. A largura disponível, obtida por `useWindowDimensions`, escolhe apenas
a composição visual:

- Web com largura a partir de `900 dp`: sidebar fixa de `248 dp`;
- Web abaixo de `900 dp`, iOS e Android: navegação inferior;
- tablets continuam fora do aceite e recebem a composição móvel sem otimização
  específica.

O breakpoint é uma decisão do produto, não uma detecção por user agent. Alterar o
tamanho da janela Web deve trocar a composição sem recarregar nem perder a rota.

As custom tabs de `expo-router/ui` não serão usadas: no Expo Router 57 elas ainda
são experimentais e não são necessárias para o shell. Também não será criado um
navegador customizado sobre APIs `unstable_*`. `Slot`, `Link`, `usePathname` e
rotas por arquivo fornecem o contrato estável necessário.

### 3.2 Catálogo de destinos

| Destino | Rota | Estado na M2 | Web | Celular |
| --- | --- | --- | --- | --- |
| Acampamento | `/` | funcional | sidebar | barra inferior |
| Forja | `/sessao` | funcional | sidebar | barra inferior |
| Personagem | `/perfil` | funcional | sidebar | barra inferior |
| Guilda | `/guilda` | funcional | sidebar | barra inferior |
| Mercado Arcano | nenhuma | “Em breve”, não interativo | sidebar | menu Mais |
| Crônicas | nenhuma | “Em breve”, não interativo | sidebar | menu Mais |
| Configuração | nenhuma | “Em breve”, não interativo | sidebar | menu Mais |

“Funcional” nesta tabela significa que a navegação resolve uma rota real; o
conteúdo da feature continua reservado à milestone correspondente. O destino
ativo usa `usePathname`. Itens futuros não recebem `href`, não criam arquivos de
rota, não entram na ordem de foco e não respondem a clique/toque. Cada linha
exibe o badge “Em breve” e seu nome acessível é “{nome}, indisponível, em breve”.

Na barra inferior, “Mais” é um controle local, não uma quinta rota. Ele abre um
`Modal` do React Native, apresentado como bottom sheet, com os três itens futuros.
Não será instalada uma biblioteca de modal. Fechar pelo botão “Fechar”, gesto de
voltar do Android, Escape na Web ou toque fora devolve foco ao controle que abriu
o menu.

### 3.3 Tokens semânticos e tema único

Separar valores primitivos de papéis semânticos:

```text
tokens/
├── primitives.ts     # escalas brutas de cor e tamanho
├── colors.ts         # background, surface, text, border, action, feedback
├── typography.ts     # famílias, pesos, tamanhos, alturas e tracking
├── spacing.ts        # escala de 4 dp
├── shape.ts          # raios e larguras de borda
├── elevation.ts      # sombras/elevação por plataforma
├── motion.ts         # durações e easing; zero quando redução está ativa
├── layout.ts         # larguras, gutters, breakpoints e touch target
└── index.ts          # única API pública dos tokens
```

A paleta bruta fica fechada nos valores abaixo, extraídos do standalone. O agente
não deve escolher novas cores para a M2:

| Papel primitivo | Valor |
| --- | --- |
| fundo void/deep/elevated | `#07070c` / `#0c0c14` / `#12121c` |
| card/card hover/inset | `#181826` / `#1f1f2e` / `#0a0a12` |
| linha faint/soft/default/strong | `rgba(212,168,90,0.08)` / `0.16` / `0.28` / `0.45` |
| ouro default/bright/dim/glow | `#d4a85a` / `#f0c97a` / `#8a6a3a` / `rgba(212,168,90,0.35)` |
| feedback danger/info/success/critical/rare | `#c44545` / `#5b7fc4` / `#4ea672` / `#d65a8a` / `#8a5bc4` |
| texto default/dim/muted/faint | `#f3ead4` / `#b3a98e` / `#6b6555` / `#46412f` |

Aliases semânticos podem reutilizar esses valores, mas não criar hexadecimais ou
RGBA adicionais. Se um par falhar WCAG AA, manter a paleta e trocar o alias para
outro valor aprovado da tabela; não ajustar a cor por tentativa visual. Índigo
serve como profundidade e contraste, não como segundo tema selecionável.

As escalas também ficam fixas:

- espaçamento: `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`;
- raios: `3, 5, 8, 12` e `999` somente para pills;
- bordas: `1` padrão e `2` para foco;
- tipografia em pares tamanho/altura: display `32/40`, title `24/32`, subtitle
  `18/26`, body `16/24`, label `14/20`, caption `12/16`, mono `14/20`;
- layout: touch target `44`, sidebar `248`, breakpoint desktop `900`, conteúdo
  máximo `1200`, gutter móvel `16`, Web estreita `24` e Web larga `32`;
- movimento: instantâneo `0`, rápido `120 ms`, padrão `180 ms`, lento `240 ms`.

Componentes consomem somente tokens semânticos. Exceções permitidas são valores
derivados em SVG/gradiente que não aceitem referência indireta; mesmo nesses
casos, a origem deve continuar no módulo de tokens. Não criar contexto ou seletor
de tema na M2.

Todos os pares de texto/fundo e estados interativos precisam passar WCAG AA. Para
texto normal, usar razão mínima `4.5:1`; para texto grande e elementos gráficos
essenciais, `3:1`. Ouro não deve ser usado como texto pequeno quando falhar no
fundo correspondente.

### 3.4 Tipografia e carregamento inicial

Os arquivos TTF estáticos vêm do repositório oficial Google Fonts e ficam em
`apps/frontend/assets/fonts`, acompanhados de cada licença OFL. Usar os arquivos
estáticos — não as versões variáveis — nos pesos definidos na seção 2. O plugin de
`expo-font` os incorpora em builds nativos; na Web, `useFonts` os carrega antes de
liberar a árvore visual. `expo-splash-screen` mantém a tela inicial até a carga
terminar. Erro de fonte deve liberar a aplicação com famílias de fallback e ser
registrável, nunca deixar a tela vazia indefinidamente.

Os tokens expõem famílias por papel:

- `display`: Cinzel;
- `body`: Inter;
- `mono`: JetBrains Mono.

Pesos usados pelos componentes devem corresponder a arquivos realmente
empacotados. Não simular `fontWeight` inexistente nem baixar fontes em runtime.

### 3.5 Acessibilidade e interação

- Todo alvo interativo mede no mínimo `44 × 44 dp`; `hitSlop` complementa áreas
  visuais menores sem criar sobreposição entre controles.
- `Pressable` representa estados default, pressed, hovered, focused e disabled.
- Na Web, foco por teclado recebe contorno visível de `2 px`, sem remover o
  outline sem substituição equivalente.
- Estados disabled usam `disabled`, `accessibilityState={{ disabled: true }}` e
  texto explícito; diferença de cor sozinha não comunica estado.
- Ícones decorativos ficam ocultos da árvore de acessibilidade; controles com
  ícone recebem nome acessível independente do glifo.
- `WiseIcon` usa somente `Ionicons` de `@expo/vector-icons`. O mapeamento é:
  Acampamento `home-outline`/`home`, Forja `hammer-outline`/`hammer`, Personagem
  `person-outline`/`person`, Guilda `shield-outline`/`shield` e Mais
  `ellipsis-horizontal-circle-outline`/`ellipsis-horizontal-circle`. Itens
  futuros, por serem não interativos, não exibem ícone.
- `AccessibilityInfo.isReduceMotionEnabled()` e o evento
  `reduceMotionChanged` alimentam `useReducedMotion`. Animações ornamentais e
  transições não essenciais usam duração zero quando a preferência está ativa.
- Mudanças de feedback relevantes usam `accessibilityLiveRegion`/anúncio
  apropriado, sem anunciar decoração.
- `Screen` aplica safe-area insets explicitamente e evita somar inset duas vezes
  com a barra inferior.
- `KeyboardAvoidingView` e `ScrollView` são responsabilidade do `Screen` quando
  houver campo; o comportamento deve ser validado em login/cadastro na M3, mas a
  primitiva e um harness de M2 já cobrem abertura e rolagem.

## 4. Estrutura alvo ao concluir M2

```text
apps/frontend/
├── assets/
│   └── fonts/
│       ├── OFL-*.txt
│       ├── Cinzel-*.ttf
│       ├── Inter-*.ttf
│       └── JetBrainsMono-*.ttf
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   ├── guilda.tsx
│   │   │   ├── perfil.tsx
│   │   │   └── sessao.tsx
│   │   ├── +not-found.tsx
│   │   └── _layout.tsx
│   └── design-system/
│       ├── components/
│       │   ├── AppNavigation.tsx
│       │   ├── FeedbackMessage.tsx
│       │   ├── ProgressBar.tsx
│       │   ├── ResourcePill.tsx
│       │   ├── Screen.tsx
│       │   ├── WiseButton.tsx
│       │   ├── WiseCard.tsx
│       │   ├── WiseField.tsx
│       │   ├── WiseText.tsx
│       │   └── index.ts
│       ├── hooks/
│       │   ├── useReducedMotion.ts
│       │   └── useResponsiveLayout.ts
│       ├── icons/
│       │   ├── WiseIcon.tsx
│       │   └── index.ts
│       ├── navigation/
│       │   ├── destinations.ts
│       │   ├── MobileNavigation.tsx
│       │   ├── MoreMenu.tsx
│       │   └── WebSidebar.tsx
│       ├── providers/
│       │   └── FontProvider.tsx
│       └── tokens/
│           ├── colors.ts
│           ├── elevation.ts
│           ├── index.ts
│           ├── layout.ts
│           ├── motion.ts
│           ├── primitives.ts
│           ├── shape.ts
│           ├── spacing.ts
│           └── typography.ts
└── __tests__/
    ├── accessibility.test.tsx
    ├── components.test.tsx
    ├── navigation.test.tsx
    ├── reduced-motion.test.tsx
    ├── responsive-layout.test.tsx
    └── tokens.test.ts
```

Arquivos `.web.tsx` ou `.native.tsx` só serão criados se uma API concreta exigir
implementação distinta. Diferença de estilo resolvida por props ou tokens não
justifica duplicar um componente.

## 5. Contratos dos componentes mínimos

### `WiseText`

Centraliza `display`, `title`, `body`, `label`, `caption` e `mono`; preserva
escalonamento de fonte do sistema por padrão. Aceita cor semântica e não permite
família arbitrária. Headings recebem nível/role acessível onde suportado.

### `WiseButton`

Variantes `primary`, `secondary`, `ghost` e `danger`; tamanhos que nunca ficam
abaixo de 44 dp; estados loading e disabled mutuamente coerentes. Loading mantém
o rótulo acessível, impede múltiplos acionamentos e não muda a largura.

### `WiseField`

Composição de label, `TextInput`, ajuda e erro. `label` é obrigatório; erro usa
cor, texto e anúncio acessível. A primitiva repassa props nativas de teclado,
autofill e segurança sem tentar inferir regras do formulário.

### `WiseCard`

Superfície estrutural com variantes `default`, `elevated` e `ornamented`.
Ornamentos são decorativos e opcionais. Card não vira botão implicitamente; uma
ação exige composição explícita com `Pressable` ou `WiseButton`.

### `FeedbackMessage`

Variantes `info`, `success`, `warning` e `error`, com ícone, título opcional e
mensagem. O estado não depende apenas de cor. Feedback urgente e feedback
informativo usam politeness apropriada para não interromper leitores de tela.

### `ProgressBar`

Recebe `value`, `minimumValue` e `maximumValue`, limita visualmente valores fora
do intervalo e expõe `accessibilityRole="progressbar"` com valor atual, mínimo e
máximo. Indeterminado é uma variante explícita e respeita movimento reduzido.

### `ResourcePill`

Exibe metadado curto com ícone opcional. É não interativo por padrão; quando
acionável, exige `onPress` e nome acessível. Não será usado para inventar XP,
moedas ou recursos ainda ausentes do backend.

### `Screen`

Controla fundo, largura máxima, gutters, safe-area edges, rolagem e acomodação de
teclado. Recebe título acessível e conteúdo, mas não conhece autenticação nem
dados remotos.

### `AppNavigation`

Consome o catálogo imutável de destinos, pathname atual e callbacks de feedback.
Escolhe sidebar ou barra inferior pelo layout responsivo. Não possui regras de
autorização na M2; M3 poderá filtrar/proteger o grupo de rotas sem reescrever os
componentes visuais.

`TimerRing` fica fora da M2. Embora citado no design system futuro, seu contrato
depende da projeção temporal e do SVG definitivo de M7; antecipá-lo produziria um
componente sem regra de negócio validável.

## 6. Tarefas de implementação

### Tarefa 1 — Fixar dependências e assets tipográficos

**Arquivos:**

- `apps/frontend/package.json`;
- `package-lock.json`;
- `apps/frontend/app.json`;
- `apps/frontend/assets/fonts/*`.

1. Instalar dependências com `expo install`.
2. Baixar arquivos estáticos das famílias escolhidas de fonte oficial/confiável.
3. Versionar os arquivos OFL e registrar origem e versão.
4. Configurar o plugin `expo-font` para os builds nativos.
5. Confirmar nomes de família e pesos em iOS e Android após prebuild local.

**Verificação:** `expo install --check`, `expo config --type public` e teste de
renderização dos três papéis tipográficos na Web e nos dois simuladores.

### Tarefa 2 — Criar tokens e auditoria de contraste

**Arquivos:** `src/design-system/tokens/*` e `__tests__/tokens.test.ts`.

1. Extrair a paleta Ouro/Índigo do standalone e documentos de interface.
2. Separar primitivos e aliases semânticos.
3. Definir escalas de tipografia, espaço, forma, elevação, layout e movimento.
4. Cobrir invariantes: escala crescente, touch target 44, breakpoint 900 e
   ausência de cor crua nos contratos públicos.
5. Registrar uma tabela dos pares de contraste usados pelos componentes.

**Verificação:** teste automatizado dos tokens e auditoria de contraste para
texto, bordas de foco e estados de feedback.

### Tarefa 3 — Implementar fontes e preferências de acessibilidade

**Arquivos:**

- `src/design-system/providers/FontProvider.tsx`;
- `src/design-system/hooks/useReducedMotion.ts`;
- `src/app/_layout.tsx`;
- testes dos providers/hooks.

O layout raiz coordena splash e fontes. O hook de movimento consulta o valor
inicial e assina mudanças, removendo o listener no unmount. Falha de consulta
assume movimento reduzido desligado, sem quebrar a renderização.

**Verificação:** fontes carregadas, fallback em erro, splash liberado nos dois
caminhos e listener removido em teste.

### Tarefa 4 — Implementar primitivas estruturais

**Arquivos:** `WiseText`, `WiseCard`, `Screen`, `WiseIcon` e respectivos testes.

Construir primeiro componentes sem interação. Traduzir a direção dark-RPG por
bordas, gradientes e composição, sem pseudo-elementos, CSS global ou WebView.
Validar textos longos, Dynamic Type e viewport estreita.

### Tarefa 5 — Implementar controles e feedback

**Arquivos:** `WiseButton`, `WiseField`, `FeedbackMessage`, `ProgressBar`,
`ResourcePill` e testes.

Cobrir variantes e estados por testes comportamentais, sem snapshots como prova
principal. Estado visual precisa corresponder às props acessíveis. Nenhuma
primitiva acessa API, Router ou estado global.

### Tarefa 6 — Criar catálogo e rotas de transição

**Arquivos:**

- `src/design-system/navigation/destinations.ts`;
- `src/app/(app)/index.tsx`;
- `src/app/(app)/sessao.tsx`;
- `src/app/(app)/perfil.tsx`;
- `src/app/(app)/guilda.tsx`;
- remoção de `src/app/index.tsx` após a nova `/` funcionar.

Cada tela usa `Screen`, título do destino e uma mensagem honesta de etapa de
migração. Não usar métricas, usuário, guilda, sessão, missão ou atividade falsa.
As mensagens são conteúdo local legítimo e temporário, não fixtures de produto.

**Verificação:** as quatro URLs resolvem diretamente, inclusive por refresh Web
e deep link nativo de desenvolvimento.

### Tarefa 7 — Implementar sidebar Web

**Arquivos:** `WebSidebar.tsx`, `AppNavigation.tsx` e testes.

A sidebar mantém marca, destinos principais e área de itens futuros. Deve indicar
rota ativa por semântica e estilo, permitir Tab/Shift+Tab e conservar foco
visível. Itens “Em breve” não navegam.

**Verificação:** viewport Web ≥900, navegação por mouse e teclado, URL/estado
ativo, feedback dos itens futuros e resize cruzando o breakpoint.

### Tarefa 8 — Implementar navegação móvel e menu Mais

**Arquivos:** `MobileNavigation.tsx`, `MoreMenu.tsx`, `AppNavigation.tsx` e testes.

A barra inferior respeita inset inferior e não cobre o conteúdo rolável. Os
quatro destinos permanecem sempre visíveis. O menu Mais contém somente os três
itens futuros e segue o comportamento de foco/fechamento definido na seção 3.2.

**Verificação:** iPhone com notch, Android com navegação por gestos e por três
botões, orientação portrait e landscape, leitor de tela e botão voltar.

### Tarefa 9 — Integrar o shell ao grupo de rotas

**Arquivos:** `src/app/(app)/_layout.tsx`, `src/app/_layout.tsx` e `+not-found`.

O layout do grupo envolve `Slot` com shell e navegação; o layout raiz mantém
providers realmente usados. O fallback passa a consumir tokens e primitivas, mas
continua fora do shell para evitar indicar destino ativo inexistente.

**Verificação:** nenhuma tela duplica sidebar/barra, rota desconhecida continua
retornando a `/` e a mudança de composição não remonta a tela atual.

### Tarefa 10 — Atualizar gates, documentação e QA visual

**Arquivos:**

- `apps/frontend/package.json`;
- `.github/workflows/ci.yml`, somente se o comando do gate mudar;
- `README.md`;
- `docs/validation/2026-09-04-m2-design-system-navigation.md`.

Criar `verify:m2` preservando todo o `verify:m1` e acrescentando os testes da M2.
Documentar o catálogo de componentes, a regra de tokens, o breakpoint e como
executar o harness visual. Registrar screenshots/checklist das três plataformas,
sem versionar artefatos de build ou pastas nativas geradas.

## 7. Estratégia de testes

### Unitários

- tokens e aliases preservam invariantes;
- `useResponsiveLayout` muda em torno de `899/900 dp`;
- `useReducedMotion` consulta, reage e faz cleanup;
- normalização do progresso e seleção do destino ativo;
- catálogo não associa rota a item “Em breve”.

### Componentes

- todas as variantes e estados das primitivas;
- controles disabled não disparam ação;
- loading impede acionamento duplicado;
- erros de campo estão associados ao campo e são anunciáveis;
- sidebar e barra inferior chegam às mesmas rotas;
- menu Mais abre, fecha e restaura foco;
- itens futuros fornecem feedback sem alterar pathname;
- touch target e props acessíveis mínimas.

### Integração de rotas

- `/`, `/sessao`, `/perfil` e `/guilda` resolvem pelo Router;
- refresh Web preserva a rota por meio do fallback SPA existente;
- rota desconhecida usa `+not-found` e retorna a `/`;
- o layout adaptativo preserva conteúdo e pathname ao redimensionar.

### QA manual/visual

| Plataforma | Viewports mínimos | Verificações adicionais |
| --- | --- | --- |
| Web | 390, 899, 900, 1280 e 1440 px | teclado, hover, foco 2 px, resize e refresh |
| iOS | iPhone pequeno e iPhone com notch | safe area, Dynamic Type, VoiceOver e teclado |
| Android | aparelho pequeno e aparelho com gestos | TalkBack, voltar, fonte ampliada e teclado |

Em todas: contraste, truncamento, orientação, estado ativo, “Em breve”, redução
de movimento e ausência de warning relevante no Metro/console.

## 8. Gate de aceite

Executar a partir da raiz:

```bash
npm ci
npm run typecheck --workspace apps/frontend
npm run lint --workspace apps/frontend
npm test --workspace apps/frontend
npm run expo:check --workspace apps/frontend
npm run expo:doctor --workspace apps/frontend
npm run export:bundles --workspace apps/frontend
npm run build --workspace apps/frontend
npm run test:delivery --workspace apps/frontend
npm run ios --workspace apps/frontend
npm run android --workspace apps/frontend
```

Critérios de conclusão:

- tokens semânticos são a única fonte de valores visuais compartilhados;
- Cinzel, Inter e JetBrains Mono funcionam offline em Web, iOS e Android;
- primitivas mínimas possuem estados e contratos acessíveis testados;
- Web larga usa sidebar e celulares usam barra inferior;
- os quatro destinos reais compartilham rotas e estado ativo;
- Mercado Arcano, Crônicas e Configuração aparecem como “Em breve”, sem rota;
- todos os alvos interativos têm ao menos 44 × 44 dp;
- foco Web tem indicador de 2 px e navegação por teclado completa;
- safe areas, teclado e movimento reduzido foram verificados;
- não existem dados fictícios, chamadas ao backend ou regras de autenticação;
- gates da M1 continuam aprovados;
- `ios/`, `android/`, `.expo/`, `dist/` e screenshots temporários não aparecem no
  diff.

## 9. Sequência planejada de commits

1. `feat(frontend): add gold theme tokens and fonts`
2. `feat(frontend): add accessible universal UI primitives`
3. `feat(frontend): add adaptive app navigation shell`
4. `test(frontend): cover M2 accessibility and navigation`
5. `docs(frontend): record M2 universal validation`

Cada commit passa por typecheck, lint e testes pertinentes. O último commit só
ocorre após o gate manual das três plataformas.

## 10. Fora do escopo

- login, cadastro, sessão autenticada, proteção de rotas e credenciais (M3);
- perfil, XP, progressão e atividade reais (M4/M5);
- guilda, raids, chat ou ranking (M6/P4);
- timer, `TimerRing`, matéria, Pomodoro e Study Session (M7/P0–P3);
- TanStack Query, Axios conectado, Socket.IO ou estado remoto;
- tema selecionável, Carmim, Verdor ou Arcano;
- áudio, notificações, offline e persistência de preferências;
- tablet como composição própria;
- Storybook, catálogo externo de componentes ou testes de screenshot em CI;
- NativeWind, Tailwind, framework de UI ou custom tabs experimentais;
- animações ornamentais complexas e assets cosméticos finais.

## 11. Recuperação e bloqueios

- Se uma dependência não for compatível com SDK 57, não usar `--force`; escolher
  a versão indicada pelo Expo ou registrar o bloqueio para decisão.
- Se o nome/peso de fonte divergir entre plataformas, corrigir configuração e
  tokens antes de criar componentes dependentes; não simular peso.
- Se `Slot` não preservar estado ao trocar a composição, manter uma única árvore
  de conteúdo e mover somente os elementos de navegação.
- Se contraste da referência visual falhar, acessibilidade prevalece; ajustar o
  token semântico e registrar a diferença em relação ao standalone.
- Se uma API Web exigir estilo não tipado pelo React Native, isolar a menor
  implementação possível em arquivo `.web.tsx`, com teste e comentário de razão.
- Se o teclado ainda não puder ser validado por falta de formulário real, manter
  o harness de `WiseField` e repetir o gate na M3 antes de considerar login pronto.
- Não alterar contratos backend nem antecipar autenticação para tornar placeholders
  “realistas”.

## 12. Documentação oficial consultada

Referências versionadas que materialmente orientam este plano:

- [Expo Router — layouts de navegação](https://docs.expo.dev/router/basics/navigation-layouts/);
- [Expo Router — JavaScript tabs](https://docs.expo.dev/router/advanced/tabs/);
- [Expo Router — custom tabs experimentais](https://docs.expo.dev/router/advanced/custom-tabs/);
- [Expo SDK 57 — Font](https://docs.expo.dev/versions/v57.0.0/sdk/font/);
- [Expo — uso de fontes](https://docs.expo.dev/develop/user-interface/fonts/);
- [Expo SDK 57 — SplashScreen](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/);
- [Expo SDK 57 — LinearGradient](https://docs.expo.dev/versions/v57.0.0/sdk/linear-gradient/);
- [Expo SDK 57 — react-native-safe-area-context](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/);
- [React Native 0.86 — Pressable](https://reactnative.dev/docs/0.86/pressable);
- [React Native 0.86 — Accessibility](https://reactnative.dev/docs/0.86/accessibility);
- [React Native 0.86 — AccessibilityInfo](https://reactnative.dev/docs/0.86/accessibilityinfo);
- [React Native 0.86 — useWindowDimensions](https://reactnative.dev/docs/0.86/usewindowdimensions);
- [React Native 0.86 — KeyboardAvoidingView](https://reactnative.dev/docs/0.86/keyboardavoidingview).

As versões exatas das novas bibliotecas devem ser reconfirmadas imediatamente
antes da instalação. Mudança de patch compatível indicada pelo Expo não altera a
arquitetura; mudança de SDK ou uso de API experimental exige revisão deste plano.
