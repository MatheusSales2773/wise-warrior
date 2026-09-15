# Plano de implementação — M4 Dashboard universal

**Data:** 15/09/2026

**Status:** Pronto para implementação

**Milestone:** M4 — Dashboard

**Depende de:** M1 — Fundação Expo universal, M2 — Design system e navegação e
M3 — Autenticação universal

**Fontes de produto:**

- `docs/PRD.md`, em especial as seções 6–8, ADR-008 e ADR-009;
- `docs/plans/2026-09-03-react-native-migration-prioritization-design.md`;
- `docs/plans/2026-09-03-react-native-universal-design.md`;
- `docs/plans/2026-09-05-react-native-m3-implementation-plan.md`;
- `docs/api/openapi.yaml`;
- dashboard Web removido no commit `76b6bab`, somente como referência do
  conteúdo mínimo que já existia;
- `docs/Wise Warrior _standalone_.html`, referência visual obrigatória para a
  identidade, hierarquia, composição e acabamento do Dashboard. O arquivo deve
  ser consultado durante a implementação e o QA visual, sem ser incorporado como
  código nem prevalecer sobre os contratos reais de domínio e API.

## 1. Resultado esperado

Ao concluir a M4, a rota autenticada `/` substituirá o placeholder
“Seu painel de progresso está em preparação” por um Dashboard universal que
consulta o backend real e apresenta:

- saudação com o nome do usuário e título, quando houver;
- nível atual, XP total e progresso até o próximo nível;
- as cinco sessões de estudo encerradas mais recentes;
- estado vazio honesto para uma conta sem atividade;
- estados distintos de carregamento inicial, erro total, erro parcial,
  atualização em segundo plano e atualização manual;
- retry explícito sem limpar uma sessão autenticada válida;
- atualização ao retornar ao app quando os dados estiverem stale;
- pull-to-refresh controlado em iOS/Android e ação equivalente na Web;
- composição em duas colunas na Web larga e empilhada na Web estreita e nos
  celulares;
- leitura e interação acessíveis com teclado, leitor de tela, fonte ampliada e
  movimento reduzido.

Todos os valores exibidos serão derivados do contrato REST. Não entram dados de
demonstração, contagens inventadas, streak, agenda, guilda, raid, mascote ou
conquistas sem persistência real.

### Interpretação de “atividade” na M4

Para fechar a lacuna deixada pelos documentos, **atividade** significa nesta
milestone uma prévia, limitada e ordenada, das **cinco Study Sessions encerradas
mais recentes** do usuário autenticado. “Mais recente” é definido pelo instante
de término (`endedAt`), não pelo início. Cada item mostra matéria, modo, horário,
duração validada, XP concedido e eventual descarte.

Essa prévia não é o histórico completo do Perfil. Paginação, filtros, detalhes e
gestão das sessões autenticadas por dispositivo continuam na M5. A M4 cria apenas
o contrato mínimo de leitura reutilizado pelo Dashboard; o histórico completo
terá contrato paginado próprio.

## 2. Estado confirmado antes da mudança

### 2.1 Stack instalada em 15/09/2026

Versões resolvidas por `package-lock.json` e confirmadas com `npm ls`:

| Tecnologia | Versão confirmada | Papel na M4 |
| --- | ---: | --- |
| Node.js | `22.22.3` | execução local e CI |
| npm | `10.9.8` | workspaces e lockfile |
| Expo | `57.0.23` | runtime universal |
| Expo Router | `57.0.21` | rota autenticada `/` |
| React Native | `0.86.3` | layout, rolagem, atualização e acessibilidade |
| React Native Web | `0.21.2` | Dashboard Web |
| React | `19.2.3` | composição e providers |
| TypeScript frontend | `6.0.3` | contratos remotos e estados discriminados |
| TanStack Query | `5.102.8` | cache remoto, cancelamento e refetch |
| Axios | `1.20.0` | transporte autenticado existente |
| Jest | `29.7.0` | testes backend e frontend |
| React Native Testing Library | `14.0.1` | testes de componentes acessíveis |
| Playwright | `1.63.0` | fluxo real do Dashboard Web |
| NestJS | `10.4.22` | contratos de perfil e atividade recente |
| TypeORM | `0.3.31` | leitura de Character e Study Session |
| TypeScript backend | `5.9.3` | DTOs e serviços backend |
| MySQL | `8.0` | fonte de verdade da progressão e atividade |

A matriz instalada permanece alinhada ao Expo SDK 57: React Native 0.86,
React 19.2 e React Native Web 0.21. Nenhuma dependência nova de runtime é
necessária para a M4. O tooling passa a fixar `@redocly/cli@2.53.2` como
devDependency na raiz para validar o OpenAPI 3.1 de forma reprodutível. Se o
lockfile mudar antes da implementação, repetir `npm ls`,
`expo install --check` e `expo-doctor` antes de tomar decisões de API.

### 2.2 Frontend observado após a M3

O frontend já possui:

- rota autenticada `src/app/(app)/index.tsx`, ainda como placeholder;
- `QueryClientProvider` em memória e integração nativa do `focusManager` com
  `AppState`;
- cliente Axios autenticado com bearer em memória, refresh single-flight,
  `AbortSignal` e taxonomia segura de erros;
- limpeza integral do cache ao encerrar ou invalidar a autenticação;
- `Screen`, `WiseCard`, `WiseText`, `WiseButton`, `FeedbackMessage` e
  `ProgressBar` universais;
