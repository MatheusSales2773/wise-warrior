# Wise Warrior

Plataforma de produtividade gamificada: o estudante faz Study Sessions, ganha XP e evolui um Character que coopera com uma Guild em Raids.

## Language

### Personagem e cosméticos

**Character** (Personagem):
A representação RPG do usuário, com nível, XP acumulado e os Cosmetic Items que ele equipou. Seu desenho é o Herói.
_Avoid_: Perfil (quando se refere ao personagem), herói (para o Character em si), avatar (para o personagem inteiro)

**Herói**:
A figura desenhada do Character, composta por um corpo base único mais as camadas do Avatar, da Arma e do Acessório equipados. Sem Avatar equipado, ou com um Avatar sem arte própria, vale o visual do Avatar inicial. Não existe seleção de classe: a variedade visual vem só dos Cosmetic Items.
_Avoid_: classe, personagem inteiro

**Cosmetic Item**:
Um item visual do Character, de uma das categorias Avatar, Badge, Título, Acessório ou Arma.
_Avoid_: item, recompensa, skin

**Arma**:
A categoria de Cosmetic Item desenhada na mão do Herói. É só visual: não altera XP, Raid nem Moedas. Todo Character tem uma Arma como Item inicial; desequipada, o Herói aparece sem arma.
_Avoid_: equipamento, item de combate

**Catálogo**:
O conjunto de todos os Cosmetic Items que existem na plataforma, desbloqueados ou não pelo usuário.
_Avoid_: Coleção, loja

**Inventário**:
Os Cosmetic Items que um usuário já desbloqueou.
_Avoid_: Coleção, bolsa

**Condição de desbloqueio**:
A regra que dá um Cosmetic Item a um usuário, por exemplo alcançar um nível, concluir uma Raid, somar um número de Study Sessions, terminar Study Sessions antes das 7h ou fazer a Compra do item.
_Avoid_: requisito, critério

**Desbloqueio**:
A entrada de um Cosmetic Item no Inventário de um usuário quando a Condição de desbloqueio é atendida. Ocorre uma única vez por item.
_Avoid_: ganho

**Compra**:
A troca de Moedas por uma Missão ou por um Cosmetic Item à venda na Loja. A Compra de um Cosmetic Item é uma Condição de desbloqueio. Não se compra o que já se tem. O que foi comprado fica com o usuário para sempre, mesmo que saia de venda.
_Avoid_: aquisição, transação

**À venda**:
A marca de um Cosmetic Item que pode ser comprado na Loja. Recompensas de Raid, itens de nível, Itens premium e Badges nunca estão à venda: o Badge é sempre conquistado.
_Avoid_: vendável, disponível

**Fora de venda**:
Um Cosmetic Item cuja Condição de desbloqueio é a Compra mas que saiu da Loja. Quem o comprou continua com ele; quem não comprou não tem como obtê-lo.
_Avoid_: descontinuado, esgotado

**Equipar**:
Escolher qual Cosmetic Item do Inventário o Character exibe em uma categoria. Fica no máximo um equipado por categoria, e um item pode ser desequipado.
_Avoid_: usar, ativar, vestir

**Título**:
O Cosmetic Item da categoria Título que está equipado no Character. Não existe outra fonte de título.
_Avoid_: rank, cargo, título livre

**Item inicial**:
Um Cosmetic Item cuja Condição de desbloqueio é o nível 1, de modo que todo Character já começa com ele no Inventário e equipado.
_Avoid_: item padrão, item grátis

**Item premium** (✦):
Um Cosmetic Item marcado como exclusivo do plano premium. No MVP o selo ✦ é exibido, mas a política de entitlement libera o item para todos.
_Avoid_: item pago, item VIP

**Prévia**:
A visualização de um Cosmetic Item aplicado ao Character antes de confirmar a ação de Equipar. Nada é persistido.
_Avoid_: preview, rascunho

### Conta

**Dispositivo conectado**:
Um aparelho ou navegador em que o usuário está logado. Cada login abre um novo Dispositivo conectado, que permanece ativo até ser encerrado pelo próprio usuário, substituído ao exceder o limite de dispositivos simultâneos ou desconectado ao sair da conta. Encerrar os outros dispositivos preserva aquele em uso.
_Avoid_: sessão, sessão ativa, sessão de login (para não confundir com Study Session)

### Sessão de estudo

