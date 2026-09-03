# Plano de implementação — M1 Fundação Expo universal

**Data:** 03/09/2026
**Status:** Validado, pronto para implementação
**Branch de implementação:** `feat/frontend-expo-foundation`
**Designs relacionados:**

- `docs/plans/2026-09-03-react-native-universal-design.md`
- `docs/plans/2026-09-03-react-native-migration-prioritization-design.md`

## 1. Resultado esperado

Substituir diretamente o runtime Vite de `apps/frontend` por uma aplicação Expo
mínima que:

- inicia localmente em Web, iOS e Android;
- usa Expo Router com rotas tipadas;
- exporta um SPA Web servível pelo nginx atual;
- possui TypeScript estrito, lint e testes Jest;
- lê a URL pública da API de forma validada;
- permanece dentro do workspace npm existente;
- não implementa ainda design system, autenticação ou telas de produto.

O frontend anterior permanece recuperável pelo histórico Git e pelo standalone.
Não haverá runtime Vite ou aplicação legada paralela após a M1.

## 2. Estado confirmado antes da mudança

### Stack atual

| Tecnologia | Versão atual |
|---|---:|
| React | 18.3.1 |
| React DOM | 18.3.1 |
| React Router DOM | 6.26.2 |
| Vite | 5.4.6 |
| TypeScript | 5.6.2 |
| Vitest | 2.1.1 |
| Node declarado | `>=20` |
| Node local | 22.22.3 |
| Node da CI | 22 |
| Node da imagem frontend | 20 Alpine |

### Ambiente nativo observado

- Xcode 26.6: atende ao mínimo 26.4 do Expo SDK 57.
- JDK local 25: não corresponde ao JDK 17 recomendado para Android.
- `adb` e `emulator`: não encontrados no `PATH` durante o planejamento.
- Android Studio, Android SDK 36 e um dispositivo virtual ou físico precisam ser
  confirmados antes da validação Android.

Ferramentas de sistema ausentes não serão instaladas sem autorização do usuário.

## 3. Matriz alvo

Versões obtidas do template oficial Expo SDK 57 em 03/09/2026:

| Pacote/runtime | Versão alvo |
|---|---:|
| Expo SDK | 57 |
| `expo` | `~57.0.19` |
| `react-native` | `0.86.3` |
| `react` | `19.2.3` |
| `react-dom` | `19.2.3` |
| `react-native-web` | `~0.21.0` |
| `expo-router` | `~57.0.18` |
| `typescript` | `~6.0.3` |
| `@types/react` | `~19.2.2` |
| `jest-expo` | `~57.0.5` |
| `@testing-library/react-native` | `14.0.1` |
| `test-renderer` | `1.2.0` |
| `eslint-config-expo` | `~57.0.2` |
| Node | `>=22.13` |

Pacotes integrados ao SDK serão instalados com `npx expo install`, e não com
versões escolhidas manualmente. O lockfile será a fonte exata das versões
resolvidas. Antes do commit, `npx expo install --check` deve confirmar a matriz.

Não usar versões beta ou canary.

## 4. Estrutura alvo ao concluir M1

```text
apps/frontend/
├── __tests__/
│   ├── environment.test.ts
│   └── foundation.test.tsx
├── src/
│   ├── app/
│   │   ├── +not-found.tsx
│   │   ├── _layout.tsx
│   │   └── index.tsx
│   └── config/
│       └── environment.ts
├── .env.example
├── app.json
├── Dockerfile
├── eslint.config.js
├── expo-env.d.ts
├── jest.config.js
├── nginx.conf
├── package.json
└── tsconfig.json
```

As pastas `apps/frontend/ios`, `apps/frontend/android`, `apps/frontend/.expo` e
`apps/frontend/dist` são geradas e não entram no Git.

## 5. Tarefas de implementação

### Tarefa 1 — Validar o ambiente local

**Arquivos alterados:** nenhum.

1. Confirmar Node e npm.
2. Confirmar Xcode e simulador iOS disponível.
3. Confirmar Android Studio, SDK 36, JDK 17, `adb` e dispositivo Android.
4. Registrar no resumo qualquer ferramenta ausente.

**Comandos:**

```bash
node --version
npm --version
xcodebuild -version
xcrun simctl list devices available
java -version
adb version
emulator -list-avds
```