- breakpoint Web em `900 px`, conteúdo máximo de `1200 px`, sidebar Web e
  navegação inferior móvel;
- testes Jest/RNTL, exportação das três plataformas e E2E Web real da M3.

Lacunas da M4:

- não existe feature ou query de Dashboard;
- a rota `/` não chama o backend;
- `Screen` não expõe hoje um contrato de pull-to-refresh;
- não existe apresentação de dado stale ou erro parcial;
- não há teste de cache remoto de produto além da autenticação.

### 2.3 Contrato backend observado

`GET /users/me` já retorna `id`, `email`, `displayName`, `planTier`, `level`,
`xpTotal` e `title`. Isso cobre identidade resumida, nível e XP total, mas não
expõe os limites necessários para desenhar a barra até o próximo nível sem
duplicar a fórmula de progressão no cliente.

O backend já contém `xpThresholdForLevel`, `levelForXp` e `applyXp` no domínio de
`progression`. Essa regra continua sendo autoridade do servidor.

O módulo `sessions` permite iniciar, enviar heartbeat e concluir uma Study
Session. `study_sessions` já guarda matéria, modo, início, fim, duração validada,
XP concedido e motivo de descarte, com índice por usuário e início. Porém não há
endpoint de leitura do histórico ou da atividade recente no controller ou no
OpenAPI.

### 2.4 Evidência de dependência

O merge `4de4123` integrou a M3 no branch `develop`, e o usuário confirmou a
milestone como finalizada. A ausência de um arquivo de validação M3 em
`docs/validation` não será usada para reabrir seu escopo; a M4 preservará todos
os gates automatizados de autenticação e registrará separadamente qualquer QA
nativo que ainda dependa de interação humana.

## 3. Decisões de implementação

### 3.1 Duas consultas, sem endpoint agregado de tela

O Dashboard usará duas fontes REST:

1. `GET /users/me` para identidade e progressão;
2. `GET /sessions/recent` para a prévia de atividade.

Não criar `GET /dashboard`. Perfil/progressão e sessões possuem ciclos de vida,
estados vazios e consumidores futuros diferentes. Consultas separadas permitem
reutilizar o perfil na M5, evoluir o histórico sem quebrar o Dashboard e manter
a progressão visível se somente a atividade falhar.

O cliente executa as queries em paralelo. O erro de perfil é bloqueante porque
impede o conteúdo principal; o erro de atividade é local ao card de atividade.
Uma atualização que falha depois de já existir cache mantém o conteúdo anterior
visível e o marca como não atualizado, sem transformar uma falha transitória em
logout ou tela vazia.

### 3.2 Projeção de progressão calculada no servidor

Estender `UserProfile` de forma retrocompatível com:

```text
levelStartXp: XP total mínimo do nível atual
nextLevelXp:  XP total necessário para alcançar level + 1
```

Exemplo para nível 1:

```json
{
  "level": 1,
  "xpTotal": 0,
  "levelStartXp": 0,
  "nextLevelXp": 1414
}
```

`ProgressionService` passa a expor uma projeção de leitura construída com a
política de domínio existente. `UsersService` consome o serviço público do
módulo `progression`, em vez de reproduzir `500 × N^1.5` no frontend. Preservar
o comportamento atual de nível 1/0 XP caso uma conta legada não tenha Character,
mas cobrir esse caso como reparo de consistência a ser observado, não como estado
normal de cadastro.

TypeORM mapeia colunas SQL `BIGINT` para `string`; portanto, a tipagem TypeScript
atual de `Character.xpTotal` como `number` não garante o valor hidratado em
runtime. Normalizar somente a resposta seria insuficiente: `awardXp` também faz
aritmética e poderia concatenar `"10" + 10`.

Adicionar um transformer/parser único na coluna `xp_total`, que:

- converte a leitura do banco para `number` somente se o valor for inteiro,
  não negativo, `Number.isSafeInteger` e menor ou igual a
  `MAX_SUPPORTED_XP_TOTAL = 9_000_000_000_000_000`;
- valida a escrita com as mesmas regras e envia representação decimal exata ao
  driver;
- falha de forma observável antes de qualquer cálculo ou persistência se o valor
  estiver fora do intervalo seguro;
- é usado tanto por `awardXp` quanto pela projeção de leitura, sem cast local
  divergente.

O teto deixa margem dentro de `Number.MAX_SAFE_INTEGER` para calcular o limiar
do nível seguinte. `applyXp` valida `currentXpTotal` e `xpGained` como inteiros
seguros não negativos e executa soma verificada antes de chamar `levelForXp`:
rejeita quando `currentXpTotal > MAX_SUPPORTED_XP_TOTAL - xpGained`. Dois valores
individualmente válidos não podem produzir total arredondado ou inseguro.

O `levelForXp` linear atual também deve ser substituído. Estimar o nível pela
inversa de `500 × N^1.5` e ajustar o candidato por uma quantidade limitada de
comparações com `xpThresholdForLevel`, preservando exatamente os limiares
arredondados atuais. O custo não pode crescer linearmente com XP.

Testes com MySQL real confirmam a hidratação numérica e aplicam **dois créditos
positivos sequenciais**, verificando soma aritmética, XP total e nível. Testes de
fronteira cobrem o maior total aceito, soma que excede o teto e equivalência do
novo cálculo de nível nos limiares atuais. A API não serializa XP como string nem
retorna `NaN`, infinito ou valor inseguro.

O frontend alimenta `ProgressBar` diretamente com:

```text
minimumValue = levelStartXp
maximumValue = nextLevelXp
value        = xpTotal
```

