# Plano de implementação — M3 Autenticação universal

**Data:** 05/09/2026

**Status:** Pronto para implementação

**Milestone:** M3 — Autenticação

**Depende de:** M1 — Fundação Expo universal e M2 — Design system e navegação

**Fontes de produto:**

- `docs/plans/2026-09-03-react-native-migration-prioritization-design.md`;
- `docs/plans/2026-09-03-react-native-universal-design.md`;
- `docs/plans/2026-09-03-react-native-universal-discovery.md`;
- `docs/plans/2026-09-04-react-native-m2-implementation-plan.md`;
- `docs/PRD.md`, em especial ADR-008 e ADR-009;
- `docs/api/openapi.yaml`;
- frontend removido no commit `76b6bab`, somente como referência de conteúdo e
  comportamento para login/cadastro.

## 1. Resultado esperado

Ao concluir a M3, `apps/frontend` permitirá criar conta, entrar, restaurar a
sessão e sair em Web, iOS e Android contra o backend real. A entrega inclui:

- rotas públicas `/entrar` e `/cadastro` sem o shell autenticado;
- grupo `(app)` inacessível enquanto o usuário não estiver autenticado;
- access token efêmero mantido somente em memória;
- refresh token rotativo em cookie `httpOnly` na Web;
- refresh token rotativo em `expo-secure-store` no iOS/Android;
- extensão retrocompatível do backend e do OpenAPI para o transporte nativo;
- rotação atômica no servidor e revogação da família quando um refresh já
  consumido for reutilizado;
- restauração de sessão antes de liberar a árvore de rotas;
- uma única tentativa de refresh compartilhada por requisições concorrentes e
  repetição, no máximo uma vez, da requisição protegida que recebeu `401`;
- estados distintos para credencial inválida/expirada, validação, conflito,
  indisponibilidade de rede e erro de servidor;
- ação de logout no shell Web e no menu Mais móvel;
- formulários acessíveis, adaptativos e validados com teclado real;
- testes backend, frontend e E2E Web com serviços reais.

A M3 não implementa dados de Dashboard, Perfil, Guilda ou Study Session. Após a
autenticação, essas rotas continuam exibindo as mensagens honestas de transição
da M2. O backend continua sendo a autoridade: proteção de rota no cliente é UX,
não substitui `JwtAuthGuard` nem autorização server-side.

## 2. Estado confirmado antes da mudança

### 2.1 Stack instalada em 05/09/2026

| Tecnologia | Versão confirmada | Papel na M3 |
| --- | --- | --- |
| Expo | `57.0.20` | runtime universal |
| Expo Router | `57.0.19` | grupos público/protegido e deep links |
| React Native | `0.86.3` | formulários, teclado e plataforma |
| React Native Web | `0.21.2` | formulários e cookies na Web |
| React | `19.2.3` | providers e estado de autenticação |
| TypeScript frontend | `6.0.3` | contratos e adaptadores por plataforma |
| NestJS | `10.4.22` | endpoints Web/nativos e guards |
| TypeORM | `0.3.31` | sessões persistentes existentes |
| TypeScript backend | `5.9.3` | DTOs e serviços backend |
| Jest | `29.7.x` | testes backend e frontend |
| React Native Testing Library | `14.0.1` | testes de formulário e providers |
| MySQL | `8.0` | integração real de conta e sessão |

M1 e M2 estão integradas no `main`; a última integração observada é o merge
`a8655ae`. O frontend possui tokens, fontes, primitivas acessíveis, as quatro
rotas de transição e o shell adaptativo, mas ainda não chama o backend.

O registro `docs/validation/2026-09-05-m2-universal-gate.md` ainda descreve QA
Android, teclado e tecnologias assistivas como pendentes, embora a issue #39
esteja fechada. A M3 não deve interpretar o fechamento da issue como evidência
desses itens: os formulários reais repetirão o gate de teclado, safe area,
Dynamic Type, VoiceOver e TalkBack.

### 2.2 Contrato backend observado

O backend já possui:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` e
  `POST /auth/logout` baseados em cookie de refresh;
- access token JWT de 15 minutos e refresh rotativo de 30 dias por padrão;
- hash SHA-256 do segredo de refresh na tabela `sessions`, nunca o token puro;
- limite configurável de cinco sessões ativas por usuário;
- revogação da sessão menos recentemente usada ao exceder o limite;
- `GET /users/me` e endpoints de listagem/revogação protegidos por bearer token;
- erros em `application/problem+json`.

Lacunas que bloqueiam o cliente universal:

- login/registro nunca devolvem refresh token no corpo, portanto o nativo não
  consegue persistir a credencial;
- refresh/logout só leem o cookie `ww_refresh`;
- não há testes do módulo `auth` no estado atual;
- o OpenAPI descreve somente o transporte Web;
- o default de CORS ainda aponta para o Vite removido em `localhost:5173`, e não
  para o Metro Web em `localhost:8081`;
- o registro Web não envia rótulo do dispositivo.

Além das lacunas de transporte, a rotação atual executa leitura, comparação e
`save` em operações separadas. Dois refreshes simultâneos podem validar o mesmo
segredo antes da gravação e produzir resultados inconsistentes. Como somente o
hash corrente é preservado, o servidor também não distingue um token antigo
legítimo já consumido de um segredo aleatório inválido e não consegue detectar
reutilização para revogar a família. O `single-flight` do frontend reduz
concorrência local, mas não corrige essa propriedade server-side.

### 2.3 Dependências alvo

Versões consultadas no npm em 05/09/2026:

| Pacote | Versão alvo | Instalação |
| --- | ---: | --- |
| `expo-secure-store` | `~57.0.3` | `expo install` |
| `@tanstack/react-query` | `5.102.8` | npm, compatível com React 19 |
| `axios` | `1.20.0` | npm |
| `@playwright/test` | `1.63.0` | npm, dependência de desenvolvimento |

O lockfile será a fonte exata das versões resolvidas. Antes do commit, executar
`expo install --check`, `expo-doctor` e `npm ls` sem `--force` ou
`--legacy-peer-deps`.

Não instalar biblioteca de formulário, schema runtime, estado global, cookie
client-side ou armazenamento assíncrono genérico. As regras são pequenas, o
backend já usa `class-validator`, e o refresh token Web não pode ficar acessível
ao JavaScript.

## 3. Decisões de implementação

### 3.1 Máquina de estados de autenticação e rotas

O provider expõe um estado discriminado, sem combinar booleanos contraditórios:

```text
restoring -> anonymous
          -> authenticated
          -> unavailable