**Saída esperada:** Node ≥22.13, Xcode ≥26.4, JDK 17 selecionado para o build e
ao menos um destino por plataforma nativa.

### Tarefa 2 — Trocar dependências e scripts

**Arquivos:**

- `package.json`
- `apps/frontend/package.json`
- `package-lock.json`

1. Alterar o engine raiz para `node >=22.13`.
2. Substituir as dependências do frontend pelas versões da seção 3.
3. Instalar, via `expo install`, Router, Safe Area, Screens, Linking, Constants,
   Status Bar, React Native Web e React DOM.
4. Instalar Jest Expo, Jest, tipos de Jest, React Native Testing Library, ESLint
   `test-renderer` e `eslint-config-expo` como dependências de desenvolvimento.
5. Definir `main: "expo-router/entry"`.
6. Remover `type: "module"`; os arquivos de configuração CommonJS do Expo e do
   Jest não precisam dessa alteração global de semântica.
7. Substituir scripts do workspace frontend:

```json
{
  "start": "expo start",
  "web": "expo start --web",
  "ios": "expo run:ios",
  "android": "expo run:android",
  "build": "expo export --platform web",
  "typecheck": "tsc --noEmit",
  "lint": "expo lint",
  "test": "jest --runInBand"
}
```

8. Manter os scripts raiz existentes e acrescentar aliases apenas se ajudarem a
   executar `web`, `ios`, `android` e `typecheck` por workspace.

**Verificação:** `npm install` termina sem conflito de peer dependencies e
`npm ls` não apresenta dependências inválidas.

### Tarefa 3 — Criar configuração Expo e TypeScript

**Arquivos:**

- `apps/frontend/app.json`
- `apps/frontend/tsconfig.json`
- `apps/frontend/expo-env.d.ts`
- `.gitignore`

Configurar no `app.json`:

- nome `Wise Warrior` e slug `wise-warrior`;
- scheme `wise`;
- plugin `expo-router`;
- `experiments.typedRoutes: true`;
- `web.bundler: "metro"`;
- `web.output: "single"`;
- identificadores provisórios e estáveis:
  `dev.guilhermeluan.wisewarrior` para iOS e Android;
- orientação padrão e metadados mínimos, sem inventar assets finais.

O `tsconfig.json` deve estender `expo/tsconfig.base`, preservar `strict`,
`noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`,
`noUnusedParameters` e `noFallthroughCasesInSwitch`, configurar `@/*` para
`./src/*` e incluir os tipos do Expo e do Jest.

Ignorar `.expo/`, os diretórios nativos gerados, `.env*.local` e artefatos de
teste. Não ignorar `.env.example`.

**Verificação:**

```bash
npx expo config --type public
npm run typecheck --workspace apps/frontend
```

### Tarefa 4 — Criar a aplicação mínima

**Arquivos:**

- `apps/frontend/src/app/_layout.tsx`
- `apps/frontend/src/app/index.tsx`
- `apps/frontend/src/app/+not-found.tsx`

O layout raiz usa `Stack` e `StatusBar`, sem providers futuros. A rota inicial usa
somente `SafeAreaView`, `View` e `Text`, apresentando “Wise Warrior” e a mensagem
“Fundação universal ativa”. O fallback oferece retorno à rota inicial.

Aplicar apenas estilos locais mínimos com `StyleSheet`. Não antecipar tokens,
fontes, componentes, navegação autenticada ou tema final da M2.

**Verificação:** a mesma rota renderiza sem condicionais de plataforma em Web,
iOS e Android.

### Tarefa 5 — Configurar ambiente público

**Arquivos:**

- `apps/frontend/.env.example`
- `apps/frontend/src/config/environment.ts`
- `apps/frontend/__tests__/environment.test.ts`

Substituir `VITE_API_BASE_URL` por `EXPO_PUBLIC_API_URL`. Acessar a variável
estaticamente como `process.env.EXPO_PUBLIC_API_URL`, pois acesso dinâmico não é
inserido pelo Expo CLI.

Validar que o valor existe e é uma URL HTTP(S). A mensagem de falha deve indicar
o nome da variável, sem expor credenciais. `.env.example` usa apenas um endereço
local não sensível. Nenhum segredo pode receber prefixo `EXPO_PUBLIC_`.