A barra recebe nome acessível “Progresso para o nível {level + 1}” e texto
visível com XP acumulado no nível e XP restante. O cliente pode calcular apenas
diferenças e percentuais para apresentação; ele não recalcula limiares.

### 3.3 Contrato mínimo de atividade recente

Adicionar `GET /sessions/recent`, protegido pelo `JwtAuthGuard`, que retorna no
máximo cinco sessões do próprio usuário com `endedAt IS NOT NULL`, ordenadas por
`endedAt DESC` e `id DESC` para desempate determinístico.

Resposta:

```text
RecentStudySession[]

RecentStudySession = {
  id,
  subject,
  mode,
  startedAt,
  endedAt,
  durationValidSeconds,
  xpAwarded,
  discardedReason
}
```

Regras:

- a coleção vazia é `200 []`, nunca `404`;
- sessão ativa não aparece como atividade encerrada;
- `userId`, `raidId`, relações TypeORM e outros dados internos não são
  serializados;
- somente registros do usuário autenticado são consultados;
- duração e XP são os valores validados/persistidos pelo servidor;
- sessão descartada permanece visível, com XP zero e motivo mapeado para texto
  seguro;
- não há paginação, filtro ou parâmetro de quantidade nesta milestone; a
  coleção é deliberadamente limitada a cinco itens;
- o endpoint de histórico completo da M5 poderá ter contrato paginado separado.

Usar projeção explícita/mapper de resposta, não devolver a entidade TypeORM
diretamente. Como o contrato ordena pela conclusão, adicionar por migration o
índice `(user_id, ended_at, id)` e validar seu uso com `EXPLAIN`. O índice atual
`(user_id, started_at)` não cobre a semântica definida nem o desempate completo.

### 3.4 Fronteira de dados do frontend

Criar `src/features/dashboard/api.ts` com DTOs remotos estreitos e funções:

```text
getMyProfile({ signal })
getRecentStudySessions({ signal })
```

As funções usam `getAuthenticatedHttpClient()` e propagam o `AbortSignal`
fornecido pelo TanStack Query. Não importam Router, componentes ou contexto de
autenticação e não criam uma segunda instância Axios.

Criar query options/keys estáveis sob `features/dashboard/queries.ts`:

```text
dashboardKeys.profile()
dashboardKeys.recentActivity()
```

Política inicial:

- `staleTime: 30_000` para perfil e atividade;
- sem retry automático, preservando a decisão global da M3;
- cache somente em memória;
- refetch ao recuperar foco se a query estiver stale;
- cancelamento real ao desmontar ou trocar de sessão;
- atualização manual refaz as duas queries e termina somente quando ambas
  assentarem;
- logout/invalidação continua limpando tudo pelo `QueryClient` da M3.

Não guardar perfil no `AuthProvider`, SecureStore, AsyncStorage, localStorage ou
estado global paralelo. Autenticação identifica a sessão; TanStack Query possui
os dados remotos do produto.

### 3.5 Matriz de estados

| Perfil | Atividade | Apresentação |
| --- | --- | --- |
| carregando, sem cache | qualquer | estrutura de carregamento com anúncio `status` |
| erro, sem cache | qualquer | erro bloqueante e ação “Tentar novamente” |
| sucesso | carregando, sem cache | perfil completo + card de atividade carregando |
| sucesso | sucesso com itens | Dashboard e cinco itens no máximo |
| sucesso | sucesso vazio | estado “Nenhuma sessão concluída ainda” |
| sucesso | erro, sem cache | Dashboard + erro isolado no card de atividade |
| cache existente | refetch em curso | conteúdo preservado + indicador discreto |
| cache existente | refetch falhou | conteúdo preservado + aviso e retry |

Uma lista vazia só é exibida após resposta `200 []`. `undefined`, cancelamento e
erro não são interpretados como vazio. Erro `401` continua sob responsabilidade
do fluxo M3: tenta refresh uma vez e só então invalida a autenticação quando a
falha for terminal.

### 3.6 Atualização manual e retorno ao app

Estender `Screen` com props opcionais e controladas de atualização, usadas apenas
quando a tela for rolável:

```text
refreshing?: boolean
onRefresh?: () => void
```

Em iOS/Android, `Screen` conecta essas props a `RefreshControl`. O booleano fica
`true` durante toda a atualização disparada pelo usuário, conforme o contrato do
React Native. Na Web, o Dashboard oferece um `WiseButton` “Atualizar dados”; não
simular gesto nativo nem depender de pull-to-refresh do browser.

O `focusManager` já instalado na M3 provoca refetch de queries stale quando o app
nativo volta a `active`; a Web conserva os listeners padrão do TanStack Query.
Não instalar `expo-network` ou NetInfo na M4. Detecção real de conectividade,
reconciliação e fila offline pertencem à P2.

Uma atualização em segundo plano não desmonta cards nem zera dados. O estado
dinâmico usa `accessibilityLiveRegion="polite"` no Android e semântica equivalente
na Web para anunciar “Atualizando dados”, “Dados atualizados” ou falha, sem
anunciar continuamente cada renderização.

### 3.7 Composição adaptativa

O Dashboard deve ser desenhado a partir da seção correspondente em
`docs/Wise Warrior _standalone_.html`. Sua hierarquia visual, proporções, cards,
ritmo, ornamentação e uso do tema Ouro/Índigo orientam a implementação. A
adaptação para React Native continua obrigatória: não copiar HTML/CSS/DOM e não
reproduzir dados fictícios presentes na referência.

