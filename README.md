# ⚔️ Wise Warrior

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

Wise Warrior transforma a rotina de estudos em uma jornada de RPG cooperativa. Estudantes, universitários e concurseiros realizam sessões temporizadas de produtividade, ganham XP, evoluem de nível e colaboram em guildas com metas coletivas — tornando o hábito de estudar mais estimulante e recompensador.

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
- React 18 + TypeScript · Vite · React Router v6 · Axios · socket.io-client
- Responsivo mobile-first (ADR-008): sidebar em desktop, navegação inferior em mobile/tablet

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

```bash
# Sobe MySQL, backend e frontend em uma única execução
docker compose up --build
```

Depois que os serviços estiverem saudáveis:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000/api/v1`
- Healthcheck da API: `http://localhost:3000/api/v1/health`

Para encerrar, execute `docker compose down`. O banco permanece no volume `mysql_data`.

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
