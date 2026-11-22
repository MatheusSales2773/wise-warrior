# Wise — API (backend)

API REST e gateway de tempo real do Wise. A mesma API atende a aplicação web
(`../web`) e a aplicação mobile (`../app`).

## Instalação e execução

### Pré-requisitos

| Ferramenta | Versão | Para quê |
|---|---|---|
| Node.js | 22.13 ou mais recente (22 LTS recomendado) | executar a API |
| npm | 10 ou mais recente (vem com o Node.js) | instalar as dependências |
| Docker | qualquer versão recente | subir o banco MySQL 8.0 |

Sem Docker, use um MySQL 8.0 instalado na máquina, com um banco `wise` e um
usuário `wise` com todas as permissões nele. O servidor precisa da opção
`log_bin_trust_function_creators=1`, exigida pelas migrations.

### 1. Subir o banco de dados

Na pasta `api/`, rode uma única vez:

```bash
docker run -d --name wise-mysql \
  -e MYSQL_DATABASE=wise \
  -e MYSQL_USER=wise \
  -e MYSQL_PASSWORD=wise-dev-password \
  -e MYSQL_ROOT_PASSWORD=wise-root-password \
  -p 3306:3306 \
  mysql:8.0 --log-bin-trust-function-creators=1
```

O MySQL leva uns 30 segundos para aceitar conexões na primeira vez. Confira com:

```bash
docker exec wise-mysql mysqladmin ping -h 127.0.0.1 -u wise -pwise-dev-password
```

Quando aparecer `mysqld is alive`, siga para o próximo passo. Nas próximas
vezes, basta `docker start wise-mysql`.

### 2. Instalar as dependências

```bash
npm install
```

### 3. Configurar as variáveis de ambiente

```bash
cp .env.example .env
```

O `.env.example` já vem com `DB_PASSWORD=wise-dev-password`, a mesma senha do
comando do passo 1. Se você copiou e colou aquele comando sem alterar nada, não
precisa mexer no `.env`: ele já funciona como está para rodar localmente. Só
troque o `DB_PASSWORD` se tiver usado outra senha no `docker run`.

| Variável | Obrigatória | Exemplo | Descrição |
|---|---|---|---|
| `PORT` | não | `3000` | porta HTTP da API (padrão `3000`) |
| `CORS_ORIGIN` | sim | `http://localhost:8081` | origem da aplicação web; várias separadas por vírgula |
| `DB_HOST` | sim | `localhost` | host do MySQL |
| `DB_PORT` | sim | `3306` | porta do MySQL |
| `DB_USERNAME` | sim | `wise` | usuário do MySQL |
| `DB_PASSWORD` | sim | `wise-dev-password` | senha do MySQL |
| `DB_DATABASE` | sim | `wise` | nome do banco |
| `JWT_ACCESS_SECRET` | sim | `wise-dev-access-secret-troque-em-producao` | segredo do token de acesso, com ao menos 32 caracteres; em produção, gere um com `openssl rand -hex 32` |
| `JWT_ACCESS_TTL` | sim | `15m` | duração do token de acesso |
| `JWT_REFRESH_SECRET` | sim | `wise-dev-refresh-secret-troque-em-producao` | segredo do token de renovação; em produção, gere um com `openssl rand -hex 32` |
| `JWT_REFRESH_TTL_DAYS` | sim | `30` | dias de validade da sessão |
| `MAX_SESSIONS_PER_USER` | sim | `5` | dispositivos conectados por usuário |
| `COSMETICS_PREMIUM_FOR_ALL` | não | `true` | libera os itens premium para todos quando a cobrança está desligada |
| `NODE_ENV` | não | `production` | em `production`, aplica as migrations ao iniciar e exige segredos fortes |
| `DB_MIGRATIONS_RUN` | não | `true` | aplica as migrations ao iniciar fora de produção |
| `APP_URL` | só com Stripe | `http://localhost:8081` | endereço da aplicação web, para onde o pagamento volta |
| `STRIPE_SECRET_KEY` | não | `sk_test_...` | chave de teste do Stripe; vazia deixa a cobrança indisponível e o resto funciona |
| `STRIPE_WEBHOOK_SECRET` | só com Stripe | `whsec_...` | segredo do webhook do Stripe |
| `STRIPE_PRICE_PREMIUM` | só com Stripe | `price_...` | preço mensal do plano premium |
| `DEV_TOOLS_EMAILS` | não | `teste@exemplo.com` | e-mails que veem a seção Desenvolvedor |
| `TRUST_PROXY` | não | `1` | número de proxies à frente da API |
| `RATE_LIMIT_*` | não | vazio | limites de requisições; vazio usa o padrão |
| `XP_PER_MINUTE`, `ANTIFRAUDE_*`, `COINS_PER_FOCUS_MINUTES_DIVISOR`, `RAID_WIN_COINS`, `RAID_FURY_REGEN_PERCENT` | não | valores do `.env.example` | regras de XP, Moedas e Raid |