Manter uma única árvore de componentes, sem arquivos `.web`/`.native` para a
interface:

- **Web ≥ 900 px:** grid de duas colunas; apresentação e progressão ocupam a
  coluna principal, atividade recente ocupa a lateral;
- **Web < 900 px, iOS e Android:** cards empilhados em ordem de leitura;
- largura segue `contentMaxWidth`; gutters e safe areas continuam no `Screen`;
- atividade tem no máximo cinco itens e é renderizada como conjunto pequeno de
  `View`s dentro do `ScrollView` existente, sem aninhar `FlatList`/VirtualizedList;
- títulos e valores não dependem somente de cor; XP usa texto e progressbar;
- fontes ampliadas podem aumentar a altura dos cards sem truncar nome, matéria,
  duração ou mensagem de erro;
- nenhuma animação adicional é necessária; o `ProgressBar` já respeita movimento
  reduzido.

Componentes sugeridos:

- `DashboardScreen` — coordena queries, refresh e matriz de estados;
- `ProfileSummaryCard` — saudação, nome e título opcional;
- `ProgressionCard` — nível, XP total, barra e limiares;
- `RecentActivityCard` — loading/erro/vazio/itens;
- `RecentActivityItem` — matéria, data local, duração, modo, XP e descarte;
- `DashboardStatus` — anúncio de atualização sem conteúdo sensível.

Datas são formatadas em pt-BR no fuso local do dispositivo com `Intl.DateTimeFormat`.
Usar data e hora absolutas; não introduzir biblioteca de datas nem rótulos
relativos que exigiriam um timer global. Duração usa minutos completos e mantém
segundos apenas quando inferior a um minuto.

### 3.8 Conteúdo e honestidade

- Saudação: “Boas-vindas, {displayName}”.
- Título `null`: omitir o título ou informar “Sem título equipado”; nunca criar
  um título RPG fictício.
- Plano (`planTier`) não vira CTA de assinatura; gateway continua fora da Fase 1.
- Atividade vazia explica que sessões concluídas aparecerão ali, sem afirmar que
  o timer definitivo já está disponível.
- Sessão descartada informa “Sessão não contabilizada” e zero XP; o motivo
  técnico bruto não é exibido como mensagem principal.
- Não expor e-mail no Dashboard; dados pessoais completos pertencem à M5.
- Não criar cards de guilda, raid, streak, cronograma, conquistas, cosméticos ou
  companheiro sem contratos reais.

### 3.9 Tempo real fica fora da M4

O backend já emite `progress:xpUpdated`, mas o cliente Socket.IO e o ciclo de
renovação da autenticação do socket ainda não fazem parte do frontend universal.
A própria M3 reservou Socket.IO para M6/P1/P4.

Portanto, a M4 garante frescor por carregamento inicial, refetch quando stale ao
retomar foco, refresh explícito e pull-to-refresh. Não instalar
`socket.io-client` nem abrir conexão parcial somente para o Dashboard. Quando a
camada realtime universal entrar, ela deverá invalidar as mesmas query keys,
mantendo REST como confirmação canônica e sem reescrever os componentes da M4.

## 4. Estrutura alvo ao concluir M4

```text
apps/backend/src/
├── migrations/
│   └── <timestamp>-add-study-session-recent-activity-index.ts
└── modules/
    ├── progression/
    │   ├── entities/character.entity.ts
    │   ├── xp-total.transformer.ts
    │   ├── progression.service.ts
    │   └── progression.service.spec.ts
    ├── sessions/
    │   ├── dto/
    │   │   └── recent-study-session.response.ts
    │   ├── sessions.controller.ts
    │   ├── sessions.service.ts
    │   └── sessions.service.spec.ts
    └── users/
        ├── users.service.ts
        └── users.service.spec.ts

apps/frontend/
├── __tests__/
│   ├── dashboard-api.test.ts
│   ├── dashboard-screen.test.tsx
│   ├── dashboard-formatters.test.ts
│   └── screen-refresh.test.tsx
├── e2e/
│   └── dashboard.spec.ts
└── src/
    ├── app/(app)/index.tsx
    ├── design-system/components/screen.tsx
    └── features/dashboard/
        ├── api.ts
        ├── queries.ts
        ├── formatters.ts
        ├── dashboard-screen.tsx
        └── components/
            ├── DashboardStatus.tsx
            ├── ProfileSummaryCard.tsx
            ├── ProgressionCard.tsx
            ├── RecentActivityCard.tsx
            └── RecentActivityItem.tsx

docs/
├── api/openapi.yaml
└── validation/2026-09-15-m4-dashboard.md
```

Os nomes podem acompanhar o padrão encontrado durante a implementação, mas as
fronteiras permanecem: rota fina em `src/app`, transporte/cache em
`features/dashboard`, apresentação dentro da feature, primitiva genérica em
`design-system` e autoridade de progressão no backend.

## 5. Contratos mínimos

### `UserProfile`

Mantém os campos atuais e adiciona `levelStartXp` e `nextLevelXp` como inteiros
obrigatórios entre zero e `9007199254740991`, com
`levelStartXp <= xpTotal < nextLevelXp` no estado consistente. `xpTotal` possui
máximo `9000000000000000`; a margem restante comporta `nextLevelXp` sem sair do
intervalo seguro do runtime.

### `RecentStudySession`

DTO somente de leitura com os oito campos da seção 3.3. `endedAt` é obrigatório
neste contrato, apesar de ser nullable na entidade geral, porque sessões ativas
foram excluídas pela consulta.

