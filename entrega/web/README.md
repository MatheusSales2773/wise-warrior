# Wise — Aplicação web

Versão web do Wise, aberta no navegador. Consome a mesma API da aplicação
mobile (`../api`).

## Instalação e execução

### Pré-requisitos

| Ferramenta | Versão | Para quê |
|---|---|---|
| Node.js | 22.13 ou mais recente (22 LTS recomendado) | executar a aplicação |
| npm | 10 ou mais recente (vem com o Node.js) | instalar as dependências |
| Navegador | Chrome, Edge, Firefox ou Safari atualizados | usar a aplicação |
| API do Wise | rodando em `http://localhost:3000` | a aplicação depende dela |

Antes de começar, suba a API seguindo o `../api/README.md`. Confira que
<http://localhost:3000/api/v1/health> responde `{"status":"ok",...}`.

### 1. Instalar as dependências

Na pasta `web/`:

```bash
npm install
```

### 2. Configurar as variáveis de ambiente

```bash
cp .env.example .env
```

| Variável | Obrigatória | Exemplo | Descrição |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | sim | `http://localhost:3000/api/v1` | endereço da API, terminando em `/api/v1` |

O valor do `.env.example` já serve quando a API roda na mesma máquina. Se a
API estiver em outro endereço, troque aqui e reinicie a aplicação. Essa
variável vai para o código entregue ao navegador: nunca coloque senhas ou
chaves nela.

### 3. Iniciar a aplicação

```bash
npm run web
```

Abra <http://localhost:8081> no navegador. A primeira carga leva alguns
segundos enquanto o código é preparado.

Na tela de entrada, clique em **Crie seu personagem** para cadastrar um usuário.

### Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run web` | inicia a aplicação web em `http://localhost:8081` |
| `npm run build` | gera a versão de produção, estática, em `dist/` |
| `npm test` | testes automatizados |
| `npm run lint` | verificação de estilo |

### Problemas comuns

- **Tela de erro de conexão ou "Network Error"**: a API não está rodando ou
  `EXPO_PUBLIC_API_URL` aponta para o lugar errado. Depois de mudar o `.env`,
  pare com `Ctrl+C` e rode `npm run web` de novo.
- **Erro de CORS no console do navegador**: o `CORS_ORIGIN` do `.env` da API
  precisa conter o endereço aberto no navegador. O padrão já libera
  `http://localhost:8081` e `http://localhost:8082`. Reinicie a API depois de
  mudar.
- **Porta 8081 ocupada**: o comando pergunta se pode usar outra porta. Se ele
  usar a 8082, não precisa mexer em nada. Para qualquer outra porta, inclua o
  novo endereço em `CORS_ORIGIN` na API (separado por vírgula).

## Sobre a aplicação

A mesma base de código gera a aplicação web e a mobile (`../app`). Em telas a
partir de 900 px de largura a navegação fica numa barra lateral; abaixo disso,
numa barra inferior.

- Rotas em `src/app/`, telas por área em `src/features/`.
- Componentes e tema em `src/design-system/`.
- Comunicação com a API em `src/core/api` e eventos em tempo real em
  `src/core/realtime`.
