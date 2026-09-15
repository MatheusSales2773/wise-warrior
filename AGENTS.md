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

- [TypeScript 6.x documentation](https://www.typescriptlang.org/docs/)
- [NestJS 10 documentation](https://docs.nestjs.com/)
- [TypeORM 0.3 documentation](https://typeorm.io/docs/)
- [Socket.IO 4.x documentation](https://socket.io/docs/v4/)
- [MySQL 8.0 Reference Manual](https://dev.mysql.com/doc/refman/8.0/en/)

#### Frontend

- [React 19 documentation](https://react.dev/)
- [React Native 0.86 documentation](https://reactnative.dev/docs/0.86/components-and-apis)
- [React Native Web accessibility](https://necolas.github.io/react-native-web/docs/accessibility/)
- [Expo SDK 57 documentation](https://docs.expo.dev/)
- [Expo Router documentation](https://docs.expo.dev/router/introduction/)
- [Expo Router protected routes](https://docs.expo.dev/router/advanced/protected/)
- [Expo Router authentication](https://docs.expo.dev/router/advanced/authentication/)
- [Expo SDK 57 SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/)
- [Axios 1.x documentation](https://axios-http.com/docs/intro)
- [TanStack Query v5 React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)

#### Testing

- [Jest 29.7 documentation](https://jestjs.io/docs/29.7/getting-started)
- [React Native Testing Library](https://oss.callstack.com/react-native-testing-library/)
- [TypeScript ESLint legacy configuration](https://typescript-eslint.io/getting-started/legacy-eslint-setup/)
- [Vitest 2 documentation](https://v2.vitest.dev/guide/)
- [Playwright 1.63 installation](https://playwright.dev/docs/intro)
- [Playwright 1.63 CI](https://playwright.dev/docs/ci)
- [Playwright 1.63 authentication](https://playwright.dev/docs/auth)

#### API contracts

- [Redocly CLI 2.x documentation](https://redocly.com/docs/cli/)

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


# Codex project instructions

For complex coding tasks, use the `astra-orchestrator` skill when its trigger conditions match.

The root agent owns architecture, decomposition, integration, and final verification.
Prefer specialized subagents for bounded exploration, implementation, testing, review, and technical research.

Do not delegate trivial work merely for parallelism.
Do not let multiple implementation agents edit the same files without explicit ownership boundaries.
User instructions always take precedence over this orchestration policy.
