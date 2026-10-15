# Wise Warrior

Plataforma de produtividade gamificada: o estudante faz Study Sessions, ganha XP e evolui um Character que coopera com uma Guild em Raids.

## Language

### Personagem e cosméticos

**Character** (Personagem):
A representação RPG do usuário, com nível, XP acumulado e os Cosmetic Items que ele equipou.
_Avoid_: Perfil (quando se refere ao personagem), herói, avatar (para o personagem inteiro)

**Cosmetic Item**:
Um item visual do Character, de uma das categorias Avatar, Badge, Título ou Acessório.
_Avoid_: item, recompensa, skin

**Catálogo**:
O conjunto de todos os Cosmetic Items que existem na plataforma, desbloqueados ou não pelo usuário.
_Avoid_: Coleção, loja

**Inventário**:
Os Cosmetic Items que um usuário já desbloqueou.
_Avoid_: Coleção, bolsa

**Condição de desbloqueio**:
A regra que dá um Cosmetic Item a um usuário, por exemplo alcançar um nível ou concluir uma Raid.
_Avoid_: requisito, critério

**Desbloqueio**:
A entrada de um Cosmetic Item no Inventário de um usuário quando a Condição de desbloqueio é atendida. Ocorre uma única vez por item.
_Avoid_: compra, ganho

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

### Sessão de estudo

**Study Session** (Sessão de estudo):
O intervalo de foco registrado no servidor, com duração planejada, modo (solo ou guilda) e timestamps canônicos gerados pelo servidor. Um usuário tem no máximo uma Study Session ativa por vez.
_Avoid_: sessão Pomodoro (quando se refere à entidade de dados), timer

**Ciclo**:
Um intervalo de foco de duração planejada — tipicamente 15, 25 ou 50 minutos. Corresponde a uma Study Session iniciada com aquela duração. Pausas entre ciclos são locais ao cliente e não geram Study Sessions.
_Avoid_: pomodoro (como substantivo para o ciclo inteiro), rodada

**Encerramento antecipado**:
O ato de encerrar manualmente uma Study Session com pelo menos 5 minutos completos de foco acumulado. Concede XP proporcional ao tempo válido.
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

### Guilda e Raid

**Guild** (Guilda):
O grupo de estudantes que coopera nas Raids. Cada usuário participa de no máximo uma Guild, e a entrada é aberta.
_Avoid_: clã, grupo, time

**Líder**:
O membro da Guild com papel de liderança. Quando sai, o membro mais antigo assume. Quando o último membro sai, a Guild deixa de existir.
_Avoid_: dono, admin, criador

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
Onde o usuário compra Missões com a moeda do jogo. A Missão comprada pertence a quem comprou e não é consumida ao ser usada. O Líder escolhe, entre as Missões dos membros atuais, a Missão da próxima Raid. Se o dono sai da Guild durante a Raid, a Raid continua.
_Avoid_: Catálogo (que é dos Cosmetic Items), mercado

**Participante**:
O membro da Guild que confirmou participação numa Raid. Só as Study Sessions de um Participante contam para a Raid.
_Avoid_: inscrito, jogador

**Raid Contribution** (Contribuição):
O XP de uma Study Session de modo Guilda, concluída dentro do período da Raid, somado ao progresso coletivo. Cada Study Session contribui no máximo uma vez.
_Avoid_: doação, pontos

**Meta batida**:
O momento em que o progresso coletivo alcança a meta da Raid. A Raid continua aceitando Contribuições até o fim da semana.
_Avoid_: raid concluída (antes do fim do período), vitória antecipada

**Ranking interno**:
A classificação dos membros por Contribuição na Raid da semana. Não existe outro ranking da Guild.
_Avoid_: ranking geral, leaderboard, placar

**Recompensa de Raid**:
O Desbloqueio do Cosmetic Item indicado pela Missão, dado no fim da Raid com Meta batida a cada Participante com pelo menos uma Contribuição.
_Avoid_: prêmio, loot, drop
