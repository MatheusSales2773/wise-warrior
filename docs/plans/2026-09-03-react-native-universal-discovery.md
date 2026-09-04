# Descoberta — frontend universal com React Native

**Data:** 03/09/2026
**Status:** Concluído e validado (`grilling` + `domain-modeling`)
**Escopo:** Evoluir o frontend atual para atender Web, iOS e Android.

## Validação incremental do design

- [x] Seção 1 — Arquitetura universal e fluxo de dados
- [x] Seção 2 — Navegação, telas e adaptação visual
- [x] Seção 3 — Modelo de domínio e sincronização da sessão
- [x] Seção 4 — Erros, segurança, testes e entrega incremental

## Objetivo confirmado

O Wise terá a mesma identidade visual, os mesmos fluxos de produto e as mesmas
capacidades nas três plataformas. A implementação poderá adaptar navegação,
interações e composição visual às convenções de Web, iOS e Android; equivalência
de produto não significa reprodução pixel a pixel.

## Decisões validadas

### D-001 — Paridade de produto com experiência própria da plataforma

**Decisão:** preservar identidade, fluxos e funcionalidades, aceitando adaptações
nativas de apresentação e interação.

**Consequências iniciais:**

- regras de negócio, contratos da API, estado e componentes visuais devem ser
  compartilhados sempre que isso não degrade nenhuma plataforma;
- navegação, armazenamento seguro, entrada de texto, teclado, acessibilidade e
  outros recursos dependentes do sistema operacional podem ter adaptadores;
- o aceite será definido por paridade funcional e coerência visual, não por
  screenshots idênticos.

### D-002 — Substituição direta, preservando a integridade da branch principal

**Decisão:** como ainda não existe um frontend público que precise permanecer
disponível, a aplicação Vite poderá ser substituída pela aplicação universal sem
manter dois produtos permanentemente.

**Consequências iniciais:**

- a migração pode acontecer no mesmo workspace de frontend, sem uma aplicação Web
  legada mantida em paralelo após a conclusão;
- a entrega será fatiada por fundação, shell/autenticação e funcionalidades, com
  build e testes das três plataformas como condição de integração;
- cada mudança integrada à branch principal deve deixar o repositório executável;
- a implementação atual continua sendo referência de comportamento e identidade,
  mas não precisa permanecer como runtime separado.

### D-003 — Autenticação multiplataforma com mudanças retrocompatíveis no backend

**Decisão:** o backend poderá receber mudanças mínimas para oferecer autenticação
segura a clientes nativos sem alterar o comportamento vigente da Web.

**Consequências iniciais:**

- Web mantém o refresh token em cookie `httpOnly`, `Secure` e com política
  `SameSite` apropriada;
- iOS e Android usam credencial rotativa vinculada à sessão do dispositivo e
  armazenada por uma API segura da plataforma, nunca em armazenamento genérico;
- access tokens continuam efêmeros e mantidos apenas em memória;
- rotação, revogação, limite de dispositivos e logout global permanecem regras
  únicas do backend;
- o contrato explicitará o transporte de credenciais por tipo de cliente sem
  duplicar o domínio de autenticação.

### D-004 — Sessão inicia online, sobrevive offline e reconcilia depois

**Decisão:** uma sessão de estudo precisa de conexão para ser iniciada e aceita
pelo servidor. Depois disso, pode continuar durante uma perda de conexão ou
suspensão do aplicativo e será reconciliada ao recuperar conectividade.

**Dificuldade estimada:** moderada (6/10). O trabalho principal não está na
animação do contador, mas na consistência entre ciclo de vida do aplicativo,
persistência local, idempotência e autoridade do servidor.

**Modelo inicial:**

1. o servidor cria a sessão e devolve `sessionId`, `startedAt` e limites;
2. o cliente persiste uma projeção local não sensível da sessão ativa;
3. o contador exibido deriva de timestamps, portanto não depende de JavaScript
   permanecer executando em background;
4. ao voltar ao foreground ou recuperar rede, o cliente consulta o estado
   canônico e envia comandos pendentes;
5. conclusão e cancelamento usam uma chave idempotente, evitando XP duplicado;
6. o servidor valida duração, janela permitida e estado atual antes de conceder
   XP ou contribuição para raid.