anonymous -> authenticating -> authenticated
                         \----> anonymous + erro do formulário

authenticated -> refreshing -> authenticated
                           \-> anonymous     (refresh 401/credencial inválida)
                           \-> unavailable   (rede/5xx durante renovação)
```

`authenticated` mantém somente `sessionId` no estado React. O access token fica
no módulo privado de memória usado pelo cliente HTTP e não é exposto a
componentes. Nenhuma credencial entra no TanStack Query ou em logs.

O layout raiz envolve a aplicação em `QueryClientProvider` e `AuthProvider`. Até
a restauração terminar, apresenta uma tela local “Restaurando sessão”, sem
piscar `/entrar` nem o shell. Em falha transitória durante a restauração,
apresenta “Não foi possível verificar sua sessão” e uma ação `Tentar novamente`;
a credencial persistente é preservada. `401` de refresh significa sessão
anônima e remove a credencial nativa inválida.

Usar `Stack.Protected`, disponível no Expo Router instalado:

- `guard={status === 'authenticated'}` para `(app)`;
- `guard={status === 'anonymous'}` para `(public)`;
- nenhum arquivo de tela protegida é duplicado em outro grupo;
- `(public)/_layout.tsx` ancora em `entrar`;
- a mudança do guard remove o histórico inacessível;
- deep link para `/`, `/perfil`, `/guilda` ou `/sessao` sem sessão termina em
  `/entrar`;
- usuário autenticado que abre `/entrar` ou `/cadastro` retorna ao `/`;
- `+not-found` permanece neutra e não revela dados privados.

Não usar redirect imperativo durante a primeira renderização nem criar middleware
Web: o export Expo é SPA estático e a proteção oficial do Router é client-side.

### 3.2 Contratos de transporte separados, um domínio de sessão

Os endpoints Web existentes permanecem compatíveis e continuam usando cookie:

| Operação | Endpoint Web | Credencial persistente | Resposta |
| --- | --- | --- | --- |
| cadastro | `POST /auth/register` | `Set-Cookie: ww_refresh` | `accessToken`, `sessionId` |
| login | `POST /auth/login` | `Set-Cookie: ww_refresh` | `accessToken`, `sessionId` |
| refresh | `POST /auth/refresh` | cookie recebido/rotacionado | `accessToken`, `sessionId` |
| logout | `POST /auth/logout` | cookie recebido/limpo | `204` |

Adicionar endpoints explícitos para iOS/Android:

| Operação | Endpoint nativo | Requisição | Resposta |
| --- | --- | --- | --- |
| cadastro | `POST /auth/native/register` | conta + `deviceLabel` | access + refresh + session ID |
| login | `POST /auth/native/login` | credenciais + `deviceLabel` | `accessToken`, `refreshToken`, `sessionId` |
| refresh | `POST /auth/native/refresh` | `{ refreshToken }` | trio rotacionado |
| logout | `POST /auth/native/logout` | `{ refreshToken }` | `204` |

Os dois controllers chamam os mesmos métodos de `AuthService`; não duplicar
hash, rotação, expiração, limite ou revogação. A adição de `sessionId` no corpo
Web é retrocompatível e prepara a identificação da sessão atual na M5.

A separação de rotas é uma escolha de clareza contratual e auditabilidade, não
uma fronteira de identidade: torna explícito e testável que a resposta Web
jamais contém refresh legível, enquanto a resposta nativa precisa entregá-lo ao
SecureStore. Um único endpoint que inferisse cookie ou body reduziria quatro
rotas, mas concentraria respostas condicionais e aumentaria o risco de devolver
a variante errada. Um header como `X-Client-Type` não seria prova de plataforma,
pois clientes podem forjá-lo. Cookies em todas as
plataformas esbarram no suporte incompleto de cookies do React Native; tokens no
corpo para todas exporiam a credencial à aplicação Web. BFF ou OIDC com
Authorization Code + PKCE continuam alternativas futuras quando houver SSO,
provedor de identidade ou uma camada Web dedicada.

Sem adicionar pacote de identificação de hardware, o frontend envia rótulos
previsíveis e não sensíveis: `Wise Web`, `Wise iOS` ou `Wise Android`. O backend
continua registrando separadamente o `User-Agent`; nome do aparelho, hostname e
identificador persistente ficam fora da M3.

Endpoints nativos rejeitam qualquer requisição com header `Origin`, inclusive
`Origin: null`, e não devem aceitar preflight Web. Como o navegador controla
esse header, isso bloqueia o uso acidental ou direto por JavaScript Web comum.
É apenas defesa em profundidade: não autentica o aplicativo, não é atestado de
dispositivo e não impede clientes fora do navegador. Portanto, nenhuma regra de
autorização depende de `Origin`; login, posse do refresh e controles server-side
continuam sendo as provas reais. Cobrir a decisão com testes de controller,
CORS e integração.

Nunca devolver `refreshToken` pelos endpoints Web, header, erro ou log. Nunca
aceitar refresh nativo por query string. Todo transporte de credencial exige
HTTPS fora do ambiente local controlado.

### 3.3 Rotação atômica e detecção de reutilização

Tratar cada linha de `sessions` como uma família de refresh tokens. Adicionar
uma migration para `session_refresh_token_history`, contendo somente
`session_id`, `token_hash`, `consumed_at` e `retain_until`, com chave estrangeira
`ON DELETE CASCADE`, chave primária composta `(session_id, token_hash)` e índice
em `(session_id, retain_until)`. O token permanece no formato opaco atual
`sessionId.secret`; a migration não invalida sessões existentes. O hash corrente
continua em `sessions.refresh_token_hash`, enquanto hashes consumidos ficam no
histórico somente durante a janela em que poderiam ser reapresentados.

Executar cada refresh em uma transação TypeORM usando o mesmo
`transactionalEntityManager` em todas as operações e lock pessimista de escrita
na linha `sessions` (`SELECT ... FOR UPDATE` no InnoDB):

1. parsear e hashear o token antes da transação, sem logá-lo;
2. bloquear a sessão e validar revogação e expiração;
3. se o hash for o corrente, inserir o hash antigo no histórico, gerar o novo
   segredo e atualizar hash/`lastUsedAt` atomicamente; `retain_until` é a
   expiração natural do token antigo, calculada com o `lastUsedAt` anterior;
4. se o hash não for corrente, procurar no histórico da mesma sessão;
5. se estiver no histórico, marcar a sessão revogada e confirmar a transação
   antes de responder `401`; o novo token da família também deixa de valer;
6. se não estiver, responder `401` genérico sem revogar, evitando que apenas o
   conhecimento do session ID permita negação de serviço;
7. remover, por sessão e dentro de uma operação limitada, entradas cujo
   `retain_until` passou; retenção deve cobrir ao menos o TTL que restava ao
   token consumido.

Não lançar a exceção de reutilização dentro de um callback que faça rollback da
revogação. A transação retorna um resultado discriminado, confirma o estado e só
então o serviço traduz o resultado para `UnauthorizedException`. Acesso Web e
nativo usam exatamente essa mesma operação. O `single-flight` do cliente
continua necessário para UX e eficiência, mas não é controle de consistência.

Aplicar à implementação própria a propriedade de segurança descrita pelo RFC
9700 para rotação: reter a relação entre tokens para detectar replay. Como não
é possível saber qual das partes possui o token legítimo após reutilização, a
resposta segura é revogar a família ativa e exigir login.

A revogação encerra novas renovações, mas access tokens já assinados continuam
válidos até o TTL curto atual de 15 minutos porque o `JwtAuthGuard` é stateless.
Revogação imediata exigiria incluir `sessionId` no JWT e consultar estado em cada
request, ou manter denylist/cache distribuído; esse custo fica fora da M3. O
gate deve registrar explicitamente essa janela residual.

### 3.4 Armazenamento por plataforma

Criar a mesma interface em arquivos específicos de plataforma:

```text
credential-store.native.ts -> expo-secure-store
credential-store.web.ts    -> nenhum armazenamento acessível ao JavaScript
```

No nativo, usar apenas APIs assíncronas, uma chave estável namespaced e
`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, sem `requireAuthentication`. Refresh em
background de UI não pode abrir prompt biométrico, e mudança de biometria não
deve invalidar silenciosamente uma sessão. Configurar o plugin
`expo-secure-store`, incluindo a exclusão correta do Android Auto Backup.

