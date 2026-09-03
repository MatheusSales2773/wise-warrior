# Repository instructions

## Official documentation before implementation

Before implementing or changing code, tests, infrastructure, or configuration:

1. Identify the affected technologies and confirm their installed versions in
   `package-lock.json`, the relevant `package.json`, or the container image tag.
2. Consult the corresponding official documentation listed below before making
   implementation decisions. Prefer documentation matching the installed major
   version and do not rely only on memory for APIs or configuration behavior.
3. If an affected technology is not listed, find its primary official
   documentation before implementing. Add it here when it becomes a recurring
   part of the stack.
4. Mention version-sensitive documentation that materially guided the change in
   the implementation summary or plan.

### Project technology references

#### Language and backend

- [TypeScript 5.x documentation](https://www.typescriptlang.org/docs/)
- [NestJS 10 documentation](https://docs.nestjs.com/)
- [TypeORM 0.3 documentation](https://typeorm.io/docs/)
- [Socket.IO 4.x documentation](https://socket.io/docs/v4/)
- [MySQL 8.0 Reference Manual](https://dev.mysql.com/doc/refman/8.0/en/)

#### Frontend

- [React 18 documentation](https://18.react.dev/)
- [React Router 6.30 documentation](https://reactrouter.com/6.30.6/start/overview)
- [Vite 5 documentation](https://v5.vite.dev/guide/)

#### Testing

- [Jest 29.7 documentation](https://jestjs.io/docs/29.7/getting-started)
- [Vitest 2 documentation](https://v2.vitest.dev/guide/)

#### Infrastructure

- [Docker Compose documentation](https://docs.docker.com/compose/)
- [nginx documentation](https://nginx.org/en/docs/)

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `MatheusSales2773/wise-warrior`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the canonical labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. The PRD and current ADR register live in `docs/PRD.md`; a root `CONTEXT.md` may be added later. See `docs/agents/domain.md`.
