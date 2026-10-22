# Frontend universal (Expo)

Aplicação única para Web, iOS e Android, construída com Expo SDK 57, Expo Router
e React Native Web (ADR-008). Para instalar e executar, veja o
[README da raiz](../../README.md#frontend-web-ios-e-android).

## Organização de `src/`

| Diretório | Responsabilidade |
| --- | --- |
| `app/` | Rotas do Expo Router. `(public)` reúne as telas sem login; `(app)` reúne as telas protegidas |
| `features/` | Telas e hooks por domínio: `auth`, `dashboard`, `study-session`, `character`, `profile`, `guild`, `market`, `settings` |
| `core/api` | Cliente Axios, token de acesso em memória e erros RFC 7807 |
| `core/auth` | Contexto de autenticação e armazenamento do refresh token (cookie na Web, SecureStore no nativo) |
| `core/query` | Runtime do TanStack Query e detecção de conexão |
| `core/realtime` | Cliente Socket.IO que invalida consultas do TanStack Query a cada evento |
| `design-system/` | Componentes, tema e catálogo de navegação |
| `config/` | Leitura das variáveis `EXPO_PUBLIC_*` |

## Destinos e layout adaptativo

| Destino | Rota | Estado |
| --- | --- | --- |
| Acampamento | `/` | disponível |
| Forja | `/sessao` | disponível |
| Personagem | `/perfil` | disponível |
| Guilda | `/guilda` | disponível |
| Mercado | `/mercado` | disponível |
| Crônicas | nenhuma | “Em breve” |
| Configuração | `/configuracao` e uma subrota por seção | disponível |

Web a partir de `900 px` usa sidebar; Web abaixo desse breakpoint, iOS e Android
usam barra inferior e o menu local “Mais”. Destinos “Em breve” são apenas
informativos: não possuem `href`, arquivo de rota, foco ou ação. O catálogo
imutável em `src/design-system/navigation/destinations.ts` é a fonte única para
as duas composições.

A Configuração tem uma rota por seção: `/configuracao/conta`, `/foco`,
`/dispositivos`, `/acessibilidade` e `/plano`. No desktop, `/configuracao` abre
em “Conta e segurança” com o menu lateral interno; no celular, mostra a lista
agrupada, e no iOS/Android cada seção é empilhada sobre ela, de modo que o
voltar nativo retorna à lista mesmo depois de um deep link.

Para validar as rotas nas três plataformas, abra cada URL diretamente no
navegador e, em iOS/Android, os deep links `wise://`, `wise://sessao`,
`wise://perfil`, `wise://guilda`, `wise://mercado`, `wise://configuracao`,
`wise://configuracao/foco` e `wise://runa-inexistente`.
A rota inexistente deve mostrar “Página não encontrada” e voltar ao início pelo
botão.

## Contrato público do design system

Consuma a API pelo barrel `src/design-system/index.ts`. Os componentes exportados
e seus contratos estáveis são:

| Componente | Contrato público |
| --- | --- |
| `WiseText` | variantes `display`, `title`, `subtitle`, `body`, `label`, `caption` e `mono`; cor sempre semântica |
| `WiseIcon` | nomes Wise/Ionicons permitidos, tamanhos `small`, `medium` e `large`; ícone informativo exige rótulo acessível |
| `WiseCard` | superfície não interativa nas variantes `default`, `elevated` e `ornamented` |
| `Screen` | título obrigatório, safe areas, gutters, rolagem e acomodação opcional do teclado |
| `WiseButton` | variantes `primary`, `secondary`, `ghost` e `danger`; tamanhos `medium` e `large`; estados disabled/loading |
| `WiseField` | label obrigatório e props nativas de `TextInput`, com ajuda ou erro associado e anunciável |
| `FeedbackMessage` | variantes `info`, `success`, `warning` e `error`, com título opcional e live region apropriada |
| `ProgressBar` | modo determinado com intervalo/valor ou `indeterminate`, ambos com semântica de progresso |
| `ResourcePill` | metadado não interativo por padrão; quando acionável, exige `onPress` e rótulo acessível |

O mesmo barrel exporta `theme`, `typographyFor`, `motionDuration`,
`isSemanticColor`, `isDesktopLayout`, `screenGutter`, nomes/tipos de ícone e os
tipos de props e variantes. Componentes consumidores devem usar esses aliases,
sem introduzir cores, fontes, espaçamentos ou durações compartilhadas fora do
tema.

### Tokens de cor

| Grupo semântico | Tokens e valores |
| --- | --- |
| fundos | `backgroundCanvas` `#07070c`; `backgroundRaised` `#0c0c14`; `backgroundOverlay` `#12121c` |
| superfícies | `surfaceCard` `#181826`; `surfaceElevated`/`surfaceCardActive` `#1f1f2e`; `surfaceInset` `#0a0a12` |
| bordas | `borderGhost` `rgba(212,168,90,0.08)`; `borderSubtle`/`borderSoft` `rgba(212,168,90,0.16)`; `borderEmphasis` `rgba(212,168,90,0.28)`; `borderFocus` `rgba(212,168,90,0.45)` |
| destaque | `accentPrimary` `#d4a85a`; `accentHighlight` `#f0c97a`; `accentMuted` `#8a6a3a`; `accentGlow` `rgba(212,168,90,0.35)` |
| feedback | `feedbackDanger` `#c44545`; `feedbackInfo` `#5b7fc4`; `feedbackSuccess` `#4ea672`; `feedbackEnergy` `#d65a8a`; `feedbackArcane` `#8a5bc4` |
| texto | `textPrimary` `#f3ead4`; `textSecondary` `#b3a98e`; `textTertiary` `#6b6555`; `textDisabled` `#46412f` |

### Escalas

| Escala | Valores |
| --- | --- |
| espaço | `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64` |
| raio | `3, 5, 8, 12, 999` |
| borda | `1/2` |
| ícone | `16/24/32` |
| movimento | `0/120/180/240 ms` |
| tipografia (tamanho/altura de linha) | `display 32/40`, `title 24/32`, `subtitle`/`subtitleStrong 18/26`, `body 16/24`, `label 14/20`, `caption 12/16`, `mono`/`monoEmphasis 14/20` |
| layout | alvo mínimo `44`, sidebar `248`, conteúdo máximo `1200`, gutters `16/24/32` |

As fontes são Cinzel, Inter e JetBrains Mono.

## Limitações conhecidas

Não há tema selecionável nem layout específico para tablets. Exportações
Web/Metro validam bundles, mas não substituem build e QA nativos em
simulador/emulador, incluindo safe area, teclado, fonte ampliada, VoiceOver e
TalkBack.
