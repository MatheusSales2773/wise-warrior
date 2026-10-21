# Validação das atualizações de segurança de dependências

**Data:** 20/10/2026 (horário de São Paulo; parte da execução ocorreu após meia-noite UTC).

**Branch:** `dev/melhorias`, baseada em `d78dfe4`.

**Escopo:** reduzir vulnerabilidades com atualizações pontuais de dependências,
sem migrar as versões principais da aplicação ou corrigir a issue #235.

## Ambiente e comparação

- Windows, PowerShell, Node.js 24.19.0 e npm 12.2.0.
- NestJS 10.4.22, Express 4.22.1 e TypeORM 0.3.31 preservados.
- Expo 57.0.30, Expo Router 57.0.28, React Native 0.86.3 e React 19.2.3 preservados.
- Jest 29.7.0 e TypeScript 5.9.3/backend e 6.0.3/frontend preservados.
- Cache npm direcionado para uma pasta temporária; nenhum segredo foi incluído
  nos relatórios. Os exports usaram `EXPO_NO_DOTENV=1` e URL fictícia.

Para a comparação final, os manifests e o lockfile **originais de HEAD** foram
extraídos para uma pasta temporária independente. Nela, `npm ci --ignore-scripts`
instalou 1.521 pacotes e `npm audit --json` produziu o baseline abaixo. A árvore
atualizada instalou 1.510 pacotes com o mesmo comando e flags.

| Auditoria completa | Original | Atualizada |
| --- | ---: | ---: |
| Crítica | 3 | 0 |
| Alta | 61 | 53 |
| Moderada | 31 | 31 |
| Baixa | 4 | 2 |
| Total | 99 | 86 |

A primeira auditoria da sessão havia retornado 163 entradas, incluindo 40
críticas; o log de instalação informado pelo usuário mostrava 100. Esses números
não foram usados como comparação final: a tabela usa o lock original reinstalado
e a árvore atualizada auditados nesta mesma etapa. O npm inclui pacotes afetados
por dependências vulneráveis na contagem; os totais não representam falhas
independentes nem demonstram exploração da aplicação.

A consulta adicional `npm audit --json --omit=dev --workspace apps/backend`
retornou 44 entradas: 0 críticas, 28 altas, 15 moderadas e 1 baixa. Em workspaces,
peers compartilhados ainda aparecem nessa consulta, incluindo a cadeia de Jest;
ela não comprova que todos esses pacotes estejam na imagem de produção.

## Alterações e documentação que orientou as decisões