**Casos obrigatórios de teste:** suspensão e retomada, aplicativo encerrado pelo
sistema, reconexão tardia, envio repetido, relógio local alterado, sessão encerrada
em outro dispositivo e credencial revogada enquanto offline.

### D-005 — No máximo uma sessão de estudo ativa por usuário

**Decisão:** um usuário pode possuir no máximo uma sessão de estudo ativa em todo
o sistema, independentemente de quantos navegadores ou dispositivos estejam
autenticados.

**Invariante:** `activeStudySessions(userId) <= 1`.

**Consequências iniciais:**

- iniciar uma nova sessão quando outra já existe não cria uma segunda entidade;
  a API devolve o estado da sessão ativa e o cliente oferece retomá-la;
- todos os dispositivos autenticados recebem início, atualização e encerramento
  pela room Socket.IO `user:{id}`;
- durante uma partição de rede, outro dispositivo pode visualizar o último estado
  canônico, mas não pode iniciar uma sessão concorrente;
- a exclusividade deve ser garantida transacionalmente pelo backend/banco, não por
  consulta preventiva no frontend;
- conclusão e cancelamento permanecem idempotentes para lidar com comandos
  concorrentes enviados por dispositivos diferentes;
- uma política posterior definirá abandono/expiração, sem liberar a exclusividade
  silenciosamente apenas porque heartbeats deixaram de chegar.

### D-006 — A sessão ativa pode ser visualizada e controlada em qualquer dispositivo

**Decisão:** todo dispositivo autenticado do usuário pode retomar a interface,
acompanhar e enviar comandos para a única sessão ativa. O dispositivo que iniciou
a sessão não possui propriedade exclusiva sobre ela.

**Orçamento de complexidade:**

- REST permanece a fonte canônica; Socket.IO apenas sinaliza mudanças e carrega
  dados mínimos para invalidar/atualizar a consulta local;
- nenhuma sincronização por segundo entre dispositivos: cada cliente renderiza o
  contador a partir do mesmo `startedAt` emitido pelo servidor;
- comandos de conclusão/cancelamento são idempotentes e retornam o estado terminal
  já existente quando repetidos;
- somente a projeção da sessão ativa e comandos ainda não confirmados são
  persistidos localmente;
- não haverá eleição de dispositivo controlador, transferência de posse, CRDT,
  execução contínua obrigatória em background ou início totalmente offline;
- ao receber evento em tempo real, retomar o foreground ou recuperar rede, o
  cliente consulta novamente o estado canônico.

**Entrega incremental:** a implementação pode chegar à branch principal em
fatias — fundação universal, autenticação, sessão online exclusiva, recuperação
local e controle multidispositivo — mantendo o resultado final comum às três
plataformas.

### D-007 — Entrega incremental com validação horizontal

**Decisão:** a migração será integrada em incrementos funcionais. Cada capacidade
deve ser validada em Web, iOS e Android antes de a equipe avançar para a próxima
fatia relevante.

**Sequência inicial:**

1. fundação Expo/React Native Web e automação de build;
2. design system, shell e navegação universal;
3. autenticação e restauração segura de sessão;
4. sessão de estudo online com exclusividade global;
5. persistência local, retomada e reconciliação;
6. controle multidispositivo e concorrência;
7. dashboard, guilda e perfil, seguidos de acabamento e publicação.

**Critério:** “incremental” descreve a ordem de construção, não uma redução da
paridade final. Não será mantida uma plataforma permanentemente adiantada sem um
plano explícito de convergência.

### D-008 — Distribuição acadêmica local, sem publicação obrigatória nas lojas

**Decisão:** durante o projeto, a Web e os aplicativos serão executados
localmente. iOS e Android usarão Expo Go enquanto as APIs necessárias forem
compatíveis; development builds locais serão usados quando uma integração exigir
código ou configuração nativa própria.

**Fora do escopo obrigatório:** publicação pública, TestFlight, Google Play
Internal Testing, textos e screenshots de loja, processo de revisão, rollout,
monitoramento de versão pública e automação de release para as lojas.

**Consequências iniciais:**

- identificadores de bundle/package e configuração nativa ainda devem ser
  estáveis para não bloquear uma publicação futura;