O token é pequeno, mas toda leitura, escrita e remoção pode falhar. Regras:

- login/cadastro só mudam para `authenticated` após persistir o refresh nativo;
- se a persistência inicial falhar, revogar por melhor esforço o token recém
  emitido e permanecer anônimo;
- refresh só publica o novo access token após salvar a credencial rotacionada;
- se salvar a rotação falhar, tentar revogar o novo token, remover o valor local
  antigo e exigir novo login;
- logout confirmado pelo servidor remove o valor local mesmo se a remoção
  precisar ser repetida na próxima abertura;
- `401` de refresh remove token inválido; rede/`5xx` não remove.

O plano aceita o comportamento documentado do Keychain no iOS: um item pode
persistir após desinstalação/reinstalação com o mesmo bundle ID. Isso deve ser
registrado no QA; SecureStore não é fonte de verdade, pois expiração e revogação
continuam server-side.

### 3.5 Cliente HTTP e rotação concorrente

Criar uma instância Axios a partir de `getPublicApiUrl()`:

- `withCredentials: true` na Web para enviar/receber o cookie;
- header `Authorization: Bearer ...` somente quando há access token em memória;
- timeout de `15.000 ms` e sem dump de request/response sensível;
- cliente “bare” separado para login, cadastro e refresh, evitando recursão dos
  interceptors;
- parser seguro de `application/problem+json` que não confia em shape externo.

O interceptor de resposta trata `401` apenas em chamadas protegidas:

1. ignora endpoints `/auth/*` e requisições já repetidas;
2. compartilha uma única promise de refresh entre todos os `401` concorrentes;
3. usa cookie na Web ou SecureStore no nativo;
4. atualiza access token e session ID;
5. repete cada requisição original exatamente uma vez;
6. se o refresh responder `401`, encerra localmente a sessão e limpa queries;
7. se a rede/API estiver indisponível, preserva refresh persistente e propaga um
   erro classificado, sem loop nem logout falso.

Não aplicar retry automático genérico a mutações ou erros `5xx`. O refresh
single-flight resolve expiração; retries de dados remotos serão definidos por
feature conforme idempotência. Requisições canceladas não iniciam refresh.

### 3.6 TanStack Query sem persistência local

M3 introduz o `QueryClient` porque todas as milestones autenticadas seguintes
dependem dele e logout/expiração precisam ter uma política de descarte desde o
primeiro dado protegido. O cache continua somente em memória:

- uma instância por runtime, criada fora de re-renderizações;
- nenhuma persistência em AsyncStorage/localStorage;
- `queryClient.clear()` ao confirmar logout ou invalidar a sessão;
- conexão do `focusManager` ao `AppState` somente no nativo;
- a Web preserva os listeners padrão;
- `onlineManager` nativo fica para a etapa de resiliência que instalará uma
  fonte real de conectividade; M3 não infere offline apenas por `AppState`.

O provider de auth não guarda perfil, XP ou guilda. Esses dados pertencerão a
queries de M4–M6.

### 3.7 Formulários e conteúdo

Recriar o conteúdo aprovado do frontend removido usando somente React Native,
tokens e primitivas M2:

- login: e-mail, senha, ação “Entrar na batalha” e link para cadastro;
- cadastro: nome do guerreiro, e-mail, senha, confirmação, ação “Criar
  personagem” e link para login;
