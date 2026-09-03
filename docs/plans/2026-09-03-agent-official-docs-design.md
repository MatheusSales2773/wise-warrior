# Consulta de documentação oficial por agentes

## Objetivo

Reduzir implementações baseadas em APIs desatualizadas ou em lembranças de
outras versões da stack. Antes de alterar código ou configuração, o agente deve
identificar a tecnologia afetada, confirmar a versão instalada e consultar sua
documentação oficial.

## Decisão

O `AGENTS.md` concentra uma regra operacional e links oficiais agrupados por
backend, frontend, testes e infraestrutura. Links versionados são usados quando
o fornecedor mantém documentação específica para a versão instalada. Nos demais
casos, o agente deve partir da documentação oficial e conferir a compatibilidade
com o manifesto e o lockfile do projeto.

A lista cobre as tecnologias que orientam decisões recorrentes no repositório:
TypeScript, NestJS, TypeORM, Socket.IO, MySQL, React, React Router, Vite, Jest,
Vitest, Docker Compose e nginx. Bibliotecas utilitárias não são incluídas para
evitar transformar a regra em um inventário difícil de manter; quando uma delas
for diretamente afetada, sua documentação oficial ainda deve ser consultada.

## Verificação

A alteração é documental. A validação consiste em conferir se os links apontam
para fontes oficiais, se as versões correspondem às dependências instaladas e se
a regra aparece antes das demais instruções de implementação no `AGENTS.md`.