- a equipe não precisa adquirir contas Apple Developer ou Google Play Console
  para concluir o objetivo acadêmico;
- os critérios de aceite exigem execução local comprovada nas três plataformas,
  não aprovação nas lojas;
- publicação futura será um épico separado, com privacidade, assinatura,
  certificados, assets, políticas e pipeline próprios.

### D-009 — Web desktop e celulares; tablets fora do aceite inicial

**Decisão:** a primeira versão universal será projetada e testada para navegadores
desktop e celulares iOS/Android. Tablets não terão layouts ou testes de aceite
dedicados nesta fase.

**Consequências iniciais:**

- o layout fluido não deve quebrar deliberadamente em tablets, mas compatibilidade
  acidental não equivale a suporte formal;
- não serão criadas composições de duas colunas, sidebars permanentes ou padrões
  master-detail específicos para tablet;
- orientação horizontal em celulares será tratada apenas para impedir perda de
  conteúdo ou controles inacessíveis, sem otimização visual dedicada;
- uma futura ampliação para tablets exigirá critérios próprios de layout,
  orientação, teclado/trackpad e matriz de QA.

### D-010 — Pomodoro documentado é a fonte de verdade

**Decisão:** a aplicação universal implementará o comportamento descrito no PRD:
contagem regressiva com duração configurável e modos de foco, pausa curta e pausa
longa. O cronômetro crescente atual é uma implementação provisória.

**Consequências iniciais:**

- uma sessão de foco registra ao menos matéria, duração planejada, modo, início e
  prazo calculado pelo servidor;
- o contador exibido deriva do prazo canônico, evitando divergência quando o
  aplicativo suspende ou outro dispositivo assume a tela;
- pausas não podem ser tratadas implicitamente como tempo de estudo ou gerar XP;
- a interface atual será preservada como referência de identidade, mas seus
  controles serão ajustados ao fluxo de Pomodoro;
- o contrato REST, entidade `StudySession`, testes de domínio e OpenAPI precisarão
  incorporar duração planejada e estados do ciclo.

### D-011 — Conclusão automática do foco, início manual da pausa

**Decisão:** ao alcançar `00:00`, o ciclo de foco é concluído automaticamente e
o sistema oferece a próxima pausa. A pausa só começa após uma ação explícita.

**Consequências iniciais:**

- a conclusão precisa produzir um único resultado mesmo que servidor e múltiplos
  clientes detectem o prazo ao mesmo tempo;
- o estado terminal e a concessão de XP são definidos pelo servidor;
- um dispositivo offline registra a intenção pendente e reconcilia; outro
  dispositivo online pode observar a conclusão canônica imediatamente;
- concluir foco não cria automaticamente outra sessão ativa;
- a interface exibe resumo de XP/contribuição antes de oferecer a pausa.

### D-012 — Standalone como referência de UX, subordinado ao domínio e aos contratos

**Decisão:** `docs/Wise Warrior _standalone_.html` é fonte explícita para direção
visual, linguagem, hierarquia, navegação e comportamentos demonstrados. Não será
copiado como implementação nem prevalecerá sobre regras validadas, PRD, contrato
da API, acessibilidade ou restrições das plataformas.

**Elementos de referência identificados:**

- estética dark-RPG com ouro/índigo, Cinzel, Inter e JetBrains Mono;
- paletas Ouro, Carmim, Verdor e Arcano;
- shell com Acampamento, Forja de foco, Personagem, Guilda, Mercado arcano,
  Crônicas e Configuração;
- cards ornamentados, barras de recursos/XP, runas, sigilos, feedback de ganho de
  XP e vocabulário narrativo consistente;
- dashboard com missões diárias, agenda, atividades, streak e progresso;
- Pomodoro com durações 15/25/50, matérias, anel de progresso, pausa/retomada,
  companhia em foco e ambientes sonoros;
- perfil com atributos, equipamentos, conquistas e progressão;
- guilda com raid, membros, contribuição, presença e chat.

**Lacunas que exigem desenho próprio:**

- o standalone possui layout desktop fixo, sidebar de 248 px, painéis laterais de
  320 px e nenhum breakpoint responsivo;
- dados e ações são locais/fictícios, sem estados de carregamento, vazio, erro,
  permissão, expiração, offline ou concorrência;
