# Docker Compose — stack completa local

## Objetivo

Permitir que qualquer pessoa suba o Wise Warrior inteiro com um único comando:

```bash
docker compose up --build
```

## Topologia

- `mysql`: MySQL 8 com volume persistente `mysql_data`, publicado em `localhost:3306`.
- `backend`: imagem multi-stage Node 20/NestJS, publicada em `localhost:3000` e conectada ao MySQL pela rede interna do Compose.
- `frontend`: build de produção Vite servido por Nginx, publicado em `localhost:5173`.

O navegador acessa a API em `http://localhost:3000/api/v1`; por isso, essa URL é injetada no build do frontend por `VITE_API_BASE_URL`, em vez de usar o hostname interno `backend`.

## Ordem de inicialização

1. MySQL inicia e responde ao `mysqladmin ping` autenticado.
2. Backend inicia somente após o MySQL ficar saudável e responde em `/api/v1/health`.
3. Frontend inicia somente após o backend ficar saudável e responde em `/health` pelo Nginx.

As políticas `restart: unless-stopped` recuperam os serviços após falhas ou reinício do Docker Desktop.

## Build do monorepo

Os Dockerfiles usam a raiz como contexto para receber `package.json`, `package-lock.json` e os manifests dos workspaces. Isso permite que `npm ci` respeite corretamente o lockfile único do monorepo. A `.dockerignore` exclui dependências, builds locais, cobertura, Git e arquivos de ambiente.

O frontend usa fallback do Nginx para `index.html`, garantindo que rotas do React Router como `/entrar` e `/cadastro` funcionem quando abertas diretamente.

## Configuração

Todas as variáveis possuem defaults adequados ao desenvolvimento local e podem ser sobrescritas por um arquivo `.env` na raiz:

- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`
- `VITE_API_BASE_URL`

Os defaults não devem ser reutilizados em produção.

## Critérios de aceite

- `docker compose config` é válido.
- `docker compose build` constrói backend e frontend.
- `docker compose up -d --build` deixa os três serviços saudáveis.
- `GET http://localhost:3000/api/v1/health` retorna `status: ok`.
- `HEAD http://localhost:5173/entrar` retorna HTTP 200.
- `GET http://localhost:5173/health` retorna `ok`.
- A suíte automatizada do projeto continua passando.