- painel narrativo amplo na Web e composição única empilhada no celular;
- nenhuma dependência de SVG/DOM/CSS legado ou WebView;
- nenhum dado de usuário fictício.

Regras locais puras e compartilhadas com testes:

- nome normalizado por `trim`, entre 2 e 60 caracteres;
- e-mail obrigatório, aparente formato válido e enviado sem espaços externos;
- senha de cadastro entre 8 e 128 caracteres;
- senha de login apenas obrigatória, para não divergir de contas futuras;
- confirmação obrigatória e idêntica, nunca enviada à API;
- senha nunca recebe `trim`, lowercase ou log.

Props mínimas dos campos:

- e-mail: `keyboardType="email-address"`, `autoCapitalize="none"`,
  `autoCorrect={false}` e `autoComplete="email"`;
- login: `autoComplete="current-password"`;
- cadastro/confirmação: `autoComplete="new-password"`;
- `returnKeyType`, refs e `onSubmitEditing` movem foco e submetem o último campo;
- `secureTextEntry` por padrão e ação acessível Mostrar/Ocultar com estado
  pressionado explícito;
- primeiro campo inválido recebe foco após tentativa de envio;
- erros ficam associados ao campo, enquanto falhas da API usam
  `FeedbackMessage` anunciável.

Durante envio, todos os campos e links de troca ficam estáveis, o CTA entra em
loading e submissões duplicadas são ignoradas. Falha preserva os valores, exceto
quando uma política futura exigir limpeza de senha.

### 3.8 Logout no shell

Estender o shell com um contrato opcional de ação de conta, sem fazer o design
system importar `AuthProvider`:

- Web: ação “Sair” no rodapé da sidebar;
- celular: ação “Sair” no menu Mais, depois dos itens “Em breve”;
- loading impede acionamento duplicado;
- falha de rede/`5xx` mantém a sessão ativa e exibe erro com retry;
- `204` ou `401` confirmado limpa access token, credencial nativa, cache e fecha
  o menu;
- o guard conduz a `/entrar` e remove telas privadas do histórico.

Não fingir logout Web quando o backend está indisponível: JavaScript não pode
remover o cookie `httpOnly`, e um reload restauraria a sessão. A M3 mantém o
usuário autenticado e informa a falha até obter resposta terminal do servidor.

### 3.9 Taxonomia de erros

O core traduz transporte para categorias estáveis, e a UI decide o texto:

| Categoria | Evidência | Comportamento |
| --- | --- | --- |
| validação | `400`/erros locais | associar aos campos ou orientar revisão |
| credenciais | `401` em login | “E-mail ou senha incorretos” |
| conflito | `409` em cadastro | “Este e-mail já está cadastrado” |
| sessão inválida | `401` em refresh | limpar credencial e ir para login |
| rede | sem resposta/timeout | preservar credencial e oferecer retry |
| servidor | `5xx` | preservar credencial e oferecer retry |
| inesperado | shape/status desconhecido | mensagem genérica sem detalhe sensível |

Não exibir diretamente `detail` do backend em autenticação. Ele pode orientar o
classificador e os testes, mas a mensagem pública é controlada pelo frontend.

### 3.10 CORS, cookies e desenvolvimento local

Alterar o default de desenvolvimento para `http://localhost:8081` e aceitar em
`CORS_ORIGIN` uma allowlist explícita separada por vírgulas. Com
`credentials: true`, wildcard é proibido. Normalizar e testar a lista sem
refletir origens arbitrárias.

A política deve considerar também o path da request: para
`/auth/native/*`, qualquer presença de `Origin` é negada e a preflight não recebe
permissão; para o contrato Web, apenas origens da allowlist recebem credenciais.
Ausência de `Origin` permite o transporte nativo, mas não concede autorização
especial nem identifica o aplicativo.

Preservar no cookie Web:

- `httpOnly: true`;
- `secure: true` em produção;
- `sameSite: 'lax'`;
- `path: '/api/v1/auth'`;
- `maxAge` alinhado a `JWT_REFRESH_TTL_DAYS`.

Produção deve servir frontend e API no mesmo site registrável para preservar
`SameSite=Lax`, mesmo que use subdomínios distintos. Uma topologia realmente
cross-site exige nova decisão de cookie/CSRF; não trocar silenciosamente para
`SameSite=None`.

Nenhum refresh/access token entra em `localStorage` ou `sessionStorage`. Access
token permanece no header bearer para endpoints de produto, reduzindo uso do
cookie a refresh/logout.

Documentar endereços de API por alvo:

- Web e iOS Simulator podem usar host local conforme a rede da máquina;
- Android Emulator normalmente usa o alias do host, não `localhost` do aparelho;
- aparelho físico exige hostname/IP alcançável na LAN ou endpoint HTTPS;
- o gate de release usa HTTPS;
- não habilitar cleartext global em builds de produção.

Ao instalar `expo-secure-store`, rebuild nativo é obrigatório. Se HTTP local for
bloqueado por ATS/Network Security, usar configuração restrita a build de debug
ou endpoint HTTPS; não versionar `NSAllowsArbitraryLoads` nem
`usesCleartextTraffic=true` para release como atalho.

## 4. Estrutura alvo ao concluir M3

```text
apps/backend/src/
├── config/
│   └── cors.config.ts
├── migrations/
│   └── <timestamp>-add-session-refresh-token-history.ts
└── modules/auth/
    ├── auth.controller.ts
    ├── native-auth.controller.ts
    ├── auth.service.ts
    ├── dto/
    │   ├── login.dto.ts
    │   ├── native-refresh.dto.ts
    │   └── register.dto.ts
    ├── entities/
    │   └── session-refresh-token-history.entity.ts
    └── guards/
        └── reject-browser-origin.guard.ts

apps/frontend/
├── e2e/
│   └── auth.spec.ts
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── _layout.tsx
│   │   │   ├── cadastro.tsx
│   │   │   └── entrar.tsx
│   │   ├── (app)/
│   │   │   └── _layout.tsx
│   │   └── _layout.tsx
│   ├── core/
│   │   ├── api/
│   │   │   ├── api-client.ts
│   │   │   ├── api-error.ts
│   │   │   └── token-memory.ts
│   │   ├── auth/
│   │   │   ├── auth-context.tsx
│   │   │   ├── auth-service.ts
│   │   │   ├── credential-store.native.ts
│   │   │   ├── credential-store.web.ts
│   │   │   └── types.ts
│   │   └── query/
│   │       └── query-runtime.tsx
│   └── features/auth/
│       ├── components/
│       │   ├── AuthPasswordField.tsx
│       │   └── AuthShell.tsx
│       ├── login-form.tsx
│       ├── register-form.tsx
│       └── validation.ts
├── playwright.config.ts
└── package.json

docs/
├── api/openapi.yaml
└── validation/2026-09-05-m3-authentication.md
```