O módulo será preparado na M1, mas não precisa ser importado pela tela inicial;
isso evita exigir o backend para o smoke test visual.

### Tarefa 6 — Substituir Vitest por Jest Expo

**Arquivos:**

- `apps/frontend/jest.config.js`
- `apps/frontend/src/test/setup.ts`
- `apps/frontend/__tests__/foundation.test.tsx`

Usar o preset `jest-expo` e React Native Testing Library. Os testes permanecem
fora de `src/app`, pois todo arquivo nesse diretório é interpretado como rota.

Casos mínimos:

1. rota inicial contém nome e status da fundação;
2. Router reconhece `/`;
3. variável ausente gera erro descritivo;
4. URL inválida é rejeitada;
5. URL válida é normalizada sem barra final acidental.

Não usar snapshots na M1.

### Tarefa 7 — Remover o runtime Vite

**Remover após o primeiro smoke test Expo Web:**

- `apps/frontend/index.html`
- `apps/frontend/vite.config.ts`
- `apps/frontend/src/main.tsx`
- `apps/frontend/src/vite-env.d.ts`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/components/`
- `apps/frontend/src/features/`
- `apps/frontend/src/layouts/`
- `apps/frontend/src/lib/`
- `apps/frontend/src/pages/`
- `apps/frontend/src/styles/`

Remover do `package.json` Vite, plugin React para Vite, React Router DOM, Vitest,
Testing Library DOM, Jest DOM, User Event, jsdom e tipos exclusivos do React DOM.

Antes da remoção, confirmar que todos os arquivos estão no commit anterior. Não
usar `git reset --hard` ou exclusões abrangentes. Cada alvo deve ser explícito.

**Verificação:**

```bash
rg -n "vite|vitest|react-router-dom|import.meta.env|document|window" apps/frontend
```

Ocorrências permitidas devem estar somente em documentação ou lockfile transitivo
justificado.

### Tarefa 8 — Adaptar lint e CI

**Arquivos:**

- `apps/frontend/eslint.config.js`
- `.github/workflows/ci.yml`

Usar a configuração flat de `eslint-config-expo`, ignorando `dist`, `.expo`,
`ios` e `android`. Não adicionar Prettier ou React Compiler nesta etapa.

O job de frontend deve executar, em ordem:

1. `npm ci`;
2. `npm run typecheck --workspace apps/frontend`;
3. `npm run lint --workspace apps/frontend`;
4. `npm test --workspace apps/frontend`;
5. `npm exec --workspace apps/frontend -- expo install --check`;
6. executar `npx expo-doctor` a partir de `apps/frontend`;
7. `npm run build --workspace apps/frontend`.

A CI Linux não compila binários iOS. Bundles nativos e builds locais entram no
checklist manual da Tarefa 10.

### Tarefa 9 — Adaptar o build Web em container

**Arquivos:**

- `apps/frontend/Dockerfile`
- `apps/frontend/nginx.conf`

1. Trocar a imagem de build para Node 22 Alpine.
2. Substituir `VITE_API_BASE_URL` por `EXPO_PUBLIC_API_URL` como argumento e
   variável de build.
3. Executar o novo script `build`, que gera `apps/frontend/dist`.
4. Manter nginx como runtime estático.
5. Preservar fallback de SPA para `index.html` por causa de
   `web.output: "single"`.
6. Manter cache imutável somente nos assets com hash produzidos pelo Metro.

**Verificação:** construir a imagem, iniciar o container, consultar `/health`, `/`
e uma rota desconhecida, e confirmar que não há referência a arquivos Vite.

### Tarefa 10 — Gate final das três plataformas

Executar:

```bash
npm ci
npm run typecheck --workspace apps/frontend
npm run lint --workspace apps/frontend
npm test --workspace apps/frontend
npm exec --workspace apps/frontend -- expo install --check
npm run build --workspace apps/frontend
npm exec --workspace apps/frontend -- expo export --platform ios
npm exec --workspace apps/frontend -- expo export --platform android
npm run ios --workspace apps/frontend
npm run android --workspace apps/frontend
```

No iOS e Android, confirmar visualmente:

- carregamento da rota inicial;
- safe area sem conteúdo cortado;
- fallback de rota;
- ausência de erro vermelho ou warning relevante no Metro;
- recarga do bundle após alteração TypeScript.

Expo Go não é gate da M1. A referência oficial consultada em 03/09/2026 informa
que a versão das lojas ainda acompanha SDK 54; SDK 57 será validado com builds
locais. Não adicionar `expo-dev-client` enquanto uma dependência futura não o
exigir.

Executar `npx expo-doctor` com o diretório corrente em `apps/frontend`; o comando
não deve validar o `package.json` raiz como se ele fosse o aplicativo Expo.

### Tarefa 11 — Atualizar documentação de desenvolvimento

**Arquivos:**

- `README.md`

Documentar Node ≥22.13, JDK 17, Android Studio/SDK 36, Xcode ≥26.4, variáveis de
ambiente, comandos Web/iOS/Android e a diferença entre exportar bundles e compilar
um aplicativo nativo. Remover instruções Vite e deixar explícito que Expo Go não
é requisito nem gate do SDK 57.

## 6. Sequência planejada de commits da implementação

1. `chore(frontend): bootstrap Expo SDK 57 workspace`
2. `test(frontend): add Expo foundation checks`
3. `chore(frontend): replace Vite runtime`
4. `build(frontend): export Expo web app in CI and Docker`
5. `docs(frontend): document local universal development`

Cada commit precisa passar pelo menos tipos e testes pertinentes. O último commit
só ocorre após o gate completo.

## 7. Critérios de aceite

- `apps/frontend` não depende de Vite, React Router DOM, Vitest ou APIs do DOM.
- `/` e o fallback renderizam em Web, iOS e Android.
- `EXPO_PUBLIC_API_URL` possui validação unitária e documentação local.
- TypeScript, lint, Jest, Expo Doctor e `expo install --check` passam.
- o export Web é servido pelo container nginx.
- builds locais iOS e Android iniciam em simulador, emulador ou dispositivo.
- `ios/`, `android/`, `.expo/` e `dist/` não aparecem no diff.
- README descreve os comandos novos e pré-requisitos locais.
- nenhuma funcionalidade de M2 ou posterior foi antecipada.

## 8. Fora do escopo

- tema Ouro completo e biblioteca de componentes;
- autenticação e armazenamento seguro;
- cliente HTTP conectado ao backend;
- TanStack Query e Socket.IO;
- Dashboard, Perfil, Guilda e Study Session;
- Pomodoro, offline e notificações;
- EAS Build, publicação ou configuração de lojas;
- React Compiler, Prettier ou abstrações de plataforma prematuras.

## 9. Recuperação e bloqueios

- Se Expo Web não iniciar, não remover o runtime antigo até identificar a causa.
- Se `expo install --check` apontar divergência, aceitar as versões compatíveis
  sugeridas pelo SDK e atualizar a tabela antes do commit.
- Não fazer downgrade automático para Expo 56. Registrar a incompatibilidade e
  solicitar decisão.
- Se o ambiente Android estiver ausente, concluir tarefas de repositório que não
  dependem dele, mas manter M1 aberta até a validação real.
- Se um commit intermediário quebrar o workspace, corrigir com commit adicional
  ou revert explícito; não apagar mudanças com comandos destrutivos.

## 10. Documentação oficial consultada

- [Matriz do Expo SDK 57](https://docs.expo.dev/versions/latest/)
- [Instalação manual do Expo Router](https://docs.expo.dev/router/installation/)
- [Expo em monorepos](https://docs.expo.dev/guides/monorepos/)
- [Variáveis de ambiente](https://docs.expo.dev/guides/environment-variables/)
- [Testes unitários com Jest Expo](https://docs.expo.dev/develop/unit-testing/)
- [Testes do Expo Router](https://docs.expo.dev/router/reference/testing/)
- [ESLint com Expo](https://docs.expo.dev/guides/using-eslint/)
- [Build local de desenvolvimento](https://docs.expo.dev/guides/local-app-development/)
- [Exportação e hospedagem Web](https://docs.expo.dev/guides/publishing-websites/)
- [Configuração do emulador Android](https://docs.expo.dev/workflow/android-studio-emulator/)
- [React Native 0.86](https://reactnative.dev/blog/2026/06/11/react-native-0.86)

As versões devem ser reconfirmadas imediatamente antes da instalação porque o
SDK recebe patches compatíveis. Mudança de patch indicada por `expo install` não
altera a decisão arquitetural; mudança de SDK exige revisão deste plano.
