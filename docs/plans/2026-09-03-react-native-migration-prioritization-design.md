# Design — migração e priorização do frontend universal

**Data:** 03/09/2026
**Status:** Validado
**Arquitetura base:**
`docs/plans/2026-09-03-react-native-universal-design.md`

## 1. Objetivo

Substituir o frontend React/Vite atual por uma aplicação Expo universal para Web,
iOS e Android antes de ampliar o produto. A migração preserva os fluxos e dados
reais existentes, mas não transporta implementações que já divergem do domínio
validado, como DOM/CSS direto e o cronômetro crescente atual.

A tela de sessão será construída diretamente como Pomodoro regressivo. Não haverá
uma implementação intermediária do comportamento antigo.

## 2. Estratégia

A migração será feita em fatias verticais. Cada incremento deixa a aplicação
executável e verificável nas três plataformas. O frontend atual e o standalone
são referências funcionais e visuais, não código a ser incorporado.

Três abordagens foram avaliadas:

1. **Fatias verticais — escolhida:** migra interface, integração, estados e testes
   de uma área por vez. Reduz regressões e mantém feedback rápido.
2. **Toda a interface primeiro — rejeitada:** acelera a aparência inicial, mas
   acumula telas sem integração real e posterga os riscos de plataforma.
3. **Troca completa de uma vez — rejeitada:** concentra incompatibilidades e
   dificulta localizar regressões.

A expansão do produto começa apenas depois da paridade útil da base existente. A
exceção são mudanças mínimas de backend indispensáveis à fatia em andamento,
principalmente autenticação nativa e o contrato definitivo de Study Session.

## 3. Primeira grande entrega — migração do existente

### M1 — Fundação universal

- fixar uma matriz oficialmente suportada de Expo SDK, React Native, React, Expo
  Router e React Native Web;
- iniciar Web, iOS e Android localmente;
- configurar TypeScript, variáveis de ambiente, cliente HTTP, lint e testes;
- remover Vite somente depois que a aplicação Expo iniciar nas três plataformas.

### M2 — Design system e navegação

- converter o tema Ouro em tokens TypeScript;
- criar primitivas próprias com `StyleSheet` para tipografia, botões, campos,
  cards, feedback e indicadores;
- implementar sidebar na Web e navegação inferior nos celulares;
- tratar safe areas, teclado, foco visível e movimento reduzido;
- exibir destinos futuros como “Em breve”.

### M3 — Autenticação

- migrar login, cadastro, logout e restauração de credenciais;
- manter refresh token protegido por cookie na Web;
- usar armazenamento seguro em iOS/Android;
- proteger rotas e uniformizar expiração e indisponibilidade da API.

### M4 — Dashboard

- mostrar perfil, progressão, XP e atividade com dados reais;
- implementar estados de carregamento, erro, vazio e atualização;
- adaptar composição ampla para Web e empilhada para celular.

### M5 — Perfil

- migrar dados pessoais e histórico disponível;
- listar sessões autenticadas por dispositivo;
- suportar revogação individual e saída de todos os dispositivos.

### M6 — Guilda

- migrar criação e visualização usando a API existente;
- representar corretamente o estado sem guilda;
- marcar informações indisponíveis sem introduzir dados fictícios.

### M7 — Sessão de estudo definitiva

- selecionar matéria e presets de foco de 15, 25 e 50 minutos;
- usar contador regressivo derivado de timestamps;
- iniciar, concluir automaticamente e encerrar antecipadamente;
- mostrar duração e XP confirmados pelo servidor;
- não reproduzir o cronômetro crescente do frontend atual.

Ao final de M7, o frontend existente estará substituído por uma aplicação React
Native funcional nas três plataformas. Offline, pausa sincronizada e controle
avançado entre dispositivos permanecem para a expansão priorizada.

## 4. Segunda grande entrega — capacidades novas

### P0 — Integridade da sessão

1. no máximo uma Study Session ativa por usuário;
2. estados canônicos `running`, `paused`, `completed`, `stopped_early`,
   `cancelled` e `discarded`;