### Query keys

Tuplas readonly, namespaced por `dashboard`, sem incluir access token, session ID,
e-mail ou objeto instável. A troca de identidade já limpa o cache pela M3.

### `Screen` atualizável

`refreshing` e `onRefresh` devem ser fornecidos juntos. Em desenvolvimento, uma
combinação inválida falha cedo ou é coberta por união discriminada TypeScript.
Telas existentes sem essas props preservam exatamente o comportamento M2/M3.

## 6. Tarefas de implementação

### Tarefa 1 — Publicar a projeção de progressão

**Arquivos:** `character.entity.ts`, transformer/parser de XP,
`progression.service.ts`, `users.service.ts`, módulos envolvidos e testes
unitários/integração.

1. Criar um transformer/parser único que converte `BIGINT` para inteiro seguro
   na hidratação e valida a escrita antes de enviá-la ao driver.
2. Aplicá-lo à coluna `Character.xpTotal`, cobrindo leitura e `awardXp`.
3. Adicionar soma verificada que rejeita operandos inválidos ou total acima de
   `MAX_SUPPORTED_XP_TOTAL` antes de qualquer cálculo/persistência.
4. Trocar `levelForXp` linear por estimativa inversa com ajuste limitado e
   equivalência nos limiares arredondados existentes.
5. Criar uma projeção pública de leitura usando `xpThresholdForLevel`.
6. Injetar `ProgressionService` em `UsersService` e preservar o contrato atual.
7. Adicionar `levelStartXp` e `nextLevelXp` à resposta de `GET /users/me`.
8. Rejeitar negativo, decimal, valor hidratado acima do teto e soma que o exceda
   com erro observável, sem cast ou truncamento silencioso.
9. Cobrir nível 1, limiar exato, nível intermediário, valores grandes, fronteira
   do teto, overflow da soma e conta sem Character.
10. Em MySQL real, aplicar dois créditos positivos sequenciais e confirmar soma,
   XP total, nível e valor reidratado como `number`.

**Verificação:** Jest dos módulos `progression`/`users` e build NestJS.

### Tarefa 2 — Expor atividade recente com isolamento por usuário

**Arquivos:** migration, controller, service, DTO/mapper e testes do módulo
`sessions`.

1. Adicionar `GET /sessions/recent` antes de qualquer rota dinâmica equivalente.
2. Consultar somente sessões encerradas do usuário autenticado.
3. Ordenar por `endedAt DESC, id DESC`, limitar em cinco e selecionar apenas
   campos públicos.
4. Mapear `endedAt` como obrigatório no DTO.
5. Cobrir coleção vazia, cinco de mais de cinco, desempate, sessão ativa,
   descartada e tentativa de observar sessão de outro usuário.
6. Criar por migration o índice `(user_id, ended_at, id)`, testar aplicação e
   reversão e registrar o `EXPLAIN` que demonstra seu uso.

**Verificação:** Jest unitário e integração MySQL com dois usuários.

### Tarefa 3 — Atualizar e validar o contrato OpenAPI

**Arquivos:** `docs/api/openapi.yaml`, `package.json`, `package-lock.json`,
`AGENTS.md` e configuração/teste de contrato aplicável.

1. Fixar `@redocly/cli@2.53.2` como devDependency raiz, adicionar
   `lint:openapi` com `redocly lint --extends minimal docs/api/openapi.yaml` e
   registrar a documentação recorrente no `AGENTS.md`.
2. Adicionar os dois limiares a `UserProfile` com descrição inequívoca,
   `maximum: 9000000000000000` em `xpTotal` e
   `maximum: 9007199254740991` em `levelStartXp`/`nextLevelXp`.
3. Documentar `GET /sessions/recent` e `RecentStudySession`.
4. Declarar `200 []`, `401` Problem e formatos date-time/UUID.
5. Confirmar que nenhuma entidade interna ou refresh token aparece nos schemas.
6. Validar OpenAPI 3.1 no script/CI e conferir exemplos contra respostas reais
   do teste MySQL.

### Tarefa 4 — Criar a camada de dados do Dashboard

**Arquivos:** `features/dashboard/api.ts`, `queries.ts` e testes.

1. Definir os DTOs remotos sem importar tipos backend por caminho de workspace.
2. Usar somente o cliente autenticado da M3.
3. Encaminhar `AbortSignal` das query functions.
4. Configurar keys e `staleTime` local da feature.
5. Testar sucesso, array vazio, Problem, rede, cancelamento e `401` após refresh.
6. Confirmar que nenhuma credencial entra em key, cache, erro ou log.

### Tarefa 5 — Tornar `Screen` atualizável sem regressão

**Arquivos:** `design-system/components/screen.tsx` e testes estruturais.

1. Adicionar contrato discriminado para refresh opcional.
2. Criar `RefreshControl` somente quando a tela for rolável e as props existirem.
3. Manter o indicador controlado durante toda a Promise coordenada pela tela.
4. Usar cores semânticas existentes e preservar safe areas/bottom navigation.
5. Cobrir tela sem refresh, refresh nativo, callback único e combinação inválida.

### Tarefa 6 — Implementar o Dashboard e seus estados

**Arquivos:** `features/dashboard/*`, `src/app/(app)/index.tsx` e testes RNTL.