**Study Session** (Sessão de estudo):
O intervalo de foco registrado no servidor, com modo (solo ou guilda) e timestamps canônicos gerados pelo servidor. É um Ciclo ou um Foco livre. Um usuário tem no máximo uma Study Session ativa por vez.
_Avoid_: sessão Pomodoro (quando se refere à entidade de dados), timer

**Ciclo**:
Uma Study Session de duração planejada — tipicamente 15, 25 ou 50 minutos — que conclui sozinha ao fim dela e avança a cadência Pomodoro. Pausas entre ciclos são locais ao cliente e não geram Study Sessions.
_Avoid_: pomodoro (como substantivo para o ciclo inteiro), rodada

**Foco livre**:
Uma Study Session sem duração planejada, em que o tempo conta para cima até o usuário parar. Parar com pelo menos 5 minutos completos de foco a conclui; com menos, é Cancelamento. Combina com o modo solo ou guilda, gera XP, Moedas e Contribuição como um Ciclo, mas não avança a cadência Pomodoro nem oferece pausa curta ou longa. Ao atingir o limite contínuo ou o limite diário do antifraude, conclui sozinho.
_Avoid_: modo livre (o modo é solo ou guilda), cronômetro livre, sessão aberta

**Encerramento antecipado**:
O ato de encerrar manualmente um Ciclo antes da duração planejada, com pelo menos 5 minutos completos de foco acumulado. Concede XP proporcional ao tempo válido. Um Foco livre não tem Encerramento antecipado: parar é concluí-lo.
_Avoid_: cancelamento (reservado para menos de 5 minutos), interrupção

**Cancelamento**:
O encerramento manual de uma Study Session com menos de 5 minutos completos de foco. Não concede XP nem Contribuição para Raid.
_Avoid_: encerramento antecipado (reservado para ≥ 5 minutos)

**XP de sessão**:
O XP concedido ao Character ao término de uma Study Session, calculado como `floor(segundosDeFocoVálidos / 60) × XP_PER_MINUTE`. A taxa `XP_PER_MINUTE` é configurável por env var (padrão 10).
_Avoid_: pontos de sessão, XP ganho (como termo técnico distinto)

**Sessão truncada**:
Uma Study Session cujo foco válido foi limitado pelo antifraude (limite contínuo de 4h ou limite diário de 16h, ambos configuráveis), recebendo XP calculado sobre o tempo truncado em vez do tempo real. O motivo consta em `capped_reason`. Distinto de Sessão descartada.
_Avoid_: sessão inválida, sessão bloqueada

**Sessão descartada**:
Uma Study Session cujo XP é zero por violação técnica grave (ex.: duração inválida). Permanece visível ao usuário com indicador "não contabilizada".
_Avoid_: sessão deletada, sessão removida

### Crônicas

**Objetivo**:
Uma meta pessoal do usuário, diária ou semanal, cumprida com Study Sessions. Cumprir um Objetivo dá Moedas, nunca XP.
_Avoid_: missão (reservada ao modelo de Raid), tarefa, desafio, contrato

**Marco**:
A Condição de desbloqueio de um Badge mostrada com o progresso do usuário até ela. Conquistar um Marco é o Desbloqueio do Badge; não existe recompensa própria do Marco.
_Avoid_: conquista, achievement, troféu

**Constância**:
Quantos dias seguidos, até hoje, o usuário terminou pelo menos uma Study Session não descartada, no horário de São Paulo. É pessoal e independe da Guild.
_Avoid_: sequência (reservada à Guild), streak, ofensiva

**Diário**:
O histórico de Study Sessions do usuário, mostrando cada uma como concluída, truncada ou descartada. Cancelamentos não aparecem.
_Avoid_: histórico, log, Extrato (que é o histórico de Moedas)

### Guilda e Raid

**Guild** (Guilda):
O grupo de estudantes que coopera nas Raids. Cada usuário participa de no máximo uma Guild, e a entrada é aberta.
_Avoid_: clã, grupo, time

**Líder**:
O membro da Guild com papel de liderança. Quando sai, o membro mais antigo assume. Quando o último membro sai, a Guild deixa de existir.
_Avoid_: dono, admin, criador

**Mural**:
O chat da Guild, em tempo real e com histórico. Só membros leem e escrevem. Mensagens perdidas durante uma queda de conexão são recuperadas na reconexão.
_Avoid_: chat (como termo próprio), feed, mensagens

**Presença** (online):
Se um membro da Guild está conectado agora, em qualquer dispositivo. Só é conhecida enquanto o próprio usuário está conectado; sem conexão, o app não mostra presença.
_Avoid_: status, ativo, disponível

