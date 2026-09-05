# Validação M2 — gate universal

**Data:** 05/09/2026

**Issue:** #39

**Estado:** parcial; a issue permanece aberta até concluir a validação nativa

## Ambiente desta execução

- macOS 26.6.2;
- Node.js 22.22.3 e npm 10.9.8;
- Expo SDK 57.0.20, Expo Router 57.0.19, React Native 0.86.3,
  React 19.2.3, TypeScript 6.0.3 e Jest 29.7;
- Docker Desktop com a imagem de entrega nginx 1.27.
- Xcode 26.6 e iPhone 17 Simulator com iOS 26.5; `adb` indisponível.

As decisões do gate seguiram a documentação oficial do Expo CLI para
`expo install --check` e `expo export`, do Expo SDK 57, da sintaxe de workflows
do GitHub Actions e dos contratos de healthcheck/execução do Docker e
`try_files` do nginx.

## Alterações verificadas

- o job `frontend-quality` da CI executa `npm run verify:m2`, que preserva todo o
  `verify:m1` e acrescenta exportação Web e smoke do container;
- o job separado de entrega foi removido e o job geral `build` compila somente o
  backend, evitando repetir build/export/smoke do frontend;
- o smoke de entrega compara o documento SPA servido em `/`, `/sessao`,
  `/perfil`, `/guilda` e em uma URL inexistente, mantendo as verificações de
  healthcheck, asset com hash, cache e cleanup;
- o README registra o catálogo público, contratos, tokens, breakpoint, destinos,
  comandos e limitações da M2.

## Comandos e resultados desta execução

| Comando | Resultado |
| --- | --- |
| `npm ci` | aprovado; 1.492 pacotes instalados a partir do lockfile |
| `bash -n apps/frontend/test-delivery.sh` | aprovado |
| `git diff --check` | aprovado |
| `npm run typecheck --workspace apps/frontend` | aprovado |
| `npm run lint --workspace apps/frontend` | aprovado |
| `npm test --workspace apps/frontend -- --runTestsByPath __tests__/design-system.test.ts __tests__/navigation.test.tsx __tests__/foundation.test.tsx __tests__/wise-button.test.tsx __tests__/universal-delivery.test.ts` | 5 suítes e 64 testes focados aprovados; zero snapshots; `universal-delivery` executou e conferiu o export Web/iOS/Android |
| `npm test --workspace apps/frontend -- --runTestsByPath __tests__/design-system.test.ts __tests__/wise-button.test.tsx` | validação final de contraste e botão: 2 suítes e 53 testes aprovados |
| `EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=https://api.validation.invalid/v1 npm run build --workspace apps/frontend` | exportação Web aprovada; 757 módulos empacotados |
| `EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=https://api.validation.invalid/v1 npm run verify:m2` | aprovado com 18 suítes/166 testes, `expo install --check`, Expo Doctor 21/21, bundles Web/iOS/Android, export Web e smoke Docker/nginx nas cinco URLs |
| `EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=https://api.validation.invalid/v1 npm test` | suíte integral aprovada: backend 5 suítes/30 testes e frontend 18 suítes/166 testes; zero snapshots |
| `EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=https://api.validation.invalid/v1 npm run ios --workspace apps/frontend -- --device FD162880-E1BA-4935-B18C-5D8949935B5F` | build, instalação e abertura aprovados no iPhone 17 Simulator; zero erros e um warning não relevante de biblioteca `-lc++` duplicada |
| `xcrun simctl openurl booted wise://{,sessao,perfil,guilda,runa-inexistente}` | quatro deep links e fallback exercitados; destino ativo, tela 404 e retorno ao início confirmados no Simulator |

Na iteração, a primeira execução focada revelou que o badge decorativo precisava
ser consultado com `includeHiddenElements`; o primeiro typecheck da função de
luminância também apontou índices possivelmente indefinidos. Ambos foram
corrigidos, e os comandos focados, typecheck e lint foram repetidos com sucesso.

A primeira tentativa de `verify:m2` foi interrompida no Expo Doctor porque o
sandbox bloqueou DNS para `exp.host`. O mesmo comando foi repetido com acesso à
rede e ao Docker, sem alteração de código, e passou integralmente. O build e uma
QA parcial foram executados somente no iPhone 17 Simulator. Não foram executados
build Android, iPhone pequeno, QA Web manual nem as verificações assistivas
completas. Os exports Metro não comprovam build nativo nem execução em
simulador/emulador.

## Auditoria automatizada de contraste

As razões abaixo são calculadas diretamente a partir de `theme.color` com a
fórmula de luminância relativa WCAG. Texto usa limite `4.5:1`; indicadores de
foco e gráficos essenciais usam `3:1`. Ícones explicitamente decorativos não são
tratados como conteúdo essencial.

