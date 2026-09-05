# Validação do gate universal M1

**Data:** 04/09/2026

**Issue:** #34

**Resultado:** aprovado

## Ambiente

- Node.js 22.22.3 e npm 10.9.8
- Expo SDK 57.0.20, Expo Router 57.0.19, React Native 0.86.3 e React 19.2.3
- Xcode 26.6, iOS Simulator 26.5 (`iPhone 17 Pro`)
- Eclipse Temurin JDK 17.0.20
- Android SDK Platform 36, Build Tools 36.0.0 e AVD `Medium_Phone`

## Instalação limpa e gate integrado

Após `npm ci`, `npm run verify:m1` concluiu com:

- typecheck aprovado;
- lint aprovado;
- 16 testes Jest do frontend aprovados;
- matriz de dependências Expo atualizada;
- Expo Doctor com 21/21 checks aprovados;
- bundles Web, iOS e Android exportados em `dist`.

A CI executa essa mesma sequência depois de `npm ci`, por meio de um único
comando. O script não compila binários nativos: essa etapa continua explícita e
dependente das toolchains locais.

## Rotas e builds locais

### Web

- `/` exibiu `Wise Warrior` e `Fundação universal ativa` no navegador.
- `/runa-inexistente` exibiu `Página não encontrada` e o botão `Voltar ao início`.
- O teste de entrega do container continua cobrindo o fallback do SPA servido
  pelo nginx.

### iOS

- `npx expo prebuild --clean --platform ios` regenerou o projeto nativo somente
  a partir da configuração versionada.
- `npm run ios --workspace apps/frontend -- --device "iPhone 17 Pro"
  --no-bundler` concluiu com `Build Succeeded`, instalou e abriu
  `dev.guilhermeluan.wisewarrior`.
- Com o Metro ativo, a rota inicial e o deep link
  `wise://runa-inexistente` renderizaram o conteúdo esperado no Simulator.

### Android

- A compilação, instalação, inicialização, rota inicial e fallback no AVD
  `Medium_Phone` estão comprovados em
  `docs/validation/2026-09-04-android-local-build.md` (issue #31).
- A #34 não altera código, configuração de app ou dependências nativas já
  validados pela #31; o bundle Android foi novamente gerado pelo gate limpo.
- Uma tentativa adicional nesta execução não chegou a conectar o AVD ao ADB por
  pressão de memória do host e não substitui a evidência aprovada da #31.

## Higiene e escopo

`git check-ignore --no-index` confirmou que `apps/frontend/ios`,
`apps/frontend/android`, `apps/frontend/.expo`, `apps/frontend/dist` e arquivos
de distribuição `.ipa`, `.apk` e `.aab` são ignorados. O diff da #34 contém
somente gate/CI, documentação, regras de ignore e teste do contrato de entrega;
não adiciona autenticação, design system, telas ou funcionalidades de produto.

## Critérios de aceite

- [x] Qualidade, matriz Expo, Doctor e export Web passam após instalação limpa.
- [x] Bundles Web, iOS e Android são gerados sem erro.
- [x] Rota inicial e fallback verificados em Web, iOS e Android.
- [x] Builds locais iOS e Android iniciam em destinos suportados.
- [x] README cobre Node, Xcode, JDK, Android SDK, ambiente e comandos locais.
- [x] README diferencia bundle, compilação nativa e Expo Go opcional.
- [x] Diretórios, caches e artefatos gerados permanecem fora do Git.
- [x] Nenhuma funcionalidade reservada às próximas etapas foi adicionada.