Nomes podem ser ajustados para o padrão encontrado durante a implementação, mas
as fronteiras permanecem: transporte em `core/api`, credencial em `core/auth`,
UI em `features/auth` e rotas finas em `src/app`.

## 5. Contratos mínimos

### `AuthState`

União discriminada com `restoring`, `anonymous`, `authenticated` e
`unavailable`. Somente `authenticated` carrega o session ID; o access token fica
no módulo privado de memória. `unavailable` carrega erro seguro e callback de
retry, nunca segredo.

### `CredentialStore`

`read`, `write` e `remove` assíncronos. A implementação Web nunca aceita valor e
deixa o cookie exclusivamente sob controle do browser/backend. A implementação
nativa encapsula todos os detalhes de SecureStore.

### Rotação backend

Uma única função de domínio recebe o token opaco independentemente do
controller. Internamente, retorna um resultado discriminado (`rotated`,
`invalid`, `expired`, `revoked` ou `reused`) para que a transação possa confirmar
uma revogação por reutilização antes de o controller receber um `401`. Nenhum
controller acessa repositórios ou implementa rotação por conta própria.

### `AuthService` frontend

Expõe `restore`, `login`, `register`, `refresh` e `logout`. Escolhe endpoints por
`Platform.OS`, coordena persistência antes de publicar sessão e não conhece
Router nem componentes.

### `AuthProvider`

Serializa transições, impede ações concorrentes e informa mudanças de sessão ao
cliente HTTP. Limpa QueryClient apenas em término confirmado/invalidação. Não
armazena perfil remoto.

### `ApiError`

Erro discriminado por categoria, status opcional e flag `retryable`. Não inclui
senha, refresh token, Authorization ou request body.

### Ação de conta do `AppShell`

Contrato visual opcional com label, callback, loading e erro seguro. Sidebar e
menu móvel apresentam o mesmo resultado sem importar regras de autenticação.

## 6. Tarefas de implementação

### Tarefa 1 — Fixar dependências e configuração nativa

**Arquivos:**

- `apps/frontend/package.json`;
- `apps/frontend/app.json`;
- `package-lock.json`;
- `AGENTS.md`.

1. Instalar `expo-secure-store` com `expo install`.
2. Instalar versões alvo de Axios, TanStack Query e Playwright.
3. Configurar o plugin SecureStore e a política de backup Android.
4. Adicionar documentação oficial recorrente das novas tecnologias ao
   `AGENTS.md`.
5. Confirmar que Web exporta sem tentar resolver o módulo nativo em runtime.

**Verificação:** `expo install --check`, `expo config --type public`,
`expo-doctor`, `npm ls` e exportação Web/iOS/Android.

### Tarefa 2 — Tornar a rotação server-side atômica

**Arquivos:** migration, entidades, módulo, `auth.service.ts` e testes unitários
em `apps/backend/src/modules/auth`.

1. Criar `session_refresh_token_history` sem armazenar segredo puro.
2. Executar refresh em transação e adquirir lock pessimista na sessão.
3. Mover o hash consumido para o histórico antes de publicar o sucessor.
4. Detectar hash consumido, revogar a família e confirmar antes do `401`.
5. Não revogar em segredo aleatório que apenas contenha um session ID válido.
6. Remover histórico após `retain_until` sem encurtar a janela de detecção.
7. Aplicar migration do zero e sobre schema M2 com sessões preexistentes.

**Verificação:** testes do resultado discriminado, testes de migration e teste
MySQL com duas conexões apresentando o mesmo refresh simultaneamente.

### Tarefa 3 — Estender o contrato de autenticação nativa

**Arquivos:** controllers, DTOs, guard e módulo `apps/backend/src/modules/auth`.

1. Acrescentar `sessionId` às respostas Web.
2. Permitir `deviceLabel` opcional também no cadastro.
3. Criar os quatro endpoints `/auth/native/*`.
4. Reutilizar integralmente `AuthService` para emissão, rotação e revogação.
5. Rejeitar `Origin` nos endpoints nativos como defesa em profundidade, antes de
   processar credenciais, sem tratá-lo como prova de cliente nativo.
6. Garantir que filtros/logs nunca serializem tokens.

**Verificação:** testes unitários de controller/service e build NestJS.

### Tarefa 4 — Corrigir CORS e atualizar o OpenAPI

**Arquivos:**

- `apps/backend/src/main.ts`;
- `apps/backend/src/config/cors.config.ts`;
- `apps/backend/.env.example`;
- `docs/api/openapi.yaml`;
- testes de configuração/contrato.

Documentar schemas Web/nativo, request de refresh nativo, `sessionId`,
`deviceLabel`, cookies e respostas de erro. Testar allowlist CORS, default 8081,
wildcard inválido com credenciais, atributos do cookie e que preflight/requests
Web não obtêm uma resposta de sucesso dos endpoints nativos.

**Verificação:** OpenAPI 3.1 válido, testes Jest e uma preflight real da origem
permitida e de uma origem negada.

### Tarefa 5 — Cobrir autenticação backend com MySQL real

**Arquivos:** teste de integração auth e scripts/CI relacionados.

Casos mínimos:

1. cadastro Web cria User, Character e Session e não expõe refresh no JSON;
2. login Web define cookie com atributos esperados;
3. refresh Web rotaciona e invalida o token anterior;
4. dois refreshes realmente concorrentes não emitem dois sucessores válidos;
5. reutilização do token consumido revoga a sessão e o sucessor recém-emitido;
6. segredo aleatório com session ID existente falha sem revogar a sessão;
7. logout Web revoga e limpa cookie;
8. fluxo nativo devolve token apenas no endpoint nativo;
9. endpoint nativo rejeita `Origin` antes de criar/rotacionar sessão;
10. sexto login revoga a sessão mais antiga;
11. token expirado/revogado responde `401` no formato Problem;
12. senha, refresh e segredos puros não aparecem no banco ou saída do teste.

O teste usa migrations versionadas e schema descartável; não usar
`synchronize: true`.

### Tarefa 6 — Implementar armazenamento e memória de tokens

**Arquivos:** `src/core/auth/credential-store.*`, `src/core/api/token-memory.ts`
e testes.

Testar ausência de armazenamento Web, opções do SecureStore, valores ausentes,
falhas de leitura/escrita/remoção e limpeza. O módulo de memória deve permitir
leitura/escrita interna para interceptor e zerar valores nos términos definidos.

### Tarefa 7 — Implementar cliente HTTP e refresh single-flight

**Arquivos:** `src/core/api/*`, `src/core/auth/auth-service.ts` e testes.

Testar headers, `withCredentials`, seleção de endpoint, parsing de Problem,
concorrência de vários `401`, repetição única, exclusão de endpoints auth,
refresh inválido, indisponibilidade e falha de SecureStore após rotação.

### Tarefa 8 — Integrar QueryClient e AuthProvider

**Arquivos:** `src/core/query/query-runtime.tsx`,
`src/core/auth/auth-context.tsx`, `src/app/_layout.tsx` e testes.

Cobrir todos os estados da seção 3.1, cleanup de AppState/focusManager, cache
limpo em logout/invalidação e cache preservado em indisponibilidade transitória.
O provider deve ignorar resultado assíncrono após unmount e não produzir update
de estado tardio.

### Tarefa 9 — Criar shell e rotas públicas

**Arquivos:** `src/app/(public)/*`, `src/features/auth/components/AuthShell.tsx`
e testes.

Construir composição responsiva com os tokens existentes. Validar Web larga,
390 px, iPhone pequeno e Android pequeno, sem conteúdo coberto pelo teclado ou
safe areas. Links usam Expo Router e preservam URLs `/entrar` e `/cadastro`.

### Tarefa 10 — Implementar login universal

**Arquivos:** formulário, rota, validação e testes de login.

Cobrir campos, autofill, toggle de senha, foco, submit pelo teclado, validação
local, credenciais inválidas, erro transitório, loading, bloqueio de duplo clique
e sucesso Web/nativo.

### Tarefa 11 — Implementar cadastro universal

**Arquivos:** formulário, rota, validação e testes de cadastro.

Cobrir limites 2–60/8–128, confirmação não enviada, e-mail conflitante,
validação backend, falha de persistência segura, loading e sucesso Web/nativo.

### Tarefa 12 — Proteger rotas e integrar logout

**Arquivos:** layouts raiz/público/app, AppShell/AppNavigation/sidebar/menu Mais
e testes.

Aplicar `Stack.Protected`, injetar ação de conta no shell e cobrir deep links,
histórico, logout bem-sucedido, logout indisponível, foco restaurado do menu e
itens futuros ainda não interativos.

### Tarefa 13 — Criar E2E Web e gate M3

**Arquivos:**

- `apps/frontend/playwright.config.ts`;
- `apps/frontend/e2e/auth.spec.ts`;
- composição/script isolado de E2E;
- `apps/frontend/test-delivery.sh`;
- `apps/frontend/package.json`;
- `package.json`;
- `.github/workflows/ci.yml`.

Executar Chromium com um worker na CI e banco/serviços descartáveis. O fluxo E2E
registra uma conta única, valida reload/restauração por cookie, logout, login,
nega rota protegida anônima e confirma que `document.cookie`, localStorage e
sessionStorage não expõem tokens. Acrescentar `/entrar` e `/cadastro` ao smoke
SPA do nginx.

Não versionar `storageState`, cookies, relatórios, traces, vídeos ou screenshots.
Artefatos de falha da CI podem ter retenção curta e devem ser tratados como
sensíveis.

### Tarefa 14 — Documentar operação e executar QA universal

**Arquivos:**

- `README.md`;
- `.env.example`/exemplos aplicáveis;
- `docs/validation/2026-09-05-m3-authentication.md`.

Corrigir referências ao Vite/5173, explicar URLs por simulador/emulador/aparelho,
rebuild após SecureStore, execução do E2E e limites de segurança. Registrar
comandos, ambientes, evidências e pendências reais por plataforma.

## 7. Estratégia de testes

### 7.1 Unitários backend

- emissão, rotação, expiração, revogação e limite de sessões;
- resultado discriminado da rotação e commit da revogação antes do `401`;
- hash corrente vai ao histórico e segredo aleatório não causa revogação;
- controllers Web nunca retornam refresh token;
- controller nativo retorna o trio somente sem `Origin`, entendido apenas como
  defesa em profundidade;
- DTOs rejeitam payload extra, token ausente e limites inválidos;
- parser da allowlist CORS.

### 7.2 Integração backend/MySQL

- fluxos completos da Tarefa 5;
- migrations aplicadas do zero;
- duas conexões MySQL disputam o mesmo token: nunca há dois sucessores válidos;
- reapresentar hash consumido confirma revogação da família, enquanto um hash
  desconhecido não permite negação de serviço;
- cookie e JSON inspecionados sem mockar controller/service/repository.

### 7.3 Unitários frontend

- validação e normalização dos formulários;
- classificação de Problem/rede/status;
- adapters Web/nativo;
- token em memória;
- refresh single-flight e replay único;
- transições do provider e limpeza do cache;
- integração AppState/focusManager.

### 7.4 Componentes e rotas