- não demonstra login/cadastro, armazenamento seguro, retomada, reconciliação,
  deep links ou navegação nativa;
- não modela pausa curta/longa como ciclos separados;
- Mercado arcano, Crônicas e Configuração são placeholders;
- o timer usa `setInterval` local e precisa ser substituído por projeção de
  timestamps canônicos.

**Ordem de precedência em conflitos:** decisões validadas nesta descoberta →
regras de negócio/PRD → contratos reais da API → intenção de UX do standalone →
detalhes incidentais da implementação do mock.

### D-013 — Pausa é uma transição canônica sincronizada

**Decisão:** o comando “Pausar forja” altera o estado canônico da sessão no
servidor. Não é apenas uma suspensão visual do contador local.

**Modelo inicial:**

- sessão de foco admite os estados `running`, `paused`, `completed`,
  `stopped_early`, `cancelled` e `discarded`;
- pausar registra o instante canônico e congela o tempo restante em todos os
  dispositivos;
- retomar acumula a duração pausada e recalcula o prazo do ciclo;
- tempo pausado não concede XP nem contribuição para raid;
- comandos de pausar e retomar são idempotentes e protegidos contra concorrência;
- mudanças são divulgadas na room do usuário, mas cada cliente confirma o estado
  por REST;
- o servidor, e não o dispositivo que iniciou, autoriza cada transição.

**Resolvido por D-014 e D-016:** pausa não expira automaticamente; pausar e
retomar exigem conexão.

### D-014 — Pausa sem expiração automática

**Decisão:** uma sessão pausada permanece nesse estado até uma ação explícita do
usuário. O sistema não a conclui, cancela ou expira por tempo pausado.

**Consequências iniciais:**

- o limite antifraude de tempo de foco não inclui períodos pausados;
- a sessão continua ocupando a única vaga ativa do usuário, mesmo após logout,
  fechamento do aplicativo ou passagem de vários dias;
- abrir qualquer dispositivo deve revelar a sessão pausada e oferecer ações de
  recuperação claras;
- jobs automáticos não podem conceder XP nem encerrar a sessão apenas pela idade;
- métricas devem distinguir duração de foco, duração pausada e tempo total de
  calendário;
- retenção/arquivamento de sessões pausadas antigas será uma preocupação
  operacional futura, não uma transição automática do domínio.

### D-015 — Nova sessão exige resolução explícita da sessão pausada

**Decisão:** ao tentar iniciar outro Pomodoro enquanto existe uma sessão pausada,
o sistema apresenta a sessão existente e oferece `Retomar` ou `Cancelar e iniciar
outra`.

**Consequências iniciais:**

- nunca haverá cancelamento implícito ao tocar em “iniciar”;
- `Cancelar e iniciar outra` é uma operação composta na experiência, mas o
  backend deve concluir o cancelamento antes de aceitar a nova sessão;
- se a criação falhar depois do cancelamento, o cliente informa claramente que a
  sessão anterior foi cancelada e permite tentar o novo início novamente;
- a confirmação mostra matéria, tempo de foco realizado e informa se haverá perda
  de recompensa;
- a mesma interação será apresentada em qualquer dispositivo autenticado.

### D-016 — Pausar e retomar exigem conexão

**Decisão:** uma sessão em execução continua visualmente durante perda de conexão
e pode alcançar o prazo offline, mas comandos de pausar e retomar só são aceitos
quando o cliente consegue confirmar a transição com o servidor.

**Consequências iniciais:**

- controles de pausa/retomada ficam indisponíveis com mensagem explicativa quando
  o dispositivo está offline;
- nenhum timestamp retroativo de pausa é enviado pelo cliente;
- não existe fila offline para transições intermediárias da sessão;
- ao reconectar ou retomar o aplicativo, o cliente consulta o estado canônico
  antes de reabilitar os controles;
- a conclusão automática alcançada offline pode permanecer como intenção pendente
  idempotente, pois é uma transição terminal baseada no prazo já aceito;
- testes cobrem detecção de rede imperfeita, reconexão e mudança remota de estado
  enquanto o controle local estava desabilitado.

### D-017 — Notificação local de término, sem push remoto