Foram adicionados cinco overrides **restritos aos pacotes consumidores** no
`package.json` da raiz, conforme a documentação de
[overrides do npm 12](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/#overrides).
Eles são necessários porque alguns consumidores fixam versões transitivas ou
faixas antigas. Não foi aplicado `npm audit fix --force`.

| Dependência | Antes → depois | Evidência e motivo |
| --- | --- | --- |
| `proxy-addr` | 2.0.7 → 2.0.8 | Correção crítica na interpretação de endereços/sub-redes: [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). |
| `handlebars` | 4.7.9 → 4.7.10 | Correções críticas em templates compilados: [GHSA-8r5x-fm3f-whwj](https://github.com/advisories/GHSA-8r5x-fm3f-whwj). |
| `shell-quote` | 1.10.0 → 1.12.0 | Versão posterior à correção 1.11.0: [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv). |
| `lodash` | 4.17.21 → 4.18.1 | Override em `@nestjs/config`; versão indicada pelo [advisory do mantenedor](https://github.com/lodash/lodash/security/advisories/GHSA-r5fr-rjxr-66jc). |
| `follow-redirects` | 1.16.0 → 1.16.1 | Correção de vazamento de cabeçalhos configurados em redirecionamentos: [GHSA-8r9p-f939-6h3c](https://github.com/advisories/GHSA-8r9p-f939-6h3c). |
| `glob` | 10.4.5 → 10.5.0 | Override no CLI do Nest, preservando a major 10: [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2). O pacote ainda tem aviso de depreciação. |
| `multer` | 2.0.2 → 2.4.0 | Override em `@nestjs/platform-express`, preservando a major 2: [changelog oficial](https://github.com/expressjs/multer/blob/main/CHANGELOG.md). Não foram encontradas rotas de upload na aplicação. |
| `picomatch` | 4.0.1 → 4.0.7 | Override em `@angular-devkit/core`; deduplicação de cópias 4.0.7 já existentes: [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj). |
| `brace-expansion` | 1.1.18 → 1.1.21; 2.1.4 → 2.1.7; 5.0.9 → 5.0.12 | Patches nas majors existentes: [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7). |
| `tmp` | 0.0.33 → 0.2.7 | Override em `external-editor`; a API utilizada é `tmpNameSync(options)`, mantida no [README 0.2.7](https://github.com/raszi/node-tmp/blob/v0.2.7/README.md#synchronous-filename-generation). A versão intermediária 0.2.6 ainda tem [GHSA-7c78-jf6q-g5cm](https://github.com/raszi/node-tmp/security/advisories/GHSA-7c78-jf6q-g5cm), corrigida em 0.2.7. |

O lockfile foi atualizado por `npm update <pacotes> --package-lock-only
--ignore-scripts --no-audit --no-fund`, seguido de instalação limpa.
`AGENTS.md` recebeu links oficiais de npm para futuras alterações de dependências.
Nenhum arquivo de código da aplicação, teste ou configuração de banco foi alterado.

## Verificações executadas

No PowerShell foi utilizado `npm.cmd`, pois a execução de `npm.ps1` é bloqueada
neste ambiente. Scripts de instalação não foram liberados globalmente.

| Comando/verificação | Resultado |
| --- | --- |
| `npm.cmd ci --ignore-scripts --no-audit --no-fund` | Aprovado com o lock final; 1.510 pacotes. Os avisos de depreciação restantes não foram ocultados. |
| `npm.cmd audit --json` | 86 entradas; zero críticas. Exit code 1 esperado pelos alertas restantes. |
| `npm.cmd audit --json --omit=dev --workspace apps/backend` | 44 entradas; zero críticas; ressalva sobre workspaces acima. |
| `npm.cmd ls proxy-addr handlebars shell-quote multer lodash follow-redirects picomatch tmp --depth=3` | Aprovado; versões e overrides esperados instalados. |
| `npm.cmd run build --workspace apps/backend` | Aprovado, inclusive após o ajuste final de `tmp`. |
| `npm.cmd run lint --workspace apps/backend` | Aprovado. |
| `npm.cmd test --workspace apps/backend -- --runInBand --no-cache` antes; após patches, com `--runInBand --silent --json --outputFile <TEMP>` | Mesmo resultado: 38/39 suítes e 333/334 testes aprovados. Única falha em `database.config.spec.ts:29`, que espera `/` em caminho produzido com `\` no Windows. |
| `node_modules/.bin/jest.cmd --config apps/frontend/jest.config.js --runInBand --no-cache` com `NODE_ENV=test`, antes | 55/61 suítes, 854/878 testes aprovados. Processo apresentou handles abertos e foi interrompido após o resultado. |
| Jest frontend após patches, com `NODE_ENV=test`, `--runInBand --silent --forceExit --json --outputFile <TEMP>` | 56/61 suítes, 855/878 testes aprovados. O reporter JSON adicionalmente falhou por referência circular; o resultado textual foi preservado. |
| `node_modules/.bin/tsc.cmd --project apps/frontend/tsconfig.json --noEmit` | Falhou em três usos de `hovered` em `market-screen.tsx:122`, `:307` e `:324`, arquivo não alterado. TypeScript não foi aprovado. |
| `npm.cmd run lint --workspace apps/frontend` | Aprovado ao repetir fora do sandbox; a primeira tentativa não conseguia ler um diretório ancestral pelo resolvedor do ESLint. |
| `npm.cmd run export:bundles --workspace apps/frontend -- --output-dir <TEMP> --max-workers 2` | Aprovado para Web, iOS e Android com URL fictícia e dotenv desabilitado. A primeira tentativa no sandbox foi bloqueada ao executar Hermes; a repetição fora dele passou. |
| Smoke Node de `external-editor` com `tmp@0.2.7` | Aprovados criação, edição via processo Node sem UI, leitura, código de saída e remoção do arquivo temporário, com opções padrão e prefixo/sufixo string. |
| Smoke Node de `argon2` | Hash e verificação de senha correta/incorreta aprovados mesmo com lifecycle scripts desabilitados. |
| `node_modules/.bin/nest.cmd --help` | Aprovado. |
| `git diff --check` | Aprovado. |

As suítes completas foram executadas após as atualizações principais e antes do
último patch de `tmp` 0.2.6 → 0.2.7, usado apenas pela ferramenta de editor do CLI.
Após esse último patch foram repetidos instalação limpa, auditoria, smoke do
editor/argon2, build backend, lint dos dois apps e exportação das três plataformas.

As falhas finais de frontend estão em `navigation`, `auth-routes` e `foundation`
(rotas simuladas retornam `/`), `android-config` (permissão para symlink no Windows)
e `universal-delivery` (`execFileSync('npm')` recebe ENOENT no Windows). Falhas de
rotas e execução no Windows já apareciam antes das atualizações. O teste do Mercado
passou nesta execução, o que não comprova que a intermitência da issue #235 foi resolvida.

## Pendências e limites

- O audit ainda aponta como altas as cadeias de `braces@3.0.3`
  ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)) e
  `node-forge@1.4.0`
  ([GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)).
  Não havia versão corrigida publicada nas consultas desta execução. `braces`
  aparece em ferramentas Jest/Metro/chokidar; `node-forge`, nas ferramentas de
  assinatura do Expo. Há também alertas moderados e baixos. Não se recomenda
  migrar Nest/Jest ou rebaixar Expo apenas para aceitar a sugestão automática do audit.
- `npm ls react-native-worklets expo-modules-core react-native-reanimated --depth=4`
  acusa conflito: Worklets 0.12.1 satisfaz Reanimated 4.6.0, enquanto Expo Modules
  Core 57.0.23 aceita até a faixa 0.10.x. A instalação isolada do **lock original**
  reproduziu exatamente esse erro. O lock preserva sua entrada original de
  Worklets 0.10.4 sob Expo, mas npm 12 não a instala nesse caminho. Portanto,
  preservá-la não resolve a incompatibilidade nativa; ela requer investigação
  própria com a [orientação oficial de atualização do SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).
- O Docker não estava disponível no PATH. Não foram executados testes MySQL,
  migrações, integração completa de autenticação, E2E ou smoke do container.
- Exportar JavaScript/bytecode não equivale a compilar e testar um binário nativo.
  Não houve QA manual em navegador/dispositivo nem build Android/iOS; a CI com
  seu ambiente de Node/npm ainda precisa confirmar o resultado antes do merge.
- A execução não constitui auditoria completa da segurança da aplicação.
  Nenhuma alteração foi commitada, enviada ou integrada a `develop`/`main`.
