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

Backend em `http://localhost:3000/api/v1`; o Metro do frontend inicia em
`http://localhost:8081` e permite abrir a plataforma desejada pelo terminal.
Testes: `npm test` (roda a suíte de cada workspace).

### Frontend universal fora do Docker

#### Pré-requisitos

- Node.js ≥22.13 e npm (a CI usa Node 22).
- Web: um navegador moderno; nenhuma toolchain nativa é necessária.
- iOS (somente macOS): Xcode com Command Line Tools, um iOS Simulator e
  CocoaPods. Selecione o Xcode ativo com `sudo xcode-select -s
  /Applications/Xcode.app/Contents/Developer` e aceite a licença antes da
  primeira compilação.
- Android: JDK 17, Android Studio, Android SDK Platform 36, Build Tools 36 e
  `platform-tools` (`adb`). O repositório inclui `.sdkmanrc`; com SDKMAN
  configurado, execute `sdk env` na raiz para selecionar o JDK 17.

No macOS, exponha o Android SDK no shell:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

Crie `apps/frontend/.env` a partir de `apps/frontend/.env.example`. Variáveis
consumidas pelo aplicativo precisam do prefixo `EXPO_PUBLIC_` e são incorporadas
ao bundle, portanto nunca coloque secrets nelas:

```bash
cp apps/frontend/.env.example apps/frontend/.env
```

Instale todas as dependências na raiz do monorepo. `npm ci` reproduz exatamente
o lockfile e é o comando usado pela CI:

```bash
npm ci
```

#### Comandos por plataforma

```bash
# Web no navegador
npm run web --workspace apps/frontend

# Primeira compilação/instalação nativa ou após mudar dependências/config nativa
npm run ios --workspace apps/frontend
npm run android --workspace apps/frontend

# Ciclo diário depois que o binário nativo já está instalado
npm run dev:frontend
```

`ios` exige um Simulator iniciado ou dispositivo conectado; `android` exige um
emulador iniciado ou dispositivo visível em `adb devices`. Os comandos
`expo run:*` geram `apps/frontend/ios` ou `apps/frontend/android`, compilam o
binário de debug, instalam-no e iniciam o Metro. Alterações apenas em JavaScript
ou TypeScript usam `npm run dev:frontend` e Fast Refresh sem recompilar código
nativo.

#### Gate M1 e tipos de saída

```bash
# Tipos + lint + Jest + matriz Expo + Expo Doctor + bundles das três plataformas
npm run verify:m1

# Somente o bundle Web pronto para servir
npm run build --workspace apps/frontend

# Somente os bundles Metro de Web, iOS e Android
npm run export:bundles --workspace apps/frontend
```

Uma **exportação de bundle** transforma JavaScript/TypeScript e assets em saída
por plataforma, mas não produz um `.app`, `.ipa`, `.apk` ou `.aab` instalável.
Uma **compilação nativa** usa Xcode ou Gradle por meio de `expo run:ios` ou
`expo run:android` para gerar e instalar um aplicativo local. O **Expo Go** é
opcional para uma verificação rápida enquanto o projeto usar apenas módulos
compatíveis; ele não substitui a compilação nativa validada por este projeto.

Valide `/` e uma URL inexistente nas três plataformas: a inicial deve mostrar
“Wise Warrior” e “Fundação universal ativa”; o fallback deve mostrar “Página não
encontrada” e retornar ao início pelo botão. No navegador, acesse diretamente a
URL; em iOS/Android, abra `wise://runa-inexistente` no simulador/emulador.

Os diretórios nativos gerados, cache `.expo`, `dist` e artefatos locais `.ipa`,
`.apk` e `.aab` permanecem fora do Git.

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