**Decisão:** o celular que iniciou ou acompanhou um ciclo agenda uma notificação
local para o prazo previsto. Não haverá infraestrutura de push remoto nesta fase.

**Consequências iniciais:**

- a permissão de notificações é solicitada em contexto, ao iniciar a funcionalidade,
  e sua recusa não impede o Pomodoro;
- pausar, retomar, cancelar ou concluir enquanto online cancela/reagenda o alerta
  local nos dispositivos que recebem o evento;
- um dispositivo offline pode disparar um alerta desatualizado se outro aparelho
  alterou a sessão; por isso a mensagem informa que o prazo previsto terminou e
  orienta abrir o app para sincronizar, sem afirmar XP concedido;
- tocar na notificação abre a rota da Forja de foco;
- Web usa feedback dentro da aplicação; notificações Web do sistema ficam fora do
  escopo inicial;
- tokens de push, serviço de entrega, fanout remoto e notificações para aparelhos
  que nunca observaram a sessão permanecem fora do escopo.

### D-018 — Ambiente sonoro adiado até existir funcionalidade real

**Decisão:** o seletor “Ambiente sonoro” do standalone não aparecerá na primeira
versão universal. O protótipo só alterna seleção visual e não contém áudio.

**Consequências iniciais:**

- nenhum controle sem efeito será preservado apenas para reproduzir o mock;
- não serão adicionados assets, licenciamento de áudio, player, sessão de mídia,
  reprodução em background ou controles do sistema nesta fase;
- o layout da Forja redistribuirá o espaço do painel removido, priorizando timer,
  matéria, estado de conexão e companhia em foco;
- áudio ambiente poderá retornar como épico independente com critérios de licença,
  download/tamanho, looping, interrupções e comportamento por plataforma.

### D-019 — Tema Ouro único, com design tokens extensíveis

**Decisão:** a primeira versão universal expõe somente a paleta Ouro/Índigo. As
paletas Carmim, Verdor e Arcano do painel de prototipação não serão selecionáveis.

**Consequências iniciais:**

- cores semânticas serão implementadas como tokens independentes da plataforma,
  sem espalhar valores hexadecimais pelos componentes;
- não haverá seletor nem persistência de tema nesta fase;
- testes visuais e de contraste cobrem apenas Ouro/Índigo, além dos estados
  semânticos de sucesso, alerta, erro e raridade;
- a estrutura dos tokens deve permitir temas futuros sem prometer compatibilidade
  antes de eles passarem por revisão completa de contraste e assets;
- “Tweaks” permanece ferramenta do mock e não vira tela do produto.

### D-020 — Funcionalidades futuras visíveis como entradas desabilitadas

**Decisão:** Mercado Arcano, Crônicas e Forja de configuração continuam visíveis
na navegação da primeira versão, identificadas como “Em breve” e sem abrir telas
fictícias.

**Consequências iniciais:**

- entradas usam semântica de item indisponível e não de link funcional;
- toque/clique pode exibir uma explicação curta, sem navegar para uma página vazia;
- teclado e leitor de tela recebem estado indisponível corretamente;
- nenhuma rota pública, chamada de API ou telemetria de conclusão será criada para
  esses módulos nesta fase;
- quando uma funcionalidade for implementada, ela substituirá progressivamente a
  entrada desabilitada sem reorganizar a arquitetura principal de navegação.

### D-021 — Somente dados reais e funcionalidades sustentadas por contrato

**Decisão:** a primeira versão universal não usa conteúdo fictício do standalone
para preencher telas de produto. Cada dado apresentado deve vir de estado local
legítimo ou de um contrato real do backend.

**Consequências iniciais:**

- carregamento, vazio, erro, offline e permissão negada são estados obrigatórios;
- missões diárias, agenda, feed de atividades, atributos RPG, conquistas,
  inventário, presença e chat só aparecem como funcionais quando possuírem contrato
  e implementação reais;
- partes do standalone sem backend podem ficar ocultas ou explicitamente marcadas
  como futuras, conforme o papel delas na navegação;
- fixtures e mocks são permitidos apenas em testes, Storybook/preview ou ambiente
  de desenvolvimento claramente identificado;
