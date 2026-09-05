# Validação M2 — shell de navegação adaptativa

**Data:** 05/09/2026
**Issue:** #38 — Implementar rotas e navegação adaptativa

## Stack confirmada

- Expo SDK 57.0.20 e Expo Router 57.0.19;
- React Native 0.86.3 e React 19.2.3;
- React Native Safe Area Context 5.7.0;
- Jest 29.7.0.

As decisões de implementação seguiram a documentação oficial do Expo Router 57
para `Slot`, `Link asChild` e `usePathname`, e do React Native 0.86 para `Modal`,
`useWindowDimensions` e acessibilidade.

## Gates automatizados

- typecheck e lint aprovados;
- 18 suítes Jest, 133 testes e zero snapshots aprovados;
- `expo install --check`: dependências atualizadas;
- Expo Doctor: 21/21 checks aprovados;
- exportação Metro aprovada para Web, iOS e Android;
- exportação Web aprovada;
- smoke test Docker/nginx aprovado, incluindo fallback SPA.

## Rotas e QA de interação

- `/`, `/sessao`, `/perfil` e `/guilda` resolvem diretamente com os textos
  temporários fechados na issue;
- refresh direto em `/guilda` preservou a rota no navegador;
- em viewport Web larga, a sidebar de 248 px apresentou um único destino ativo;
- em 390 × 844, a barra inferior apresentou os quatro destinos e “Mais” sem
  cobrir o conteúdo;
- “Mais” abriu como bottom sheet sem alterar a URL;
- enquanto o modal esteve aberto, conteúdo e navegação de fundo ficaram fora da
  árvore acessível;
- Escape fechou o modal na Web e devolveu foco ao controle “Mais”;
- itens futuros permaneceram sem link, ação, ícone ou foco, com nome acessível
  “{nome}, indisponível, em breve”.

Os testes automatizados também cobrem o breakpoint 899/900, preservação do estado
local no resize, voltar Android via `onRequestClose`, backdrop, botão “Fechar”,
movimento reduzido, alvos de 44 × 44 e correspondência exata dos Ionicons.