**Nível da Guild**:
A contagem de Raids que a Guild venceu. Começa em 1 e sobe um nível a cada Meta batida.
_Avoid_: rank da guilda, XP da guilda

**Raid**:
O desafio semanal de uma Guild, com uma meta coletiva de XP a ser alcançada até o fim da semana. Cada Raid é uma instância de uma Missão, de quem herda o título.
_Avoid_: evento, desafio (como termo próprio)

**Missão**:
O modelo temático de uma Raid, com nome, descrição, imagem e a Recompensa de Raid que concede. Não define a meta. Sem escolha do Líder, a Raid da semana usa a Missão do rodízio, igual para todas as Guilds.
_Avoid_: quest, modelo de raid, template

**Loja**:
O único lugar onde o usuário gasta Moedas, com duas seções: Missões e os Cosmetic Items À venda. A Missão comprada pertence a quem comprou e não é consumida ao ser usada. O Líder escolhe, entre as Missões dos membros atuais, a Missão da próxima Raid, e pode repetir uma Missão. A escolha trava quando a Raid começa; se o dono sai da Guild antes disso, a escolha é anulada e vale o rodízio. Se o dono sai durante a Raid, a Raid continua. O dono não ganha nada quando sua Missão é usada.
_Avoid_: Catálogo (que é todo o conjunto de Cosmetic Items, à venda ou não), mercado

**Participante**:
O membro da Guild que confirmou participação numa Raid. Só as Study Sessions de um Participante contam para a Raid.
_Avoid_: inscrito, jogador

**Raid Contribution** (Contribuição):
O XP de uma Study Session de modo Guilda, concluída dentro do período da Raid, somado ao progresso coletivo. Cada Study Session contribui no máximo uma vez.
_Avoid_: doação, pontos

**Vida do chefe**:
O quanto falta para vencer a Raid: a meta, menos as Contribuições, mais o que a Fúria do dragão recuperou. Nunca passa da meta nem fica abaixo de zero.
_Avoid_: HP restante, meta restante

**Meta batida**:
O momento em que a Vida do chefe chega a zero. Com Fúria, isso exige mais XP do que a meta. A Raid continua aceitando Contribuições até o fim da semana.
_Avoid_: raid concluída (antes do fim do período), vitória antecipada

**Golpe**:
Uma Contribuição vista como dano ao chefe, com autor, XP e duração da Study Session. Cada Contribuição é um único Golpe.
_Avoid_: ataque, hit, dano (como termo próprio)

**Aviso do Mural**:
Uma mensagem automática no Mural, sem autor humano, que anuncia um Golpe. Nenhum membro escreve Avisos.
_Avoid_: mensagem de sistema, notificação

**Ranking interno**:
A classificação dos membros por Contribuição na Raid da semana. Não existe outro ranking da Guild.
_Avoid_: ranking geral, leaderboard, placar

**Recompensa de Raid**:
Os Desbloqueios dos Cosmetic Items indicados pela Missão e as Moedas de vitória, dados no fim da Raid com Meta batida a cada Participante com pelo menos uma Contribuição. Itens que o Participante já tem são pulados; as Moedas são pagas mesmo quando a Missão se repete.
_Avoid_: prêmio, loot, drop

**Dia de estudo**:
Um dia, no horário de São Paulo, com pelo menos uma Contribuição na Raid da Guild. Study Sessions solo não contam.
_Avoid_: dia ativo, dia com sessão

**Sequência**:
Quantos Dias de estudo seguidos a Guild tem na semana da Raid, até hoje. Zera na segunda. Hoje sem estudo ainda não quebra a Sequência; só conta se tiver estudo.
_Avoid_: streak, ofensiva

**Fúria do dragão** (Fúria):
A vida que o chefe da Raid recupera por dia inteiro da Raid que não foi Dia de estudo. O dia em que a Raid começou no meio e o último dia não contam. Para quando a Meta é batida.
_Avoid_: regeneração, cura

**Moeda**:
A moeda do jogo, ganha com Study Sessions, com Objetivos, com a Recompensa de Raid e no cadastro, e gasta na Loja. É do usuário, não da Guild, e não pode ser transferida. Não tem relação com o plano premium.
_Avoid_: ouro, coin, crédito, tesouro

**Extrato**:
O histórico de Moedas ganhas e gastas por um usuário, com a origem de cada uma.
_Avoid_: livro-razão, histórico de transações
