<style>
@page {
  size: A4;
  margin: 32mm 20mm 42mm;
  background: url(img/visao-fundo.jpg) -20mm -32mm / 210mm 297mm no-repeat;
  @bottom-left { content: "Nome do Sistema: Wise Warrior  ·  Documento de Visão  ·  Versão 2.1  ·  Página " counter(page) " de " counter(pages); font: 8pt Arial, sans-serif; color: #333; vertical-align: top; padding-top: 4mm; width: 150mm; }
}
body { font: 10.5pt/1.45 Arial, Helvetica, sans-serif; color: #111; text-align: justify; }
h1 { color: #111; border: 0; text-align: center; font-size: 17pt; margin: 0 0 12px; }
h2 { color: #111; font-size: 13pt; margin-top: 1.4em; }
h3 { font-size: 11pt; margin-top: 1.1em; }
.capa { text-align: center; padding-top: 60mm; break-after: page; }
.capa p { font-size: 13pt; }
.quebra { break-after: page; }
th { background: #e9edf5; }
td, th { text-align: left; }
.sum { text-align: center; }
.sumario div { display: flex; align-items: baseline; margin: 2px 0; }
.sumario span { white-space: nowrap; }
.sumario div::after { content: ""; flex: 1; border-bottom: 1px dotted #555; margin: 0 4px; order: 1; }
.sumario b { order: 2; font-weight: normal; }
.sumario .n0 { font-weight: bold; margin-top: 8px; }
.sumario .n1 { padding-left: 8mm; }
.sumario .n2 { padding-left: 16mm; }
thead:has(th:first-child:empty + th:last-child:empty) { display: none; }
</style>

<div class="capa">

# Documento de Visão

**Versão 2.1**

</div>

## Revisões do Documento

Revisões são melhoramentos na estrutura do documento e também no seu conteúdo. O objetivo primário desta tabela é a fácil identificação da versão do documento. Toda modificação no documento deve constar nesta tabela.

| Versão | Data | Autores | Observações |
|---|---|---|---|
| 1.0 | 17.03.2026 | Matheus Sales | Escopo, Justificativa e Diferencial Estratégico |
| 1.0 | 18.03.2026 | Guilherme Luan | Contextualização |
| 1.0 | 18.03.2026 | Luís Medrado | Análise de funcionalidades |
| 1.0 | 18.03.2026 | Matheus Lopes | Estimativa de custos e dependências |
| 1.0 | 18.03.2026 | Matheus Sales | Stakeholders, resumo de funcionalidades, necessidades chave |
| 2.0 | 27.10.2026 | Guilherme Luan | Atualização com o estado da implementação (issue #5): produto universal para Web, iOS e Android; Koa.js removido da stack (ADR-002); necessidades 9 a 11; seções 5 a 9, antes vazias, preenchidas a partir do PRD e do código. |
| 2.1 | 22.11.2026 | Guilherme Luan | Assinatura premium e Pacotes pagos com Stripe em modo de teste (ADR-015): necessidade 12, módulo `billing`, novas tabelas e restrições. Seção 4.4 revisada: produção na Oracle Cloud (ADR-006) e homologação na AWS. Tabelas de sessão que faltavam no dicionário de dados. |

## Auditorias do Documento

Auditorias são inspeções formais conduzidas pela equipe de Qualidade e Conformidade da Empresa, e tem por objetivo garantir a qualidade dos artefatos gerados durante o processo de desenvolvimento do mesmo. Toda modificação no documento deve constar nesta tabela.

| Versão | Data | Autores | E-mail | Observações |
|---|---|---|---|---|
| &nbsp; | | | | |

<div class="quebra"></div>

<h2 class="sum">Sumário</h2>

<!-- Números de página conferidos no PDF gerado; atualize se o conteúdo mudar de página. -->
<nav class="sumario">
<div class="n0"><span>1. Introdução</span><b>4</b></div>
<div class="n1"><span>1.1 Finalidade</span><b>4</b></div>
<div class="n1"><span>1.2 Escopo</span><b>4</b></div>
<div class="n1"><span>1.3 Justificativa</span><b>4</b></div>
<div class="n1"><span>1.4 Diferencial Estratégico</span><b>5</b></div>
<div class="n1"><span>1.5 Definições, Acrônimos e Abreviações</span><b>5</b></div>
<div class="n1"><span>1.6 Referências</span><b>6</b></div>
<div class="n2"><span>1.6.1 Especificações Suplementares</span><b>6</b></div>
<div class="n0"><span>2. Contextualização</span><b>6</b></div>
<div class="n1"><span>2.1 Descrição do Problema</span><b>6</b></div>
<div class="n1"><span>2.2 Sentença de Posição do Produto</span><b>6</b></div>
<div class="n0"><span>3. Descrição dos Stakeholders e dos Usuários</span><b>7</b></div>
<div class="n1"><span>3.1 Principais Stakeholders e Usuários</span><b>7</b></div>
<div class="n1"><span>3.2 Necessidades Chave dos Stakeholders e dos Usuários</span><b>7</b></div>
<div class="n0"><span>4. Visão Geral do Produto</span><b>8</b></div>
<div class="n1"><span>4.1 Perspectiva do Produto</span><b>8</b></div>
<div class="n1"><span>4.2 Estimativa de Custo Inicial</span><b>9</b></div>
<div class="n1"><span>4.3 Suposições e Dependências</span><b>10</b></div>
<div class="n1"><span>4.4 Premissas e Dependências</span><b>10</b></div>
<div class="n0"><span>5. Precedência e Prioridades</span><b>11</b></div>
<div class="n0"><span>6. Requisitos Não-Funcionais do Produto</span><b>11</b></div>
<div class="n0"><span>7. Restrições Técnicas</span><b>12</b></div>
<div class="n1"><span>7.1 Padrões Aplicáveis</span><b>12</b></div>
<div class="n1"><span>7.2 Restrições Aplicáveis</span><b>12</b></div>
<div class="n0"><span>8. Manual de Arquitetura</span><b>13</b></div>
<div class="n1"><span>8.1 Visão de Implementação</span><b>13</b></div>
<div class="n1"><span>8.2 Mecanismos Arquiteturais</span><b>13</b></div>
<div class="n0"><span>9. Dicionário de Dados</span><b>13</b></div>
<div class="n1"><span>9.1 Finalidade</span><b>13</b></div>
<div class="n1"><span>9.2 Tabelas</span><b>13</b></div>
</nav>

<div class="quebra"></div>

# Documento de Visão

## 1. Introdução

### 1.1 Finalidade

A finalidade deste documento é definir a visão que os Stakeholders têm do produto, em termos das funcionalidades e necessidades do sistema para atendê-las.

Quando este documento e o PRD do repositório (`docs/PRD.md`) discordam, vale o PRD, que registra as decisões de arquitetura (ADRs) tomadas depois desta visão. Acima dos dois está o código da branch `develop`.

### 1.2 Escopo

O projeto consiste no desenvolvimento de um aplicativo universal, que roda na Web, no iOS e no Android a partir de uma única base de código, voltado para estudantes e pessoas que desejam manter constância em sessões de estudo e foco. O sistema permite que os usuários realizem sessões temporizadas de produtividade, sejam recompensados por seu desempenho e participem de grupos colaborativos com metas coletivas.

A solução inclui mecânicas de progressão individual, como experiência, níveis, títulos e itens cosméticos, uma moeda do jogo gasta numa loja e objetivos diários e semanais. Também inclui recursos sociais: guildas, raids semanais, ranking de contribuição e chat em grupo. O usuário pode entrar em vários dispositivos ao mesmo tempo, e o progresso aparece em todos eles. Por fim, o modelo freemium tem cobrança: uma assinatura premium mensal e pacotes de itens pagos uma única vez, processados pelo Stripe em modo de teste.

### 1.3 Justificativa

Muitos estudantes enfrentam dificuldades para manter disciplina, constância e concentração ao longo da rotina acadêmica. Embora existam aplicativos de produtividade e temporizadores de foco, grande parte dessas ferramentas apresenta uma experiência fria, repetitiva e pouco motivadora.

Além disso, o estudo é frequentemente tratado como atividade solitária, o que reduz o engajamento e dificulta a permanência no hábito.

Diante desse cenário, surge a necessidade de uma solução que una organização, foco, progressão e interação social, tornando o estudo mais estimulante e recompensador.

### 1.4 Diferencial Estratégico

O principal diferencial estratégico da solução é transformar o estudo em uma jornada gamificada e cooperativa. Em vez de apenas medir tempo ou listar tarefas, o sistema busca gerar senso de progresso individual e impacto coletivo, de modo que o esforço de cada usuário contribui também para o avanço de seu grupo.

Essa combinação entre foco, RPG e cooperação social torna a proposta mais atrativa do que ferramentas tradicionais de produtividade, especialmente para estudantes que se motivam por recompensas visuais, desafios e senso de pertencimento.

### 1.5 Definições, Acrônimos e Abreviações

- **Study Session (Sessão de estudo):** período de foco cronometrado pelo servidor. Pode ser um Ciclo de 15, 25 ou 50 minutos ou um Foco livre, sem duração planejada;
- **XP:** pontos de experiência, ganhos só com o tempo de foco válido (10 XP por minuto completo);
- **Moeda:** moeda do jogo, de cada usuário, ganha com foco, Raids vencidas e Objetivos e gasta na Loja;
- **Guilda:** grupo de usuários que estudam juntos. Cada usuário participa de no máximo uma;
- **Raid:** missão semanal da Guilda. O foco de cada membro causa dano ao chefe da Missão;
- **Cosmetic Item:** item visual do personagem (Avatar, Arma, Acessório, Título ou Badge), sem efeito nas regras;
- **Assinatura:** vínculo pago e mensal com o plano premium, que libera os Itens premium ✦;
- **Pacote:** conjunto de Cosmetic Items vendido por dinheiro, em pagamento único, que fica com o usuário em qualquer plano;
- **Stripe:** plataforma de pagamentos que hospeda o Checkout e o Portal do cliente, usada em modo de teste;
- **TypeScript:** linguagem usada no backend e no frontend;
- **Node.js:** ambiente de execução JavaScript usado pelo backend;
- **NestJS:** framework para Node.js usado para construir a API do servidor;
- **Socket.IO:** biblioteca de comunicação em tempo real usada para chat, progresso da Raid e avisos entre dispositivos;
- **React Native e Expo:** framework e plataforma usados para construir o aplicativo único de Web, iOS e Android;
- **MySQL:** banco de dados relacional do sistema;
- **JWT:** JSON Web Token, credencial de acesso usada na autenticação;
- **ADR:** Architecture Decision Record, registro de uma decisão de arquitetura no PRD;
- **PRD:** Product Requirements Document, o documento de requisitos do repositório.

O Koa.js, listado na versão 1.0, saiu do escopo (ADR-002): o NestJS e o Socket.IO cobrem todos os casos de uso. HTML, CSS e JavaScript também saíram da lista, porque a interface é escrita em TypeScript com componentes React Native.

### 1.6 Referências

FOCUMON. Focumon. [s.d.]. Disponível em: https://www.focumon.com/. Acesso em: 24 mar. 2026.

GYMRATS. GymRats. [s.d.]. Disponível em: https://www.gymrats.app. Acesso em: 24 mar. 2026.

HABITICA. Habitica. [s.d.]. Disponível em: https://habitica.com/. Acesso em: 24 mar. 2026.

IDLE HABITS. Idle Habits. [s.d.]. Disponível em: https://idlehabits.com. Acesso em: 24 mar. 2026.

#### 1.6.1 Especificações Suplementares

- PRD e registro de ADRs: `docs/PRD.md`
- Casos de Uso UC01 a UC04, versão 2.0 (regras de negócio)
- Glossário do domínio: `CONTEXT.md`
- Contratos da API: `docs/api/openapi.yaml` (REST) e `docs/api/asyncapi.yaml` (tempo real)
- Documento de Arquitetura de Software, versão 2.1
- Documentação de Interfaces e Guia para Prototipação, versão 2.1
- Modelo de dados: `docs/DADOS.pdf`, seção 9 deste documento e migrations em `apps/backend/src/migrations`

## 2. Contextualização

### 2.1 Descrição do Problema

| | |
|---|---|
| **Problemas** | Dificuldades para manter disciplina. Falta constância e concentração ao longo da rotina acadêmica. Procrastinação. |
| **Pessoas Atingidas** | Estudantes, universitários e "concurseiros". |
| **Cujo impacto é** | Baixo rendimento em provas, vestibulares e concursos. Sensação de isolamento durante os estudos. Desistência de metas a longo prazo devido à falta de constância. |
| **Uma solução bem-sucedida traria** | Transformar o estudo em uma jornada gamificada e cooperativa. Gerar senso de progresso individual e impacto coletivo, de modo que o esforço de cada usuário contribui também para o avanço de seu grupo. Sensação de recompensa imediata ao concluir tarefas, através de gamificação. |

### 2.2 Sentença de Posição do Produto

| | |
|---|---|
| **Para** | Estudantes, universitários e "concurseiros" que enfrentam dificuldades com procrastinação, isolamento e falta de constância ao longo da rotina acadêmica. |
| **O** | Wise Warrior é uma plataforma de foco e produtividade gamificada e colaborativa, disponível na Web, no iOS e no Android. |
| **Que** | Transforma a rotina de estudos em uma jornada recompensadora, unindo progressão individual de RPG e metas coletivas. |
| **Diferente de** | Aplicativos de organização e listas de tarefas, que oferecem uma experiência utilitária e solitária. |
| **Nosso produto** | Combina mecânicas de engajamento social (guildas, raids de estudos), elementos de RPG e recompensas visuais. |

## 3. Descrição dos Stakeholders e dos Usuários

### 3.1 Principais Stakeholders e Usuários

| Identificação | Responsabilidades | Stakeholders |
|---|---|---|
| Usuário Final (Estudantes, Universitários, Concurseiros) | Utilizar o aplicativo para organizar sessões de estudo, participar de guildas, contribuir para metas coletivas (raids) e fornecer feedback contínuo sobre a usabilidade. | Comunidade acadêmica, candidatos a concursos públicos, estudantes para vestibular e estudantes em geral. |
| Equipe de Desenvolvimento | Responsável por projetar, implementar e manter o sistema. | Equipe técnica responsável pela construção do produto. |
| Product Owner | Definir prioridades, validar funcionalidades e alinhar o produto às necessidades dos usuários. | Representante do produto e das necessidades do cliente/usuário. |

### 3.2 Necessidades Chave dos Stakeholders e dos Usuários

| No. | Descrição | Prioridade do Cliente (Crítico, Importante e Útil) | Observações |
|---|---|---|---|
| 1 | Temporizador de Sessões de Estudos: sistema para cronometrar ciclos de produtividade e registrar esse tempo. | Crítico | Base da plataforma |
| 2 | Sistema de Progressão (RPG): atribuição de experiência (XP), evolução de níveis e desbloqueio de itens cosméticos baseados no desempenho. | Crítico | Diferencial principal para engajamento individual. |
| 3 | Interação e Metas Coletivas: criação de guildas, participação em raids e comunicação via chat. | Crítico | Diferencial principal para engajamento coletivo. |
| 4 | Ranking de Contribuição: classificação interna nas guildas. | Importante | Estímulo à constância através de competição saudável. |
| 5 | Interface Limpa com Estética RPG: design visual que remeta a jogos, mas mantendo uma interface minimalista. | Importante | Gamificação |
| 6 | Chat ou interação em grupo. | Importante | Mural da Guilda, com presença online. |
| 7 | Guildas e Raids de Estudo. | Importante | Raid semanal com Missão e chefe. |
| 8 | Perfil do Usuário: customização do perfil do usuário utilizando itens cosméticos recebidos como recompensa nas raids. | Importante | Herói em camadas (ADR-013). |
| 9 | Acesso multiplataforma e multidispositivo: usar o produto na Web e no celular, com o mesmo progresso em todos os dispositivos. | Crítico | Incluída na versão 2.0 (ADR-008 e ADR-009). |
| 10 | Economia do jogo: Moedas ganhas com o foco e gastas numa Loja de Missões e itens. | Importante | Incluída na versão 2.0 (ADR-012). |
| 11 | Acompanhamento da rotina: objetivos diários e semanais, marcos e diário de estudo. | Útil | Incluída na versão 2.0 (ADR-014). |
| 12 | Monetização: assinatura premium mensal e pacotes de itens pagos. | Crítico | Incluída na versão 2.1 (ADR-015). |

As prioridades das necessidades 9 a 12 seguem a classificação MoSCoW do PRD (Must = Crítico, Should = Importante, Could = Útil). As necessidades 10 e 11 não estão na tabela MoSCoW; a prioridade indicada é a proposta da versão 2.0 e precisa ser confirmada pelo Product Owner.

## 4. Visão Geral do Produto

### 4.1 Perspectiva do Produto

A coluna Situação mostra o estado de cada funcionalidade no código em 22/11/2026. O detalhamento está na seção 7.5 do PRD.

| Necessidades | Funcionalidades Correspondentes | Situação |
|---|---|---|
| 1. Temporizador de sessões de estudo | 1.1 Ciclos Pomodoro de 15, 25 e 50 minutos e Foco livre, com o tempo contado no servidor, pausa, retomada e histórico | Entregue |
| 2. Sistema de Progressão (RPG) | 2.1 Ganho de XP, níveis e desbloqueio de itens por nível, Raid, Compra, Marco e Pacote | Entregue |
| 3. Interação e metas coletivas | 3.1 Guildas com Raid semanal e meta coletiva | Entregue |
| 4. Ranking de contribuição | 4.1 Ranking interno da Raid na Guilda | Entregue |
| 5. Interface com estética RPG | 5.1 Interface temática Ouro/Índigo com arte em pixel art | Entregue; a validação de acessibilidade das telas segue aberta (issue #23) |
| 6. Chat ou interação em grupo | 6.1 Mural da Guilda com presença online e avisos automáticos da Raid | Entregue |
| 7. Guildas e raids de estudo | 7.1 Desafios cooperativos semanais com Missão, chefe, Fúria do dragão e recompensa | Entregue |
| 8. Perfil do Usuário | 8.1 Personagem com Herói em camadas, inventário, equipagem e estatísticas | Entregue |
| 9. Acesso multiplataforma e multidispositivo | 9.1 Aplicativo único para Web, iOS e Android; até 5 dispositivos conectados, com revogação | Entregue; aplicativos nativos rodam localmente, sem publicação nas lojas |
| 10. Economia do jogo | 10.1 Moedas, Extrato e Loja de Missões e itens | Entregue |
| 11. Acompanhamento da rotina | 11.1 Crônicas: Objetivos, Marcos e Diário | Entregue |
| 12. Monetização | 12.1 Assinatura premium de R$ 9,90/mês (Checkout e Portal do Stripe) e Pacote do Dragão de R$ 4,90, na tela Plano e na seção Pacotes da Loja | Entregue em modo de teste; sem cobrança real |

### 4.2 Estimativa de Custo Inicial

Levando em conta que o projeto deverá ser realizado por quatro indivíduos no prazo de um ano, estima-se o subtotal de R$ 550.000,00/ano, ou seja, cerca de R$ 46.000,00/mês.

Esse valor contabiliza custos com a equipe, hospedagem em nuvem, licenças de softwares utilizados no desenvolvimento, divulgação, marketing e uma margem de segurança. Por se tratar inicialmente de projeto universitário, ressalta-se que esse valor é estimado idealizando a aplicação perfeita dos recursos para publicação e compartilhamento empresariais do projeto.

### 4.3 Suposições e Dependências

As suposições são fatores considerados verdadeiros para que o planejamento do Wise Warrior funcione. Para este projeto, as principais são:

- **Engajamento do Usuário:** assume-se que o público-alvo (estudantes e "concurseiros") se sentirá motivado por mecânicas de RPG e recompensas visuais para manter a constância nos estudos.
- **Acesso Tecnológico:** supõe-se que os usuários possuem um computador com navegador moderno ou um celular iOS ou Android, e acesso estável à internet. Iniciar, pausar e retomar uma sessão exige conexão; uma sessão em andamento sobrevive a uma queda de rede.
- **Disponibilidade da Equipe:** assume-se que os quatro desenvolvedores dedicarão as horas planejadas ao longo de um ano para cumprir o cronograma.
- **Conhecimento Prévio:** supõe-se que os usuários já possuem uma rotina de estudos mínima, utilizando o app como ferramenta de otimização e não como alfabetização educacional.

### 4.4 Premissas e Dependências

O sistema deverá utilizar os seguintes padrões de premissas e dependências:

- **Máquina do Desenvolvedor:** computador ou notebook com acesso à internet, Node.js 22.13 ou superior, Docker com Compose, editor de código, navegador para testes e Git. Para os aplicativos nativos, Xcode (iOS, só macOS) ou Android Studio com JDK 17 (Android). Para testar a cobrança, a Stripe CLI e uma conta Stripe em modo de teste.
- **Máquina do Servidor:**
  - **Aplicação:** aplicativo universal para Web, iOS e Android, dependente de conexão com a internet para autenticação, registro das sessões de estudo e interação entre usuários. Utiliza TypeScript, Node.js, NestJS e Socket.IO no servidor, e Expo, React Native e React Native Web no cliente. A aplicação é empacotada em containers Docker e sobe com Docker Compose. O alvo de produção é uma VM Oracle Cloud Always Free (ADR-006), ainda não provisionada. O ambiente de homologação roda na AWS, descrito em CloudFormation: uma instância EC2 com os containers, um Application Load Balancer com certificado do ACM, imagens no ECR e um agendamento que liga e desliga o ambiente.
  - **Banco de Dados:** sistema de banco de dados responsável por armazenar informações dos usuários, personagens, sessões de estudo, progresso, guildas, rankings, moedas, assinaturas e recompensas. Para este projeto, é utilizado o banco relacional MySQL 8 (em container no desenvolvimento e na CI, e no Amazon RDS na homologação).
  - **Pagamentos:** Stripe em modo de teste, com Checkout e Portal do cliente hospedados pelo Stripe e um webhook que avisa o servidor de cada mudança.

## 5. Precedência e Prioridades

A tabela segue a priorização MoSCoW do PRD (seção 6), convertida para a escala deste documento: Must é Crítico, Should é Importante e Could é Útil. A coluna Entrega diz em que fase a funcionalidade entra e como estava em 22/11/2026.

| No. | Funcionalidade | Prioridade do Cliente | Entrega |
|---|---|---|---|
| 1 | Cadastro e login com sessões em vários dispositivos | Crítico | Fase 1, entregue |
| 2 | Timer Pomodoro com registro de sessão e validação antifraude no servidor | Crítico | Fase 1, entregue |
| 3 | Cálculo de XP e nível | Crítico | Fase 1, entregue |
| 4 | Guildas e ranking interno | Crítico | Fase 1, entregue |
| 5 | Raids semanais com meta coletiva | Crítico | Fase 1, entregue |
| 6 | Aplicativo universal Web, iOS e Android | Crítico | Fase 1, entregue |
| 7 | Cobrança: assinatura premium e Pacotes (Stripe, modo de teste) | Crítico | Fase 1, entregue (ADR-015, revisa a ADR-007) |
| 8 | Chat da guilda em tempo real | Importante | Fase 1, entregue (planejado para a Fase 2) |
| 9 | Perfil com itens cosméticos e equipagem | Importante | Fase 1, entregue |
| 10 | Notificações em tempo real (nível, raid concluída) | Importante | Fase 1, parcial: os eventos atualizam as telas, mas não há aviso visível |
| 11 | Flags de plano (gratuito ou premium) nos recursos premium | Importante | Fase 1, parcial: só os itens premium checam o plano |
| 12 | Idiomas além do português | Útil | Não iniciado |
| 13 | Companheiro (mascote com XP próprio) | Fora desta fase | Adiado para a Fase 2 (ADR-004) |

## 6. Requisitos Não-Funcionais do Produto

- **Requisitos de Sistema:** o tempo de uma sessão é contado pelo servidor; o cliente nunca é a fonte da duração. Cada usuário tem no máximo uma sessão ativa, controlável de qualquer dispositivo. Uma resposta REST deve levar menos de 300 ms no percentil 99, e um evento de guilda deve chegar aos membros em menos de 1 segundo.
- **Requisitos de Suportabilidade / Ambiente:** Web desktop em navegadores modernos e celulares iOS e Android. Tablets ficam fora do aceite inicial. O aplicativo segue a matriz de compatibilidade do Expo SDK 57.
- **Requisitos de Usabilidade:** navegação lateral na Web desktop e barra inferior no celular; área de toque mínima de 44 × 44 px; foco visível na Web; contraste WCAG AA; opção de reduzir movimento, além de respeitar a preferência do sistema.
- **Requisitos de Confiabilidade:** disponibilidade alvo de 99,0% no MVP. Comandos de sessão são idempotentes, e o progresso de uma sessão em andamento sobrevive a recarga da página e queda de conexão. O esquema do banco é versionado por migrations testadas em subida e descida. O plano premium só muda pelo webhook do Stripe, que relê o objeto na API antes de aplicar, de modo que um evento repetido ou fora de ordem não altera o resultado.
- **Requisitos de Segurança:** senhas com Argon2id; access token JWT de 15 minutos e refresh token rotativo por dispositivo, em cookie httpOnly na Web e em armazenamento seguro no celular; até 5 sessões por usuário, com revogação individual ou de todos os outros dispositivos; limite de requisições no login, no cadastro, no início de sessão e na Loja; antifraude que trunca sessões acima de 4 horas contínuas ou 16 horas por dia. Dados de cartão nunca passam pelo servidor: o pagamento acontece nas páginas do Stripe, e o webhook é aceito só com assinatura válida.
- **Requisitos de Documentação:** requisitos e decisões no PRD; contratos REST e de tempo real em OpenAPI e AsyncAPI, validados com Redocly CLI; glossário do domínio em `CONTEXT.md`.

## 7. Restrições Técnicas

### 7.1 Padrões Aplicáveis

- TypeScript em modo estrito no backend e no frontend.
- API REST sob o prefixo `/api/v1`, com erros no formato RFC 7807 (`application/problem+json`) e paginação por cursor.
- Contratos em OpenAPI 3 (REST) e AsyncAPI 3 (Socket.IO).
- WCAG 2 nível AA para a interface.
- Chamadas entre módulos do backend só pelo Service público do módulo dono do dado (ADR-001).

### 7.2 Restrições Aplicáveis

- Equipe de quatro pessoas e prazo de um ano.
- Um único backend em uma réplica; o Redis Adapter do Socket.IO só entra quando houver uma segunda réplica (ADR-003).
- Cobrança só em modo de teste do Stripe, com cartão e em reais; cobrança real, compra dentro dos aplicativos iOS e Android, PIX, boleto, impostos e reembolso ficam fora (ADR-015).
- Aplicativos iOS e Android validados localmente, sem publicação nas lojas nesta fase (ADR-008).
- Interface só em português do Brasil.

## 8. Manual de Arquitetura

### 8.1 Visão de Implementação

O código fica num monorepo de npm workspaces com dois aplicativos. `apps/backend` é um monólito modular NestJS, dividido nos módulos auth, users, progression, sessions, economy, shop, objectives, guilds, raids, chat, billing e realtime, com código transversal em shared. `apps/frontend` é um único aplicativo Expo que gera a versão Web e os aplicativos iOS e Android. O MySQL é a única fonte de verdade: o REST lê e altera o estado, e o Socket.IO só avisa os dispositivos de que algo mudou. O Documento de Arquitetura de Software, versão 2.1, detalha camadas, módulos e tecnologias.

### 8.2 Mecanismos Arquiteturais

| Mecanismo de Análise | Mecanismo de Design | Mecanismo de Implementação |
|---|---|---|
| Persistência | Banco de Dados Relacional | MySQL 8.0 com TypeORM 0.3 e migrations versionadas |
| Comunicação cliente-servidor | API REST | NestJS 10 no servidor, Axios no cliente |
| Tempo real | Eventos por sala (usuário e guilda) | Socket.IO 4 |
| Autenticação | Token de acesso e refresh token rotativo por dispositivo | JWT com Passport; senhas com Argon2id |
| Estado remoto no cliente | Cache invalidado por eventos | TanStack Query 5 |
| Armazenamento seguro no celular | Cofre do sistema operacional | Expo SecureStore |
| Pagamentos | Checkout e Portal hospedados, confirmação por webhook | Stripe (SDK `stripe` no servidor), modo de teste |

## 9. Dicionário de Dados

### 9.1 Finalidade

Esta seção lista as tabelas do banco e o que cada uma guarda. Os tipos, chaves e índices estão no `docs/DADOS.pdf` e nas migrations de `apps/backend/src/migrations`, que são a definição oficial do esquema.

### 9.2 Tabelas

| Tabela | Conteúdo |
|---|---|
| `users` | Conta do usuário: e-mail, hash da senha, nome do guerreiro e plano (`plan_tier`: free ou premium). |
| `sessions` | Um dispositivo conectado: hash do refresh token, rótulo do dispositivo, último uso e revogação. |
| `session_refresh_token_history` | Hashes de refresh tokens já usados, para detectar reuso. |
| `characters` | Personagem do usuário: nível e XP total. |
| `cosmetic_items` | Catálogo de itens: categoria, nome, condição de desbloqueio, se é premium e preço na Loja. |
| `user_cosmetic_items` | Inventário: itens que cada usuário tem e quais estão equipados. |
| `study_sessions` | Sessões de estudo: matéria, modo (solo ou guilda), tipo (Ciclo ou Foco livre), estado, prazo, pausas, foco válido, XP concedido e motivo de truncamento ou descarte. |
| `active_study_sessions` | Ponteiro para a única sessão ativa de cada usuário. |
| `study_session_start_receipts` | Recibo do comando de início, por chave de idempotência, para repetir a mesma resposta. |
| `study_session_transition_receipts` | Recibo de pausa, retomada, parada e conclusão, por chave de idempotência. |
| `study_session_command_keys` | Chaves de idempotência já usadas por usuário, em qualquer comando de sessão. |
| `guilds` | Guildas: nome, nível e criador. |
| `guild_memberships` | Membros de cada guilda e o papel (Líder ou membro). |
| `guild_chat_messages` | Mensagens do Mural e avisos automáticos dos golpes da Raid, em sequência por guilda. |
| `missions` | Missões de Raid: nome, descrição, arte, ordem no rodízio e preço na Loja. |
| `mission_reward_items` | Itens que cada Missão dá como recompensa. |
| `user_missions` | Missões compradas por cada usuário. |
| `guild_mission_choices` | Missão escolhida pelo Líder para a próxima Raid. |
| `raids` | Raid semanal de uma guilda: Missão, meta, progresso, vida regenerada pela Fúria do dragão, datas e situação. |
| `raid_participations` | Usuários que entraram em cada Raid. |
| `raid_contributions` | Contribuição de cada sessão de estudo para a Raid. |
| `coin_balances` | Saldo de Moedas de cada usuário. |
| `coin_ledger_entries` | Extrato: cada crédito e débito de Moedas, com origem e saldo resultante. |
| `subscriptions` | Assinatura premium do usuário no Stripe: cliente, assinatura, status e fim do período pago. |
| `packs` | Pacotes de itens vendidos por dinheiro (ex.: Pacote do Dragão, R$ 4,90). |
| `pack_payments` | Pagamento de um Pacote por um usuário, um por sessão do Checkout. |