O `.env.example` não tem segredos reais. Nunca publique o `.env` com chaves
verdadeiras.

### 4. Criar as tabelas

```bash
npm run migration:run
```

O comando cria as tabelas e os dados iniciais (itens da Loja, por exemplo).
Rode de novo sempre que receber uma versão nova do projeto.

### 5. Iniciar a API

```bash
npm run start:dev
```

A API fica em `http://localhost:3000/api/v1`. Para conferir, abra
<http://localhost:3000/api/v1/health> ou rode:

```bash
curl http://localhost:3000/api/v1/health
```

Para rodar a versão compilada, como em produção:

```bash
npm run build
npm start
```

### Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run start:dev` | inicia a API e reinicia a cada alteração no código |
| `npm run build` e `npm start` | compila para `dist/` e inicia a versão compilada |
| `npm run migration:run` | aplica as migrations pendentes |
| `npm run migration:show` | lista as migrations aplicadas e pendentes |
| `npm test` | testes unitários |
| `npm run lint` | verificação de estilo |
| `docker stop wise-mysql` | para o banco (os dados ficam no container) |
| `docker rm -f wise-mysql` | apaga o banco para começar do zero |

### Problemas comuns

- **`ECONNREFUSED 127.0.0.1:3306`**: o MySQL ainda não subiu. Espere o
  `mysqld is alive` do passo 1, ou rode `docker start wise-mysql`.
- **`Access denied for user 'wise'`**: o `DB_PASSWORD` do `.env` não é a
  senha do passo 1.
- **`port is already allocated` ou `EADDRINUSE`**: a porta 3306 ou 3000 já
  está em uso. Troque o `-p 3306:3306` por `-p 3307:3306` e use
  `DB_PORT=3307`; para a API, mude `PORT` no `.env` e ajuste o endereço nas
  aplicações web e mobile.
- **A aplicação web dá erro de CORS**: `CORS_ORIGIN` precisa ser exatamente o
  endereço aberto no navegador, como `http://localhost:8081`.

## Cobrança com Stripe (opcional)

A Assinatura premium e os Pacotes usam o Stripe em modo de teste. Sem
`STRIPE_SECRET_KEY` a cobrança fica indisponível e o resto da aplicação
funciona. Para ligá-la:

1. No painel do Stripe, em modo de teste, crie um preço recorrente mensal de
   R$ 9,90 e copie a chave secreta (`sk_test_...`).
2. Com a [Stripe CLI](https://docs.stripe.com/stripe-cli) instalada, encaminhe
   os eventos para a API e copie o `whsec_...` impresso:

   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/v1/billing/webhook
   ```

3. Preencha `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_PREMIUM` e `APP_URL` no `.env` e reinicie a API.
4. Pague com o cartão de teste `4242 4242 4242 4242`, qualquer data futura e
   qualquer CVC, mantendo o `stripe listen` aberto.

## Sobre a API

- REST em `/api/v1`, eventos em tempo real via Socket.IO no mesmo endereço.
- Contratos completos em `../docs/api/openapi.yaml` (REST) e
  `../docs/api/asyncapi.yaml` (eventos).
- Código em `src/modules/`, um módulo por área: `auth`, `users`,
  `progression`, `sessions`, `economy`, `shop`, `objectives`, `guilds`,
  `raids`, `chat`, `billing` e `realtime`. As migrations ficam em
  `src/migrations/`.