3. comandos idempotentes e proteção contra concorrência;
4. cálculo server-side do tempo válido e do XP;
5. mínimo de cinco minutos e 10 XP por minuto completo.

### P1 — Controle multidispositivo

1. consultar a sessão ativa em qualquer dispositivo;
2. pausar e retomar com confirmação do servidor;
3. propagar mudanças por Socket.IO e confirmar o estado por REST;
4. detectar conflitos e reaplicar o estado canônico;
5. resolver explicitamente uma sessão pausada antes de começar outra.

### P2 — Resiliência

1. resistir a background usando timestamps;
2. manter conclusão pendente durante perda de conexão;
3. usar uma fila local pequena e idempotente;
4. reconciliar ao recuperar rede;
5. emitir notificação local no dispositivo que acompanha o ciclo.

### P3 — Pomodoro completo

1. pausas locais de 5 e 15 minutos;
2. pausa longa após quatro focos integralmente concluídos;
3. sequência persistida e sincronizada;
4. feedback de conclusão, XP e contribuição para raid.

### P4 — Social e acabamento

1. raids e contribuição de foco;
2. ranking e atualizações de guilda;
3. refinamento visual baseado no standalone;
4. acessibilidade, desempenho e documentação;
5. futuramente, áudio, temas adicionais e áreas marcadas “Em breve”.

Funcionalidades sociais e cosméticas não antecedem a confiabilidade da Study
Session e da concessão de XP.

## 5. Dependências

- M2 depende de M1.
- M3 depende de M1 e das primitivas mínimas de M2.
- M4, M5 e M6 dependem de M3.
- M7 depende de M1–M3 e das extensões mínimas do contrato de sessão.
- P0 deve estar concluído antes de P1–P4.
- P2 depende dos comandos idempotentes de P0.
- P3 depende da integridade de P0 e da reconciliação necessária de P2.
- P4 depende dos resultados canônicos de sessão e XP.

Mudanças de backend serão implementadas junto à primeira fatia que delas
necessitar: autenticação nativa em M3, contrato definitivo de sessão em M7/P0,
multidispositivo em P1 e reconciliação em P2.

## 6. Definição de pronto por incremento

Uma etapa só é concluída quando possuir:

- execução local em Web, iOS e Android;
- TypeScript, lint e testes aprovados;
- integração real com o backend, quando aplicável;
- estados de carregamento, vazio, erro e reconexão relevantes;
- testes unitários das regras alteradas;
- testes de componentes para interações de risco;
- verificação manual mínima nas três plataformas;
- contratos e decisões atualizados.

Não é necessário publicar nas lojas para cumprir essa definição.

## 7. Estratégia de testes

- **Unitários:** XP, mínimo de cinco minutos, arredondamento, máquina de estados,
  projeção do contador e sequência Pomodoro.
- **Componentes:** formulários, navegação, controles da sessão, erros e
  acessibilidade.
- **Integração backend:** exclusividade, concorrência, idempotência e concessão
  única de XP e contribuição para raid.
- **E2E Web:** poucos fluxos críticos, começando por autenticação e uma sessão
  completa.
- **Checklists nativos:** background, armazenamento seguro, teclado, safe areas,
  rede e notificações locais.

## 8. Riscos tratados cedo

1. compatibilidade entre as versões da matriz Expo;
2. autenticação diferente entre Web e aplicativos nativos;
3. projeção correta do contador após background;
4. concorrência entre dispositivos;
5. substituição progressiva de APIs do DOM sem duplicar componentes.

Refinamentos cosméticos não podem bloquear a validação desses riscos.

## 9. Próximo artefato

O plano de implementação deve decompor M1–M7 e P0–P4 em tarefas pequenas, com
arquivos afetados, testes, comandos de verificação, dependências e critérios de
aceite. Antes do primeiro código, ele também deve confirmar as versões instaladas
e consultar a documentação oficial correspondente, conforme `AGENTS.md`.