1. Substituir o placeholder por uma rota fina que renderiza `DashboardScreen`.
2. Executar perfil e atividade em paralelo.
3. Implementar a matriz completa da seção 3.5.
4. Coordenar refresh das duas queries sem apagar cache anterior.
5. Renderizar cards, progressbar e no máximo cinco atividades reais.
6. Formatar XP, data e duração sem dependência nova.
7. Manter sessão/auth fora dos componentes de apresentação.

### Tarefa 7 — Fechar layout adaptativo e acessibilidade

**Arquivos:** componentes da feature e testes de layout/acessibilidade.

1. Consultar e comparar a implementação com o Dashboard de
   `docs/Wise Warrior _standalone_.html`, registrando no gate as adaptações
   necessárias para Web e celular.
2. Aplicar duas colunas apenas na Web larga pelo helper M2.
3. Preservar ordem semântica na composição empilhada.
4. Garantir foco visível e target de 44×44 na ação de atualização/retry.
5. Nomear a progressbar e anunciar carregamento/refresh/erro de forma não
   duplicada.
6. Testar nomes longos, título ausente, matéria longa, fonte ampliada e largura
   de 320/390 px.
7. Validar contraste e não usar apenas cor para XP ou descarte.

### Tarefa 8 — Cobrir integração real e E2E Web

**Arquivos:** testes HTTP/MySQL, `e2e/dashboard.spec.ts`, scripts e CI.

1. Registrar uma conta real e confirmar nível 1/0 XP no Dashboard.
2. Confirmar estado vazio somente após `200 []`.
3. Criar e concluir uma sessão pela API real; atualizar e observar a atividade.
4. Confirmar que outra conta não recebe esse item.
5. Simular indisponibilidade do endpoint de atividade sem apagar o perfil.
6. Simular expiração do access token e confirmar refresh único da M3.
7. Reexecutar o E2E de autenticação para detectar regressão.
8. Não versionar traces, vídeos, screenshots ou relatórios de falha.

### Tarefa 9 — Criar o gate M4 e registrar QA universal

**Arquivos:** scripts `package.json`, CI e
`docs/validation/2026-09-15-m4-dashboard.md`.

1. Criar `verify:m3:quality` como baseline explícita do que hoje está disperso:
   build/lint/Jest/migrations/auth integration do backend e `verify:m2` do
   frontend. O job E2E existente continua cobrindo o fluxo real de auth.
2. Criar `verify:m4:quality` compondo a baseline M3, `lint:openapi`, toda a suíte
   de integração backend e os testes/build/export frontend da M4.
3. Criar `verify:m4` adicionando o E2E Web real à quality gate, sem incluir QA
   nativo manual no comando de CI.
4. Alterar `.github/workflows/ci.yml` para observar `develop` e `main`, executar
   lint OpenAPI, integração M4, quality gate frontend e os E2Es de auth e
   Dashboard. Hoje o workflow observa somente `main`, embora `develop` seja o
   branch ativo de integração.
5. Registrar versões resolvidas, comandos, dois créditos XP sequenciais,
   resultado MySQL/E2E e `EXPLAIN` do novo índice.
6. Validar Web larga/estreita, iOS e Android com API real.
7. Cobrir pull-to-refresh, retorno de background, rotação, safe areas, Dynamic
   Type/fonte ampliada, teclado Web, VoiceOver e TalkBack.
8. Separar claramente evidência automatizada de inspeção humana.

## 7. Estratégia de testes

### 7.1 Backend unitário

- projeção de progressão em nível 1 e níveis superiores;
- limites calculados exclusivamente pela política de domínio;
- normalização segura de `BIGINT`;
- soma verificada no teto e rejeição antes de excedê-lo;
- `levelForXp` mantém os limiares arredondados e custo limitado para XP alto;
- mapper de atividade sem campos internos;
- limite, ordenação, exclusão de ativa e isolamento por usuário.

### 7.2 Backend/MySQL real

- `GET /users/me` devolve números e limiares coerentes;
- dois créditos XP positivos sequenciais somam aritmeticamente após reidratação
  e atualizam o nível correto;
- crédito que ultrapassaria `MAX_SUPPORTED_XP_TOTAL` falha sem alterar o banco;
- `GET /sessions/recent` devolve somente as cinco encerradas mais recentes;
- sessão descartada aparece com zero XP e motivo;
- sessão de outro usuário nunca aparece;
- resposta vazia é `200 []`;
- migration do índice aplica/reverte e o plano da consulta utiliza o índice
  esperado.

### 7.3 Frontend unitário

- parsing/tipagem dos dois contratos;
- query keys e `staleTime`;
- `AbortSignal` chega ao Axios;
- formatação pt-BR de XP, data e duração;
- progresso nos limites inicial, intermediário e final;
- refresh coordenado e preservação do cache.

### 7.4 Componentes

- loading inicial e erro bloqueante de perfil;
- loading, vazio e erro isolado de atividade;
- conteúdo anterior durante refetch e aviso após falha;
- retry não duplica requisições;
- nome e título opcional;
- progressbar consultável por role/nome/valor;
- atividades concluída e descartada;
- Web ampla versus composição empilhada;
- anúncios acessíveis e alvos de toque.

### 7.5 E2E Web

- cadastro real termina no Dashboard com nome, nível e XP reais;
- reload/restauração continuam funcionando;
- conta nova vê vazio honesto;
- atividade criada pela API aparece após atualização;
- falha parcial não remove perfil nem simula vazio;
- logout limpa o Dashboard e protege `/`;
- nenhum dado de uma conta reaparece após entrar com outra.

### 7.6 QA manual nativo