- o OpenAPI e o futuro AsyncAPI são fontes de verdade para integrações; a aparência
  do protótipo não cria implicitamente um endpoint.

### D-022 — Aplicação universal com Expo, Expo Router e React Native Web

**Decisão:** `apps/frontend` será transformado numa única aplicação Expo. Expo
Router fornecerá a navegação universal e React Native Web renderizará as mesmas
primitivas na Web.

**Consequências iniciais:**

- Vite, React Router DOM, elementos HTML diretos e folhas CSS não compõem a
  arquitetura final;
- rotas serão organizadas por arquivos e grupos públicos/protegidos, mantendo URLs
  Web e deep links equivalentes quando aplicável;
- UI compartilhada usa primitivas React Native; diferenças relevantes usam
  `Platform` ou arquivos `.web`, `.ios`, `.android`/`.native` bem delimitados;
- regras de domínio, clientes REST/Socket.IO, validações e modelos permanecem
  independentes da árvore de componentes;
- o standalone será traduzido para tokens, SVGs, gradientes e componentes
  universais, não incorporado via WebView;
- a aplicação Vite atual serve de referência durante a conversão e é removida
  conforme as fatias alcançam paridade;
- a versão exata de Expo/React Native será fixada de forma compatível pelo gerenciador
  do Expo no início da implementação;
- esta decisão exige substituir o ADR-008 atual, que determina “sem app nativo”.

**Alternativas rejeitadas:** manter Vite e Expo como aplicações permanentes
duplicaria navegação e UI; configurar React Native Web manualmente com bundlers
separados aumentaria o custo operacional sem requisito correspondente.

### D-023 — Design system próprio com StyleSheet e tokens TypeScript

**Decisão:** a UI universal será construída com `StyleSheet`, tokens semânticos em
TypeScript e componentes próprios do Wise. Não serão adotados NativeWind/Tailwind
ou um framework completo de componentes nesta fase.

**Consequências iniciais:**

- cores, tipografia, espaçamento, raios, bordas, elevação e movimento terão tokens
  compartilhados;
- gradientes, fontes e SVGs usarão dependências Expo/React Native específicas e
  compatíveis com Web, escolhidas na implementação conforme a versão fixada;
- componentes como `WiseCard`, `WiseButton`, `ProgressBar`, `ResourcePill`,
  `Screen`, `AppNavigation` e `TimerRing` concentram a linguagem visual;
- pseudo-elementos, seletores CSS, `hover` e animações exclusivas do DOM serão
  traduzidos para composição de componentes e estados de interação;
- variantes `.web`/`.native` serão usadas somente quando semântica, acessibilidade
  ou capacidade da plataforma exigir;
- o sistema começa com Ouro/Índigo, mas tokens não assumem que esse será o único
  tema para sempre.

### D-024 — TanStack Query restrito ao estado remoto

**Decisão:** TanStack Query gerenciará dados oriundos do backend. Context será
reservado à autenticação e preferências locais de escopo global; estado efêmero de
interface permanece junto dos componentes.

**Limites contra overengineering:**

- um único `QueryClient` e convenções simples de query keys;
- integração explícita com estado do aplicativo e conectividade;
- queries iniciais apenas para perfil, sessão ativa, guilda e raid;
- mutations para comandos reais do contrato;
- Socket.IO invalida queries; não mantém uma segunda fonte de verdade;
- sem persistência geral de cache, normalização global, prefetch especulativo ou
  optimistic update por padrão;
- conclusão terminal pendente do Pomodoro usa um mecanismo específico e pequeno,
  não uma fila offline genérica;
- Axios continua sendo o transporte HTTP, incluindo adaptação de credenciais por
  plataforma.

**Alternativas rejeitadas:** hooks/cache próprios começariam menores, mas fariam a
equipe implementar reconexão e invalidação; Redux Toolkit/RTK Query oferece um
estado global mais amplo que o produto atual necessita.

### D-025 — Encerramento antecipado concede XP proporcional

**Decisão:** encerrar voluntariamente um ciclo de foco antes do prazo registra uma
sessão parcial válida e concede XP proporcional ao tempo de foco efetivamente
validado pelo servidor.

**Consequências iniciais:**

- `completed` distingue conclusão pelo prazo de `stopped_early`, que é terminal,
  válido e diferente de `cancelled`/`discarded`;