| Par | Contexto real | Razão | Limite | Resultado |
| --- | --- | ---: | ---: | --- |
| `textPrimary` / `backgroundCanvas` | texto primário no canvas | 16.78:1 | 4.5:1 | aprovado |
| `textPrimary` / `backgroundRaised` | cabeçalho do menu | 16.26:1 | 4.5:1 | aprovado |
| `textPrimary` / `backgroundOverlay` | texto primário no gradiente | 15.53:1 | 4.5:1 | aprovado |
| `textPrimary` / `surfaceCard` | cards e pills | 14.64:1 | 4.5:1 | aprovado |
| `textPrimary` / `surfaceElevated` | controles elevados/interagindo | 13.55:1 | 4.5:1 | aprovado |
| `textPrimary` / `surfaceInset` | campos, feedback e botão danger | 16.46:1 | 4.5:1 | aprovado |
| `textSecondary` / `backgroundCanvas` | placeholder no canvas | 8.60:1 | 4.5:1 | aprovado |
| `textSecondary` / `backgroundRaised` | navegação e destinos futuros | 8.33:1 | 4.5:1 | aprovado |
| `textSecondary` / `backgroundOverlay` | placeholder no gradiente | 7.96:1 | 4.5:1 | aprovado |
| `textSecondary` / `surfaceCard` | descrição do 404 e navegação interagindo | 7.50:1 | 4.5:1 | aprovado |
| `textSecondary` / `surfaceInset` | placeholder de campo e botão disabled | 8.43:1 | 4.5:1 | aprovado |
| `accentPrimary` / `backgroundCanvas` | botão ghost | 9.14:1 | 4.5:1 | aprovado |
| `accentPrimary` / `backgroundRaised` | badge “Em breve” | 8.85:1 | 4.5:1 | aprovado |
| `accentPrimary` / `surfaceCard` | texto RUNA 404 | 7.97:1 | 4.5:1 | aprovado |
| `accentPrimary` / `surfaceElevated` | botão ghost interagindo | 7.38:1 | 4.5:1 | aprovado |
| `accentHighlight` / `backgroundRaised` | marca e controles destacados | 12.37:1 | 4.5:1 | aprovado |
| `accentHighlight` / `surfaceCard` | controle móvel destacado/interagindo | 11.14:1 | 4.5:1 | aprovado |
| `accentHighlight` / `surfaceElevated` | navegação ativa | 10.31:1 | 4.5:1 | aprovado |
| `accentHighlight` / `surfaceInset` | ação do 404 | 12.53:1 | 4.5:1 | aprovado |
| `backgroundCanvas` / `accentPrimary` | label do botão primary | 9.14:1 | 4.5:1 | aprovado |
| `backgroundCanvas` / `accentHighlight` | label do botão primary ativo | 12.77:1 | 4.5:1 | aprovado |
| `accentPrimary` / `backgroundRaised` | indicador de foco na navegação | 8.85:1 | 3:1 | aprovado |
| `accentPrimary` / `surfaceElevated` | indicador de foco junto a superfície elevada | 7.38:1 | 3:1 | aprovado |
| `accentPrimary` / `surfaceInset` | borda de campo focado | 8.96:1 | 3:1 | aprovado |
| `accentPrimary` / `surfaceCard` | preenchimento de progresso | 7.97:1 | 3:1 | aprovado |
| `feedbackDanger` / `surfaceInset` | borda danger/error | 4.02:1 | 3:1 | aprovado |
| `feedbackInfo` / `surfaceInset` | borda de feedback info | 4.96:1 | 3:1 | aprovado |
| `feedbackSuccess` / `surfaceInset` | borda de feedback success | 6.59:1 | 3:1 | aprovado |
| `accentPrimary` / `surfaceInset` | borda de feedback warning | 8.96:1 | 3:1 | aprovado |
| `textTertiary` / `backgroundRaised` | ícone de navegação inativo | 3.36:1 | 3:1 | aprovado |
| `textTertiary` / `surfaceCard` | ícone de navegação inativo durante interação | 3.02:1 | 3:1 | aprovado |

## Matriz de validação da issue

Legenda: **executado** = rodou nesta validação; **automatizado** = coberto pelas
suítes Jest executadas em Node, sem equivaler a QA no dispositivo; **pendente** =
não executado nesta validação; **n/a** = não aplicável.

| Verificação | Web | iOS | Android |
| --- | --- | --- | --- |
| Exportação do bundle | executado | executado via Jest | executado via Jest |
| Build, instalação e abertura do app | n/a | executado no iPhone 17 Simulator | pendente; `adb` indisponível |
| `/`, `/sessao`, `/perfil`, `/guilda` e fallback desconhecido | automatizado; browser pendente | tabs e deep links executados no iPhone 17 | automatizado; deep links pendentes |
| Refresh/fallback SPA no nginx | automatizado no container; browser pendente | n/a | n/a |
| Sidebar/barra inferior e breakpoint 899/900 | automatizado | barra inferior executada no iPhone 17 | automatizado; dispositivo pendente |
| Estado ativo, “Mais” e destinos “Em breve” | automatizado | executado no iPhone 17 | automatizado; dispositivo pendente |
| Teclado, foco, hover e resize | pendente | teclado pendente | teclado e voltar pendentes |
| Safe area, orientação e fonte ampliada | pendente | safe area e portrait/landscape executados no iPhone 17; Dynamic Type pendente | pendente |
| Movimento reduzido | automatizado; preferência real pendente | automatizado; preferência real pendente | automatizado; preferência real pendente |
| Leitor de tela | pendente | VoiceOver pendente | TalkBack pendente |
| Ausência de warnings relevantes em runtime | pendente | abertura sem tela vermelha ou fonte ausente; inspeção completa do Metro pendente | pendente |