| Plataforma | Cenários mínimos |
| --- | --- |
| iOS | carregamento, vazio, pull-to-refresh, background/foreground, fonte ampliada, VoiceOver, safe areas e erro de rede |
| Android | mesmos fluxos, TalkBack, gesto/três botões, recorte, indicador RefreshControl e retorno do background |

O teste usa conta nova e conta com sessões reais. Capturas podem apoiar inspeção,
mas não substituem leitor de tela, toque, background ou conexão com a API.

## 8. Gate de aceite

Executar a partir da raiz com MySQL descartável e variáveis não sensíveis:

```bash
npm ci
npm run lint:openapi

npm run build --workspace apps/backend
npm run lint --workspace apps/backend
npm test --workspace apps/backend
npm run test:integration --workspace apps/backend

npm run typecheck --workspace apps/frontend
npm run lint --workspace apps/frontend
npm test --workspace apps/frontend
npm run expo:check --workspace apps/frontend
npm run expo:doctor --workspace apps/frontend
npm run export:bundles --workspace apps/frontend
npm run build --workspace apps/frontend
npm run test:delivery --workspace apps/frontend
npm run test:e2e --workspace apps/frontend

npm run ios --workspace apps/frontend
npm run android --workspace apps/frontend
```

Os atalhos versionados devem produzir o mesmo conjunto automatizado:

```bash
npm run verify:m3:quality
npm run verify:m4:quality
npm run verify:m4
```

Critérios de conclusão:

- `/` não contém placeholder nem dados fictícios;
- perfil, progressão, XP e atividade vêm do backend real;
- `BIGINT` é normalizado antes de qualquer leitura ou aritmética de XP, e dois
  créditos sequenciais preservam a soma correta no MySQL;
- soma acima do teto técnico é rejeitada antes do cálculo/persistência e
  `levelForXp` não percorre níveis linearmente;
- limiares de XP são calculados pela política backend e documentados no OpenAPI;
- atividade recente é limitada a cinco, determinística e isolada por usuário;
- loading, vazio, erro total, erro parcial, stale e refresh são distinguíveis;
- falha transitória não provoca logout falso nem apaga cache válido;
- Web larga usa duas colunas e celular/Web estreita usam composição empilhada;
- identidade, hierarquia e acabamento visual foram comparados com
  `docs/Wise Warrior _standalone_.html`, com adaptações universais registradas;
- refresh explícito funciona na Web e pull-to-refresh funciona em iOS/Android;
- retorno ao app atualiza queries stale;
- progressbar, feedback e ações são acessíveis;
- logout/troca de conta não vaza cache do usuário anterior;
- OpenAPI 3.1, testes MySQL e E2E Web passam;
- gates M1/M2 continuam verdes e a baseline M3 agora explícita continua verde;
- a CI executa a M4 em PRs/pushes para o branch de integração `develop` e para
  `main`;
- QA manual registra resultado real nas três plataformas;
- nenhuma dependência nova de runtime, credencial ou artefato temporário entra
  no diff; a única adição de tooling é o Redocly CLI fixado.

Exportar bundles não comprova pull-to-refresh, background, leitor de tela,
isolamento MySQL ou comportamento de erro. A milestone só é concluída após as
verificações automatizadas e o gate manual universal aplicável.

## 9. Sequência planejada de commits

1. `feat(api): expose dashboard progression projection`
2. `feat(api): expose recent study activity`
3. `test(api): cover dashboard contracts with mysql`
4. `feat(frontend): add dashboard data queries and refresh`
5. `feat(frontend): render responsive accessible dashboard`
6. `test(frontend): cover dashboard states and web e2e`
7. `docs(frontend): record M4 universal dashboard gate`

Cada commit passa por build, lint e testes pertinentes. O commit de documentação
só declara conclusão depois que as evidências automatizadas e manuais existirem.

## 10. Tickets propostos

Os tickets não foram publicados durante a elaboração deste plano. Ao abrir a
milestone no GitHub, usar estes recortes:

1. **Publicar a projeção de progressão do Dashboard** — sem bloqueadores;
   backend, OpenAPI e testes unitários.
2. **Expor atividade recente com isolamento por usuário** — sem bloqueadores;
   endpoint, mapper e integração MySQL.
3. **Consumir os dados reais do Dashboard universal** — bloqueado por 1 e 2;
   queries, cancelamento, cache e estados.
4. **Construir o Dashboard adaptativo e acessível** — bloqueado por 3; Web larga,
   celular, progressão e atividade.
5. **Automatizar o gate do Dashboard** — bloqueado por 1–4; integração, E2E e
   regressão M3.
6. **Validar o Dashboard em Web, iOS e Android** — bloqueado por 5; QA humano e
   evidências.

Aplicar `m4`, `enhancement` e `ready-for-agent` nos tickets 1–5. O ticket 6 usa
`ready-for-human`, pois exige dispositivos/simuladores, VoiceOver e TalkBack.
Se `m4` ainda não existir, criá-la como label específica de milestone sem
substituir as labels canônicas de triagem.

## 11. Fora do escopo

- edição de dados pessoais, cosméticos ou título;
- histórico completo, paginação, filtros ou detalhes de Study Session (M5);
- listagem/revogação de sessões autenticadas por dispositivo e logout global
  na UI (M5);
- guilda, raid, ranking e chat (M6/P4);
- timer Pomodoro e comandos de Study Session no frontend (M7);
- Socket.IO/client realtime, `progress:xpUpdated` e fanout no frontend
  universal (M6/P1/P4);
