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
Um Cosmetic Item cuja Condição de desbloqueio é o nível 1, de modo que todo Character já começa com ele no Inventário.
_Avoid_: item padrão, item grátis

**Item premium** (✦):
Um Cosmetic Item marcado como exclusivo do plano premium. No MVP o selo ✦ é exibido, mas a política de entitlement libera o item para todos.
_Avoid_: item pago, item VIP

**Prévia**:
A visualização de um Cosmetic Item aplicado ao Character antes de confirmar a ação de Equipar. Nada é persistido.
_Avoid_: preview, rascunho

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