- pausas são excluídas do tempo elegível;
- contribuição para raid segue a mesma duração validada usada no XP;
- o resultado informa duração planejada, duração realizada, XP concedido e motivo
  do encerramento;
- a fórmula, arredondamento e limite mínimo precisam ser determinísticos e testados
  no domínio;
- retries ou encerramentos concorrentes retornam o mesmo resultado, sem nova
  concessão.

**Resolvido por D-026:** mínimo de cinco minutos e arredondamento por minuto
completo.

### D-026 — Mínimo de cinco minutos para recompensa parcial

**Decisão:** uma sessão encerrada antecipadamente precisa acumular ao menos cinco
minutos completos de foco validado para conceder XP ou contribuição de raid.

**Consequências iniciais:**

- sessões abaixo do limite continuam registradas como `stopped_early`, com
  duração e recompensa zero, para não desaparecerem do histórico;
- aos cinco minutos, aplica-se a taxa existente de 10 XP por minuto completo;
- segundos incompletos não geram fração: `floor(validFocusSeconds / 60) * 10`;
- a duração planejada limita a recompensa máxima do ciclo;
- pausas não integram `validFocusSeconds`;
- o limite vale igualmente para modo solo e guilda.

Com esta decisão, a pendência de duração mínima e arredondamento de D-025 fica
resolvida.

### D-027 — Presets de foco e cadência de pausas

**Decisão:** antes de iniciar, o usuário escolhe foco de 15, 25 ou 50 minutos; 25
minutos é o padrão. A pausa curta dura 5 minutos. Após quatro ciclos de foco
concluídos integralmente, a próxima pausa oferecida dura 15 minutos.

**Consequências iniciais:**

- alteração de duração só afeta um ciclo ainda não iniciado;
- encerramento antecipado pode conceder XP, mas não incrementa a sequência de
  quatro conclusões que libera a pausa longa;
- pausas são iniciadas explicitamente, não concedem XP e não ocupam uma sessão de
  estudo ativa após a conclusão do foco;
- a sequência de focos concluídos é estado canônico do usuário, permitindo que o
  próximo dispositivo ofereça a pausa correta;
- cancelar ou abandonar uma pausa não reduz a sequência; concluir a pausa longa
  reinicia o contador de sequência;
- a interface mostra progresso como “Forja N de 4”, seguindo a linguagem do
  standalone.

### D-028 — Compatibilidade segue a matriz oficial do Expo SDK fixado

**Decisão:** a primeira versão suporta os pisos de iOS, Android e Web declarados
oficialmente pela versão do Expo SDK escolhida. Não haverá compromisso adicional
com versões legadas nesta fase.

**Consequências iniciais:**

- Expo SDK, React Native, React, Expo Router e React Native Web serão fixados em
  versões mutuamente compatíveis, sem intervalos amplos de versão;
- o README registrará versões mínimas, requisitos locais e comandos reproduzíveis;
- QA mínimo inclui navegadores atuais Safari, Chrome, Firefox e Edge, um simulador
  iOS atual e um emulador/dispositivo Android atual;
- APIs utilizadas precisam constar como suportadas pelas três plataformas na
  documentação da versão fixada;
- regressões fora da matriz oficial não bloqueiam o projeto acadêmico;
- a matriz será revisada somente em upgrades deliberados do Expo SDK.

### D-029 — Pirâmide de testes orientada às regras de negócio

**Decisão:** regras puras recebem a maior cobertura automatizada; integrações
críticas recebem testes contra as fronteiras reais; somente os principais fluxos
ganham E2E. Execução local em iOS e Android é validada por smoke tests manuais
reproduzíveis nesta fase acadêmica.

**Camadas:**

- **unitários de domínio:** cálculo proporcional de XP, mínimo de cinco minutos,
  arredondamento, limites antifraude, exclusão de pausas, cadência 4× foco e
  máquina de estados;
- **unitários de aplicação:** projeção do contador por timestamps, adaptadores de
  credencial, resultado de conflitos e mapeamento de erros;
- **componentes universais:** formulário, acessibilidade, estados de rede,
  navegação, controles e comportamento nas variantes suportadas;