- detecção de conectividade, cache persistido, fila offline e reconciliação (P2);
- streak, agenda, metas diárias, estatísticas agregadas ou conquistas sem
  contratos de produto;
- Companheiro/mascote (Fase 2, ADR-004);
- assinatura, checkout ou upgrade premium;
- push remoto, publicação em lojas ou tablets como gate;
- biblioteca de data, chart, skeleton, estado global ou nova instância HTTP.

## 12. Recuperação e bloqueios

- Se o transformer de `xp_total` receber string inválida, decimal, negativa ou
  acima do inteiro seguro, falhar antes de `applyXp`/`save` e registrar o erro
  sem o valor bruto; não fazer cast permissivo nem espalhar `number | string`.
- Se dois créditos positivos produzirem concatenação ou total incorreto no
  MySQL real, bloquear a feature e corrigir a fronteira de persistência; não
  normalizar apenas no DTO de leitura.
- Se a soma exceder `MAX_SUPPORTED_XP_TOTAL`, falhar antes de calcular nível ou
  gravar Character; não confiar apenas na validação individual dos operandos.
- Se o cálculo de nível fizer loop proporcional ao número do nível, substituir
  pela inversa com ajuste limitado antes do aceite; não reduzir o teto só para
  mascarar complexidade linear.
- Se nível persistido e `xpTotal` produzirem limiares incoerentes, interromper a
  apresentação e corrigir/reparar o dado na fronteira de progressão; não
  esconder inconsistência com clamp visual.
- Se atividade falhar e perfil funcionar, manter o Dashboard e isolar o erro no
  card; não bloquear toda a tela.
- Se o refetch falhar com cache anterior, preservar o conteúdo e informar que a
  atualização falhou; não converter cache stale em vazio.
- Se o refresh manual disparar requisições duplicadas, coordenar pela mesma
  query key/Promise; não criar fetch paralelo fora do TanStack Query.
- Se voltar do background não atualizar, verificar `focusManager`, `staleTime` e
  cleanup do listener existente antes de adicionar outro `AppState` listener.
- Se o gesto de refresh parar imediatamente, manter `refreshing=true` até ambas
  as queries assentarem, conforme o contrato controlado do React Native.
- Se o `EXPLAIN` não aproveitar `(user_id, ended_at, id)`, revisar consulta,
  estatísticas e migration antes do aceite; não voltar a ordenar por início só
  para aproveitar o índice antigo.
- Se uma sessão ativa aparecer na atividade, corrigir a consulta backend; não
  inferir status no componente.
- Se a UI exigir dados de guilda, streak, agenda ou conquista, tratar como nova
  decisão de produto e não preencher com fixtures permanentes.
- Se houver pressão para adicionar Socket.IO apenas para XP, preservar as query
  keys e levar a camada realtime completa para sua milestone; não abrir socket
  sem tratar renovação/reconexão/autorização.
- Se QA nativo estiver indisponível, registrar a pendência como humana e não
  declarar M4 universal concluída apenas com export Metro.

## 13. Documentação oficial consultada

Referências versionadas que materialmente orientaram este plano:

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) — matriz Expo 57,
  React Native 0.86, React 19.2 e React Native Web 0.21;
- [Expo Router — rotas protegidas](https://docs.expo.dev/router/advanced/protected/)
  — Dashboard permanece no grupo autenticado criado pela M3;
- [React Native 0.86 — RefreshControl](https://reactnative.dev/docs/0.86/refreshcontrol)
  — pull-to-refresh dentro de ScrollView e prop `refreshing` controlada;
- [React Native 0.86 — acessibilidade](https://reactnative.dev/docs/0.86/accessibility)
  — nomes acessíveis, valores e regiões vivas para feedback dinâmico;
- [TanStack Query v5 — React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)
  — `focusManager` com `AppState`, foco de tela e limite da detecção online;
- [TanStack Query v5 — query functions](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions)
  — promises rejeitadas, query keys e `AbortSignal` no contexto;
- [TanStack Query v5 — query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
  — propagação do sinal ao transporte;
- [TanStack Query v5 — defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
  — stale, refetch por foco, retry e retenção de cache;
- [Axios 1.x — interceptors](https://axios-http.com/docs/interceptors) — reuso do
  cliente autenticado e do refresh single-flight da M3;
- [NestJS 10 — controllers](https://docs.nestjs.com/controllers) e
  [validation](https://docs.nestjs.com/techniques/validation) — rota protegida,
  serialização e validação na fronteira HTTP;
- [TypeORM 0.3 — find options](https://typeorm.io/docs/working-with-entity-manager/find-options/)
  — seleção, ordenação e limite da atividade recente;
- [TypeORM 0.3 — entities e colunas](https://typeorm.io/docs/entity/entities/)
  — `BIGINT` mapeado como string e transformer de leitura/escrita;
- [Redocly CLI 2.x — instalação](https://redocly.com/docs/cli/installation) e
  [lint](https://redocly.com/docs/cli/commands/lint) — validação OpenAPI 3.1
  versionada e executável em desenvolvimento/CI;
- [React Native Testing Library 14 — queries](https://oss.callstack.com/react-native-testing-library/docs/api/queries)
  — testes por role, nome, estado busy e valor acessível.

Mudança de major em Expo, React Native, TanStack Query, Axios, NestJS ou TypeORM
exige revisar as decisões correspondentes antes da implementação. Patches
compatíveis exigem apenas reconfirmar lockfile, `expo install --check`,
`expo-doctor` e os gates existentes.
