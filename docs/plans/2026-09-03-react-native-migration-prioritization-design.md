# Design — migração e priorização do frontend universal

**Data:** 03/09/2026
**Revisado em:** 17/09/2026 — reprioriza Study Session após a conclusão da M4
**Status:** Validado
**Arquitetura base:**
`docs/plans/2026-09-03-react-native-universal-design.md`

## 1. Objetivo

Substituir o frontend React/Vite atual por uma aplicação Expo universal para Web,
iOS e Android, priorizando o fluxo individual de Study Session antes das áreas
sociais opcionais para o usuário. A migração preserva os fluxos e dados reais
existentes, mas não transporta implementações que já divergem do domínio validado,
como DOM/CSS direto e o cronômetro crescente atual.

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

A partir da M4, paridade deixa de significar reproduzir primeiro todas as telas do
frontend anterior. O núcleo individual de Study Session e sua integridade passam
à frente de Perfil, Guilda e Raid. Mudanças de backend entram junto à primeira
fatia que delas necessitar, sem criar implementações intermediárias descartáveis.

## 3. Fase 1 — migração e núcleo funcional

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

### Revisão de prioridade após M4

Participar de uma Guilda é opcional para o usuário. Guilda e Raid continuam
obrigatórias para concluir a Fase 1, mas não antecedem o fluxo individual que
sustenta o produto: realizar uma Study Session e receber XP. Perfil será o último
marco da fase.

### M5 — Study Session essencial

- operar somente em modo solo, online e com o aplicativo em primeiro plano;
- oferecer presets de foco de 15, 25 e 50 minutos, com 25 minutos selecionados
  inicialmente;
- não solicitar nem persistir matéria nesta primeira entrega;
- usar contador regressivo derivado de timestamps canônicos;
- iniciar, pausar e retomar com confirmação do servidor;
- cancelar antes de cinco minutos sem XP;
- encerrar antecipadamente após cinco minutos com 10 XP por minuto completo;
- concluir automaticamente ao chegar a zero enquanto o aplicativo estiver ativo;
- garantir no máximo uma Study Session ativa por usuário, inclusive quando outro
  dispositivo tentar iniciar uma nova;
- usar estados canônicos `running`, `paused`, `completed`, `stopped_early`,
  `cancelled` e `discarded`;
- usar comandos idempotentes, versão esperada e proteção contra concorrência;
- calcular no servidor o tempo válido e o XP e mostrar o resultado confirmado;
- refletir a conclusão no Dashboard;
- não reproduzir o cronômetro crescente do frontend anterior.

O M5 preserva a integridade global da sessão, mas não oferece controle ou
atualização em tempo real entre dispositivos. Em outro dispositivo, a primeira
versão apenas informa que já existe uma sessão ativa.

### M6 — Matéria da Study Session

- permitir selecionar e persistir matéria;
- exibir a matéria no resultado, no Dashboard e no histórico aplicável;
- manter compatibilidade com as Study Sessions sem matéria criadas na M5;
- não usar valor fictício para substituir matéria ausente.

### M7 — Controle multidispositivo

- consultar e controlar a sessão ativa em qualquer dispositivo;
- propagar mudanças por Socket.IO e confirmar o estado por REST;
- detectar conflitos e reaplicar o estado canônico;
- resolver explicitamente uma sessão pausada antes de começar outra.

### M8 — Resiliência em background e offline

- resistir a background usando timestamps;
- manter conclusão pendente durante perda de conexão;
- usar uma fila local pequena e idempotente;
- reconciliar ao recuperar rede;
- emitir notificação local no dispositivo que acompanha o ciclo.

### M9 — Pomodoro completo

- oferecer pausas locais de 5 e 15 minutos;
- oferecer pausa longa após quatro focos integralmente concluídos;
- persistir e sincronizar a sequência;
- mostrar feedback de conclusão e XP.

### M10 — Guilda

- migrar criação, entrada e visualização usando a API real;
- representar corretamente o estado sem Guilda;
- marcar informações indisponíveis sem introduzir dados fictícios.

### M11 — Raid

- migrar participação em Raid, contribuição de foco e ranking;
- integrar somente Study Sessions elegíveis à contribuição;
- mostrar atualizações canônicas de progresso e resultado.

### M12 — Perfil

- migrar dados pessoais e histórico disponível;
- listar sessões autenticadas por dispositivo;
- suportar revogação individual e saída de todos os dispositivos;
- concluir a paridade útil do frontend universal da Fase 1.

Funcionalidades sociais e cosméticas não antecedem a confiabilidade da Study
Session e da concessão de XP. Guilda ser obrigatória na Fase 1 não torna sua
participação obrigatória para o usuário.

## 4. Capacidades posteriores à Fase 1

- refinamento visual adicional baseado no standalone;
- melhorias de acessibilidade, desempenho e documentação que excedam a definição
  de pronto dos marcos;
- áudio, temas adicionais e áreas marcadas “Em breve”.

## 5. Dependências

- M2 depende de M1.
- M3 depende de M1 e das primitivas mínimas de M2.
- M4 e M5 dependem de M3.
- M5 incorpora a integridade anteriormente separada como P0.
- M6 depende do contrato canônico de Study Session entregue na M5.
- M7 depende dos estados, versões e comandos idempotentes da M5.
- M8 depende dos comandos idempotentes da M5 e da reconciliação multidispositivo
  da M7.
- M9 depende da integridade da M5 e da reconciliação da M8.
- M10 depende de M3, mas é deliberadamente executada depois do núcleo de sessão.
- M11 depende de M10 e dos resultados canônicos de sessão e XP.
- M12 depende de M3 e é deliberadamente o último marco da Fase 1.

Mudanças de backend serão implementadas junto à primeira fatia que delas
necessitar: autenticação nativa em M3, contrato definitivo de sessão em M5,
matéria em M6, multidispositivo em M7 e reconciliação em M8.

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

O plano de implementação deve decompor M1–M12 em tarefas pequenas, com
arquivos afetados, testes, comandos de verificação, dependências e critérios de
aceite. Antes do primeiro código, ele também deve confirmar as versões instaladas
e consultar a documentação oficial correspondente, conforme `AGENTS.md`.
