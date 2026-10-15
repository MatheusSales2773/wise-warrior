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
- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [nginx documentation](https://nginx.org/en/docs/)

## Backend module boundaries

ADR-001 in `docs/PRD.md` makes every cross-module call go through the target
module's exported Service. Apply it to any backend code that touches another
module's data:

- Call the owning Service, including inside a transaction: pass the
  `EntityManager` to a public Service method, as
  `UsersService.grantStarterInventory(manager, userId)` does from
  `AuthService.register`. A module reads and writes only its own entities'
  repositories.
- When a new Service dependency closes a cycle between modules, wrap the module
  import in `forwardRef(() => OtherModule)` on each edge that Nest reports as
  undefined, and keep the call on the Service. `AuthModule`, `UsersModule` and
  `RealtimeModule` already form such a cycle.
- After changing a module's `imports`, run
  `npm run test:auth:integration --workspace apps/backend`. It boots the real
  `AppModule`, and is the only test that catches an unresolved module cycle.
- `AuthService.register` still writes `Character` directly. That is legacy
  code; new code calls `ProgressionService` instead.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `MatheusSales2773/wise-warrior`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the canonical labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. The PRD and current ADR register live in `docs/PRD.md`; the domain glossary lives in the root `CONTEXT.md`. See `docs/agents/domain.md`.

## Git & Commit Guidelines

- Do NOT include any "Co-Authored-By" tags or mention Claude in git commit messages.