- **integração backend/banco:** exclusividade global, transações, início
  concorrente, conclusão idempotente, pause/resume e concessão única de XP/raid;
- **contrato:** OpenAPI e futuro AsyncAPI validados contra DTOs/eventos;
- **E2E Web mínimo:** cadastro/login, início/pausa/retomada/conclusão e retomada de
  sessão;
- **smoke iOS/Android:** checklist versionado para autenticação, background,
  notificação local, offline/reconexão e sessão multidispositivo.

**Ferramentas alvo:** Jest/jest-expo e React Native Testing Library no frontend,
Jest no backend e uma ferramenta Web E2E enxuta a confirmar pela versão instalada.
Vitest deixa de ser o runner principal do frontend após a migração para Expo.

## Questões em aberto

Nenhuma decisão de produto bloqueia o design. Versões exatas de dependências e a
ferramenta E2E Web serão fixadas no plano de implementação, após nova consulta à
documentação oficial compatível com o Expo SDK selecionado.

## Glossário vivo

### Frontend universal

Uma base de código que entrega Web, iOS e Android, compartilhando domínio e UI
quando adequado e usando implementações específicas por plataforma quando
necessário.

### Paridade funcional

Os mesmos objetivos e resultados de negócio estão disponíveis nas três
plataformas, ainda que a interação ou a disposição visual varie.

### Paridade visual

Consistência de marca, hierarquia, tipografia, cores e linguagem de componentes.
Não exige equivalência pixel a pixel entre plataformas.

### Adaptação de plataforma

Comportamento ou componente especializado para respeitar convenções e APIs de
Web, iOS ou Android sem alterar a regra de negócio.

### Sessão de dispositivo

Vínculo revogável entre usuário e uma instalação ou navegador autenticado. A
regra de rotação é comum às plataformas; somente o transporte e o armazenamento
seguro da credencial variam.

### Adaptador de credenciais

Camada de infraestrutura que usa cookie protegido na Web e armazenamento seguro
nativo no iOS/Android, expondo a mesma operação de restaurar, renovar e encerrar
uma sessão para o restante do aplicativo.

### Projeção local da sessão

Cópia persistida no dispositivo para reconstruir a interface e enfileirar uma
reconciliação. Não concede XP nem substitui o estado canônico do servidor.

### Reconciliação

Processo de comparar a projeção local com o estado canônico ao recuperar rede ou
retomar o aplicativo, aplicando comandos pendentes de forma idempotente.

### Comando idempotente

Operação identificada por uma chave estável que produz um único efeito de negócio
mesmo quando reenviada após falhas de conexão.

### Sessão de estudo ativa

Sessão aceita pelo servidor que ainda não alcançou um estado terminal, como
`completed`, `stopped_early`, `cancelled` ou `discarded`.

### Ciclo de foco

Intervalo regressivo de estudo associado a uma matéria e elegível para validação,
XP e contribuição em raid.

### Ciclo de pausa

Intervalo regressivo de descanso curto ou longo. Faz parte da experiência
Pomodoro, mas não representa estudo e não concede XP.

### Invariante de exclusividade

Regra de domínio que limita cada usuário a uma única sessão de estudo ativa e que
precisa permanecer verdadeira mesmo sob concorrência, retries e múltiplos
dispositivos.

### Development build

Binário de desenvolvimento próprio do aplicativo, usado quando o Expo Go não
inclui algum módulo ou configuração nativa necessária. Não equivale a uma versão
publicada em loja.

## Referências técnicas consultadas

- React 18.3.1, React Router 6.26.2, Vite 5.4.6 e TypeScript 5.6.2 instalados no
  frontend atual (`apps/frontend/package.json`);
- documentação oficial do Expo Router para aplicações universais;
- documentação oficial do React Native for Web sobre adoção multiplataforma e
  compatibilidade;
- documentação oficial do Expo sobre módulos específicos por plataforma.
- documentação oficial do React Native sobre `AppState` e ciclo de vida;
- documentação oficial do Expo sobre persistência com SQLite.
- `docs/Wise Warrior _standalone_.html`, auditado como bundle autocontido sem
  executar seu conteúdo local no navegador.

Estas referências orientam somente a descoberta. A versão de Expo/React Native
será fixada após a escolha da estratégia de transição.
