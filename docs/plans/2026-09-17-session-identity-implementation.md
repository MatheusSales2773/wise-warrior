# Issue #69 — identidade da Session autenticada

## Escopo

Esta implementação prepara a autenticação para que cada access token carregue
a identidade da `Session` persistente que o originou, sem substituir `sub` como
identidade do usuário e sem aceitar `sessionId` vindo de headers ou corpos.

O claim privado `sessionId` é emitido no registro, login e refresh. A strategy
JWT exige os três claims (`sub`, `email` e `sessionId`) em runtime e confirma no
MySQL que a Session existe, pertence ao usuário e não foi revogada. O mesmo
caminho é reutilizado pelo gateway Socket.IO. Não há migration nem dependência
de runtime nova: `Session.id`, `userId` e `revokedAt` já fazem parte do schema
persistente.

O contrato público de registro/login/refresh permanece com `sessionId`, como já
consumido pelo frontend. O limite de cinco Sessions, rotação de refresh, logout
e revogação continuam sendo responsabilidade do `AuthService` existente.

## Decisões e documentação version-sensitive

Versões resolvidas no `package-lock.json` antes da alteração:

- NestJS core 10.4.22, `@nestjs/jwt` 10.2.0 e `@nestjs/passport` 10.0.3;
- `passport-jwt` 4.0.1 e TypeORM 0.3.31;
- Socket.IO 4.8.3, Jest 29.7.0 e TypeScript backend 5.9.3;
- MySQL 8.0, conforme a imagem `mysql:8.0` do Docker Compose e do CI.

As decisões foram conferidas nas documentações oficiais de [autenticação
NestJS](https://docs.nestjs.com/security/authentication), [Passport no
NestJS](https://docs.nestjs.com/recipes/passport), [TypeORM Repository e
transações](https://typeorm.io/docs/advanced-topics/transactions/), [JWT
`@nestjs/jwt`](https://github.com/nestjs/jwt), [passport-jwt](https://github.com/mikenicholson/passport-jwt)
e [Socket.IO 4](https://socket.io/docs/v4/). Para a linguagem e o banco, foram
consultados a [documentação do TypeScript](https://www.typescriptlang.org/docs/)
e o [manual de referência do MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/).

O desenho segue o ADR-009 em `docs/PRD.md`: `Session` representa a credencial
persistente de um navegador/aplicativo, enquanto `sub` continua sendo a
identidade do usuário. A consulta da Session acontece depois da verificação do
JWT; claims não presentes ou sem vínculo persistente são rejeitados sem
fallback.

## Verificação

- Testes unitários da emissão e da strategy JWT;
- teste de gateway para ausência, identidade ativa e Session rejeitada;
- integração HTTP/MySQL cobrindo registro, login, refresh, token legado,
  Session cruzada entre usuários, revogação individual, saída de todos e
  preservação do isolamento;
- lint, build e suíte Jest do backend.
