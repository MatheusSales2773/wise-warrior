# ⚔️ Wise

> Plataforma de foco e produtividade gamificada e colaborativa

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat&logo=mysql&logoColor=white)
![Oracle Cloud](https://img.shields.io/badge/Oracle%20Cloud%20Always%20Free-F80000?style=flat&logo=oracle&logoColor=white)

> Ver [docs/PRD.md](docs/PRD.md) para o histórico completo de decisões (ADRs) por trás da stack abaixo — em particular por que Koa.js e AWS, citados nos documentos acadêmicos originais, não fazem parte do escopo implementado.

---

## Sobre o projeto

Wise transforma a rotina de estudos em uma jornada de RPG cooperativa. Estudantes, universitários e concurseiros realizam sessões temporizadas de produtividade, ganham XP, evoluem de nível e colaboram em guildas com metas coletivas — tornando o hábito de estudar mais estimulante e recompensador.

---

## Funcionalidades principais

| Funcionalidade | Descrição | Prioridade |
|---|---|---|
| ⏱ Temporizador Pomodoro | Sessões cronometradas com registro de tempo | Crítico |
| 🎮 Sistema de Progressão RPG | XP, níveis e itens cosméticos desbloqueáveis | Crítico |
| 🛡 Guildas & Raids | Desafios cooperativos semanais com metas coletivas | Crítico |
| 🏆 Ranking de Contribuição | Classificação interna por guilda | Importante |
| 💬 Chat de Grupo | Comunicação em tempo real via Socket.IO | Importante |
| 👤 Perfil Customizável | Personagem e conquistas com itens de recompensa | Importante |

---

## Stack técnica

### Frontend
- Expo SDK 57 · React Native 0.86 · React 19 · TypeScript · Expo Router
- Uma base universal para Web, iOS e Android (ADR-008)

### Backend
- Node.js · NestJS (REST + WebSocket via Socket.IO) · TypeORM
- Monólito modular em camadas (Apresentação → Aplicação → Domínio → Infraestrutura)
- Sessões persistentes multi-dispositivo com refresh token rotativo (ADR-009)

### Banco de dados
- MySQL 8 (relacional)

### Infraestrutura
- Oracle Cloud Always Free (VM Ampere A1 + MySQL HeatWave), deploy via Docker Compose — ver ADR-006

---

## Como executar localmente

### Projeto completo com Docker Compose

O Compose carrega automaticamente o arquivo `.env`, que contém apenas valores
seguros para desenvolvimento local. Para selecionar o ambiente explicitamente,
carregue o arquivo base seguido pelo override desejado:

```bash
# Desenvolvimento (equivale a usar apenas o .env atual)
docker compose --env-file .env --env-file .env.development up --build

# Produção: preencha .env.production antes de executar
docker compose --env-file .env --env-file .env.production up --build -d

# Atalho para desenvolvimento com os valores padrão de .env
docker compose up --build
```

Para iniciar em segundo plano, use `docker compose up -d --build`. Consulte o estado dos serviços com `docker compose ps`.

Os arquivos `.env` e `.env.development` são versionados e devem conter somente
configuração local não sensível. O `.env.production` armazena os secrets do deploy
e é o único arquivo de ambiente ignorado pelo Git.

Depois que os serviços estiverem saudáveis:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000/api/v1`
- Healthcheck da API: `http://localhost:3000/api/v1/health`

Para encerrar, execute `docker compose down`. O banco permanece no volume `mysql_data`.
Se usuário, senha ou nome do banco forem alterados depois da primeira execução,
recrie o volume local com `docker compose down --volumes` antes de subir a stack.

### Execução fora do Docker

```bash
# 1. Suba somente o banco
docker compose up -d mysql

# 2. Instalar dependências (raiz do monorepo, workspaces)
npm install

# 3. Backend (copie apps/backend/.env.example para apps/backend/.env antes)
npm run dev:backend

# 4. Frontend
npm run dev:frontend
```

Backend em `http://localhost:3000/api/v1`, frontend em `http://localhost:5173`. Testes: `npm test` (roda a suíte de cada workspace).

### Frontend universal fora do Docker

O desenvolvimento requer Node.js ≥22.13. Para Android, instale o JDK 17, o
Android Studio, o Android SDK 36 e as ferramentas `platform-tools` (`adb`). Este
repositório inclui uma `.sdkmanrc`; com o SDKMAN configurado, execute
`sdk env` na raiz para selecionar o JDK 17. No macOS, exponha também o SDK:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

Com um emulador iniciado ou dispositivo conectado, execute a primeira compilação
nativa a partir da raiz:

```bash
npm run android --workspace apps/frontend
```

O comando gera `apps/frontend/android`, compila um APK de debug, instala o app e
inicia o Metro. Depois da primeira compilação, alterações somente em JavaScript
ou TypeScript usam `npm run dev:frontend` e Fast Refresh, sem recompilar o código
nativo. Para Web, use `npm run web --workspace apps/frontend`; `npm run build`
exporta os artefatos Web, mas não compila um aplicativo Android. Expo Go e
publicação na Play Store não fazem parte deste fluxo local.

Os diretórios nativos gerados, `.expo` e os artefatos locais permanecem fora do
Git.

---

## Público-alvo

Estudantes, universitários e concurseiros que enfrentam procrastinação, isolamento e falta de constância na rotina acadêmica.

---

## Equipe & custo estimado

- **Time:** 4 desenvolvedores
- **Prazo:** 1 ano
- **Estimativa:** R$ 550.000/ano (~R$ 46.000/mês)
  - Cobre equipe, hospedagem, licenças de software, marketing e margem de segurança

---

## Referências

- [Focumon](https://www.focumon.com/)
- [Habitica](https://habitica.com/)
- [GymRats](https://www.gymrats.app)
- [Idle Habits](https://idlehabits.com)