## Checklist manual detalhado

Somente os itens marcados abaixo foram executados nesta rodada.

### Web

- [ ] Pendente — viewport 390 px: barra inferior, conteúdo sem cobertura,
  truncamento e menu “Mais”.
- [ ] Pendente — viewport 899 px: composição móvel imediatamente antes do
  breakpoint.
- [ ] Pendente — viewport 900 px: sidebar imediatamente no breakpoint, sem
  remontar ou perder o estado da rota.
- [ ] Pendente — viewport 1280 px: sidebar, largura do conteúdo e gutters.
- [ ] Pendente — viewport 1440 px: sidebar, largura máxima e distribuição do
  conteúdo.
- [ ] Pendente — abrir e atualizar diretamente `/`, `/sessao`, `/perfil`,
  `/guilda` e uma URL inexistente; validar destino ativo único e retorno do
  fallback ao início.
- [ ] Pendente — navegar com Tab e Shift+Tab, conferir indicador de foco de
  2 px e estados hover/pressed.
- [ ] Pendente — redimensionar repetidamente entre 899/900 px preservando rota e
  estado local.
- [ ] Pendente — abrir “Mais”, validar backdrop, botão Fechar, Escape,
  restauração do foco e fundo fora da árvore acessível.
- [ ] Pendente — confirmar que destinos “Em breve” não recebem foco, clique ou
  URL e expõem o nome acessível completo.
- [ ] Pendente — testar movimento reduzido, escala de fonte/truncamento e
  ausência de warnings relevantes no console.

### iOS

- [ ] Pendente — iPhone pequeno em portrait e landscape.
- [x] iPhone 17 com notch em portrait e landscape.
- [x] Safe areas superior/inferior e barra inferior sem cobrir o
  conteúdo.
- [ ] Pendente — Dynamic Type, incluindo textos longos e truncamento.
- [ ] Pendente — VoiceOver: ordem de leitura, nomes, estados ativos, itens “Em
  breve” e isolamento do Modal.
- [ ] Pendente — teclado: foco em campo, acomodação, rolagem e fechamento.
- [x] Modal “Mais”: abrir e fechar pelo botão, preservar a rota e expor os três
  destinos indisponíveis na árvore acessível. Backdrop e restauração de foco
  permanecem pendentes.
- [x] Quatro deep links: `wise://`, `wise://sessao`,
  `wise://perfil` e `wise://guilda`, com rota e destino ativo corretos.
- [x] Deep link desconhecido e retorno ao início pelo fallback.
- [ ] Pendente — redução de movimento e ausência de warnings relevantes no
  Metro/console.

### Android

- [ ] Pendente — aparelho pequeno em portrait e landscape.
- [ ] Pendente — navegação do sistema por gestos em portrait e landscape.
- [ ] Pendente — navegação do sistema por três botões em portrait e landscape.
- [ ] Pendente — safe areas/insets e barra inferior sem cobrir o conteúdo.
- [ ] Pendente — TalkBack: ordem de leitura, nomes, estados ativos, itens “Em
  breve” e isolamento do Modal.
- [ ] Pendente — fonte ampliada, textos longos e truncamento.
- [ ] Pendente — teclado: foco em campo, resize/acomodação, rolagem e
  fechamento.
- [ ] Pendente — Modal “Mais”: abrir, fechar pelo botão/backdrop e preservar a
  rota.
- [ ] Pendente — botão Voltar fecha primeiro o Modal e mantém o pathname.
- [ ] Pendente — quatro deep links: `wise://`, `wise://sessao`,
  `wise://perfil` e `wise://guilda`, com rota e destino ativo corretos.
- [ ] Pendente — deep link desconhecido e retorno ao início pelo fallback.
- [ ] Pendente — redução de movimento e ausência de warnings relevantes no
  Metro/console.

## Checklist de aceite automatizado e de entrega

- [x] `verify:m2` preserva o gate M1 e é o único gate M2 frontend na CI.
- [x] O job geral de build preserva somente o build backend.
- [x] Smoke cobre as quatro rotas disponíveis e uma URL inexistente.
- [x] Catálogo e contratos M2 estão documentados a partir das fontes TypeScript.
- [x] Auditoria numérica cobre pares reais de texto, foco e gráficos essenciais.
- [x] Instalação limpa e `npm run verify:m2` completo aprovados.
- [x] Container nginx aprovado com healthcheck, rotas SPA e política de cache.
- [ ] Parcial — build local iOS compilou, instalou e abriu no iPhone 17;
  iPhone pequeno e Android permanecem pendentes.

## Conclusão

A integração documental e automatizada do gate está pronta, mas a evidência
nativa exigida pela #39 ainda não está completa. A issue não deve ser encerrada
até que os itens pendentes sejam executados e registrados sem tratar exports
Metro como builds ou QA nativos.
