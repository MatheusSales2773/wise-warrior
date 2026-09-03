# Configuração de ambientes do Docker Compose

## Objetivo

Remover valores de ambiente embutidos no `docker-compose.yml` e adotar arquivos
dotenv com nomes convencionais, mantendo secrets de produção fora do Git sem
dificultar a execução local.

## Estrutura

- `.env`: configuração base versionada, carregada automaticamente pelo Docker
  Compose e suficiente para executar a stack local.
- `.env.development`: overrides explícitos de desenvolvimento, versionados por
  conterem apenas valores locais não sensíveis.
- `.env.production`: overrides e secrets de produção, ignorados pelo Git.

O Compose referencia todas as variáveis necessárias com a sintaxe de validação
`${VAR:?mensagem}`. Assim, uma configuração ausente interrompe a inicialização
com uma mensagem clara, em vez de usar silenciosamente um valor inseguro.

## Fluxo

O desenvolvimento cotidiano continua funcionando com `docker compose up`. A
seleção explícita usa arquivos em camadas, sempre carregando a base primeiro:

```bash
docker compose --env-file .env --env-file .env.development up --build
docker compose --env-file .env --env-file .env.production up --build -d
```

O backend recebe `NODE_ENV` pelo Compose. Em desenvolvimento, o TypeORM pode
sincronizar o schema local. Em produção, a sincronização permanece desativada e
o deploy deve executar migrations versionadas antes de iniciar a aplicação.

## Segurança e verificação

Somente `.env.production` é ignorado. Os arquivos versionados não devem receber
credenciais reais. O arquivo de produção nasce com secrets vazios e domínios de
exemplo para exigir configuração consciente antes do deploy.

A mudança é validada renderizando as configurações de desenvolvimento e
produção com `docker compose config`, executando testes e build, e verificando a
saúde dos serviços após reconstruir a stack de desenvolvimento.