- campos, autofill, foco, teclado e toggle de senha;
- erros associados/anunciados e loading sem submissão duplicada;
- troca entrar/cadastro;
- guards nos quatro destinos e nas duas rotas públicas;
- restauração sem flash de conteúdo incorreto;
- indisponibilidade com retry;
- logout na sidebar e no menu móvel;
- navegação M2 permanece íntegra.

### 7.5 E2E Web

- cadastro real e entrada no shell;
- cookie refresh `httpOnly`, path e SameSite esperados;
- reload restaura a sessão sem armazenamento Web de token;
- logout impede restauração;
- login posterior funciona;
- acesso anônimo direto a rota protegida vai para `/entrar`;
- credenciais inválidas e API indisponível não simulam sucesso.

### 7.6 QA manual nativo

| Plataforma | Cenários mínimos |
| --- | --- |
| iOS | cadastro, kill/relaunch, restauração, login/logout, teclado, Dynamic Type, VoiceOver, SecureStore e deep links |
| Android | os mesmos fluxos, teclado/Back, fonte ampliada, TalkBack, gestos/três botões, SecureStore e deep links |

Executar ao menos em aparelho pequeno e aparelho com recorte/insets. Em ambos,
testar rotação do refresh com TTL de access reduzido em ambiente de QA, falha de
rede durante restauração e recuperação sem perder credencial.

## 8. Gate de aceite

Executar a partir da raiz, com variáveis não sensíveis de teste e MySQL
descartável quando indicado:

```bash
npm ci
npm run build --workspace apps/backend
npm run lint --workspace apps/backend
npm test --workspace apps/backend
npm run migration:test --workspace apps/backend
npm run test:auth:integration --workspace apps/backend

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

Critérios de conclusão:

- cadastro, login, restauração e logout usam backend real nas três plataformas;
- Web nunca recebe refresh token legível por JavaScript;
- nativo nunca depende de cookie e persiste refresh somente em SecureStore;
- access token não sobrevive a restart/reload e não entra em storage persistente;
- o frontend evita refreshes duplicados no mesmo runtime com `single-flight`;
- o backend serializa rotações: nunca mantém dois sucessores válidos e a
  reutilização confirmada revoga toda a família;
- um segredo aleatório com session ID válido não revoga a sessão;
- `401` terminal encerra a sessão; rede/`5xx` preserva a credencial e permite
  retry;
- rotas públicas e protegidas respeitam guards e deep links;
- formulários passam teclado, foco, leitor de tela, touch target e fonte ampliada;
- logout existe e se comporta igual no shell Web e móvel;
- OpenAPI descreve os dois transportes e continua válido;
- testes MySQL e E2E Web passam em CI com recursos descartáveis;
- gates M1/M2 e as quatro rotas de transição continuam aprovados;
- `ios/`, `android/`, `.expo/`, `dist/`, credenciais, relatórios e screenshots
  temporários não aparecem no diff.

Export Metro não comprova SecureStore, teclado, cookie ou execução nativa. A M3
não pode ser concluída sem build/abertura e fluxo real em iOS e Android.

## 9. Sequência planejada de commits

1. `feat(auth): make refresh rotation atomic and detect reuse`
2. `feat(auth): add native refresh transport to backend`
3. `test(auth): cover web and native session contracts`
4. `feat(frontend): add universal auth runtime and secure storage`
5. `feat(frontend): add accessible login and registration flows`
6. `feat(frontend): protect routes and add logout action`
7. `test(frontend): add M3 auth integration and web e2e`
8. `docs(frontend): record M3 universal authentication gate`

Cada commit passa por typecheck, lint e testes pertinentes. O commit de docs só
declara conclusão após os gates automatizados e a matriz manual executada.

## 10. Tickets publicados

1. [#43 — Proteger a rotação de refresh contra concorrência e reutilização](https://github.com/MatheusSales2773/wise-warrior/issues/43)
   — sem bloqueadores; migration, lock transacional, histórico, replay e testes
   concorrentes MySQL.
2. [#44 — Publicar o contrato universal de autenticação](https://github.com/MatheusSales2773/wise-warrior/issues/44)
   — bloqueada por #43; transportes Web/nativo, CORS e OpenAPI.
3. [#45 — Entrar e restaurar uma Session na Web](https://github.com/MatheusSales2773/wise-warrior/issues/45)
   — bloqueada por #44; login Web, cookie protegido, restauração e rotas.
4. [#46 — Entrar e restaurar uma Session no iOS e Android](https://github.com/MatheusSales2773/wise-warrior/issues/46)
   — bloqueada por #44 e #45; transporte nativo, SecureStore e restauração.
5. [#47 — Criar uma conta na Web, iOS e Android](https://github.com/MatheusSales2773/wise-warrior/issues/47)
   — bloqueada por #45 e #46; cadastro universal completo.
6. [#48 — Renovar a Session e recuperar falhas de autenticação](https://github.com/MatheusSales2773/wise-warrior/issues/48)
   — bloqueada por #45 e #46; single-flight, repetição única e resiliência.
7. [#49 — Encerrar a Session atual em todas as plataformas](https://github.com/MatheusSales2773/wise-warrior/issues/49)
   — bloqueada por #45 e #46; logout real no shell Web e móvel.
8. [#50 — Automatizar o gate de autenticação universal](https://github.com/MatheusSales2773/wise-warrior/issues/50)
   — bloqueada por #47, #48 e #49; MySQL, Playwright, smoke e CI da M3.
9. [#51 — Validar autenticação universal e registrar evidências](https://github.com/MatheusSales2773/wise-warrior/issues/51)
   — bloqueada por #50; QA real Web/iOS/Android e documentação final.

As issues #43–#50 usam `m3`, `enhancement` e `ready-for-agent`. A issue #51 usa
`ready-for-human` porque exige interação real com iOS, Android, VoiceOver e
TalkBack. As issues amplas #23 e #24 permanecem inalteradas; o gate #50 cobre
somente autenticação M3 e não assume o escopo futuro de domínio e Socket.IO.

## 11. Fora do escopo

- recuperação/redefinição de senha e verificação de e-mail, sem contrato atual;
- provedores OAuth, passkeys, biometria obrigatória ou login social;
- BFF dedicado, OIDC/Authorization Code + PKCE, DPoP, app attestation e tokens
  vinculados a chave/dispositivo;
- “lembrar-me”, localStorage, sessionStorage ou persistência do access token;
- gestão/listagem/revogação de dispositivos na UI (M5);
- logout global na UI (M5), embora o endpoint já exista;
- invalidação imediata de access JWT já emitido; a janela residual é seu TTL de
  15 minutos;
- perfil, XP, progressão e atividade reais (M4/M5);
- Guilda, Raid, chat, ranking ou Socket.IO (M6/P4);
- Study Session, timer, offline e reconciliação (M7/P0–P3);
- persistência do cache TanStack Query;
- retry genérico de mutações;
- rate limiting/CAPTCHA e reforços abrangentes da issue #13;
- publicação em lojas ou distribuição pública;
- habilitação global de HTTP cleartext em builds de release.

## 12. Recuperação e bloqueios

- Se `expo-secure-store` divergir da versão indicada pelo SDK 57, seguir
  `expo install --fix` somente após revisar o diff; nunca forçar peer dependency.
- Se SecureStore exigir mudança nativa, rebuildar o development build; reload do
  Metro não instala módulo nativo.
- Se gravação do refresh rotacionado falhar, não conservar o novo access token:
  revogar por melhor esforço, limpar localmente e pedir novo login.
- Se dois `401` causarem dois refreshes, interromper a feature e corrigir o
  single-flight; não ampliar tolerância do backend como compensação.
- Se o teste com duas conexões produzir dois sucessores, revisar se todas as
  consultas usam o manager transacional e se a sessão foi lida com lock; não
  mascarar a corrida com retry.
- Se for detectada reutilização, confirmar a revogação antes de retornar `401`;
  lançar dentro da transação e provocar rollback é falha de segurança.
- Se o endpoint nativo receber `Origin` em um runtime nativo real, capturar os
  headers e revisar essa defesa de compatibilidade antes de relaxar o guard.
  Não promover outro header controlado pelo cliente a prova de plataforma.
- Se cookie não for enviado na Web, verificar origem exata, HTTPS, SameSite,
  domínio e `withCredentials`; não mover o token para storage JavaScript.
- Se API estiver indisponível na restauração, manter tela de retry e credencial;
  não converter toda falha em logout.
- Se logout Web falhar, manter a sessão e explicar a falha; não simular remoção de
  cookie `httpOnly`.
- Se teclado cobrir CTA/campo, corrigir `Screen`, rolagem, safe areas e ordem de
  foco antes de aceitar a plataforma.
- Se acesso HTTP local for bloqueado, usar endpoint HTTPS ou exceção somente de
  debug e restrita; não enfraquecer release.
- Se a integração MySQL/E2E for instável, preservar isolamento do banco, um
  worker Playwright e logs sem segredo; não substituir por mocks para fechar M3.

## 13. Documentação oficial consultada

Referências versionadas que materialmente orientam este plano:

- [Expo SDK 57 — SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/)
  — armazenamento nativo, opções, backup Android e persistência do Keychain;
- [Expo Router — autenticação](https://docs.expo.dev/router/advanced/authentication/)
  — provider de sessão e estado de carregamento;
- [Expo Router — rotas protegidas](https://docs.expo.dev/router/advanced/protected/)
  — guards, histórico, deep links e limite client-side;
- [Expo — development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/)
  — rebuild após adicionar módulo nativo;
- [React Native 0.86 — Networking](https://reactnative.dev/docs/0.86/network)
  — Axios sobre XMLHttpRequest, ausência de CORS nativo e restrições cleartext;
- [React Native 0.86 — TextInput](https://reactnative.dev/docs/0.86/textinput)
  — autofill, teclado, submit e segurança de senha;
- [React Native 0.86 — AppState](https://reactnative.dev/docs/0.86/appstate)
  — foco do runtime nativo;
- [TanStack Query v5 — React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)
  — `focusManager` com AppState e limites de conectividade nativa;
- [Axios 1.x — interceptors](https://axios.rest/pages/advanced/interceptors)
  e [request config](https://axios.rest/pages/advanced/request-config) — instância,
  credenciais e interceptação controlada;
- [NestJS 10 — autenticação](https://docs.nestjs.com/security/authentication),
  [cookies](https://docs.nestjs.com/techniques/cookies) e
  [CORS](https://docs.nestjs.com/security/cors) — controllers Express, cookie e
  allowlist;
- [TypeORM 0.3 — transactions](https://typeorm.io/docs/advanced-topics/transactions/)
  — uso obrigatório do manager transacional e consistência da sessão;
- [MySQL 8.0 — locking reads](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html)
  — `SELECT ... FOR UPDATE` para serializar a rotação por sessão no InnoDB;
- [Playwright 1.63 — instalação](https://playwright.dev/docs/intro),
  [CI](https://playwright.dev/docs/ci) e
  [autenticação](https://playwright.dev/docs/auth) — browser pinado, isolamento e
  cuidado com storage state sensível;
- [Fetch Standard — forbidden request headers](https://fetch.spec.whatwg.org/)
  — `Origin` controlado pelo user agent, usado somente como defesa em
  profundidade;
- [RFC 9700 — OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700.html)
  — rotação, relação entre refresh tokens, detecção de replay e revogação da
  família ativa;
- [RFC 10017 — OAuth 2.0 for Browser-Based Applications](https://www.rfc-editor.org/rfc/rfc10017.html)
  — trade-offs entre BFF, backend mediador de tokens e cliente browser;
- [RFC 8252 — OAuth 2.0 for Native Apps](https://www.rfc-editor.org/rfc/rfc8252.html)
  — Authorization Code + PKCE como caminho futuro para provedor externo/SSO;
- [OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
  — não guardar identificadores de sessão em Web Storage;
- [Android Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)
  — cleartext bloqueado por padrão e exceções restritas.

As versões exatas devem ser reconfirmadas imediatamente antes da instalação.
Mudança de major de Expo Router, TanStack Query, Axios ou Playwright exige revisão
deste plano; patch compatível e indicado pelo Expo/npm exige apenas registrar a
matriz efetivamente resolvida.
