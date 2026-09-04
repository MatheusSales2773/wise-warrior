# Validação da build local Android

**Data:** 04/09/2026

**Issue:** #31

**Resultado:** aprovado

## Ambiente confirmado antes do build

- JDK: Eclipse Temurin 17.0.20
- Android SDK: platform 36 e Build Tools 36.0.0
- Gradle resolvido pelo Expo: 9.3.1
- `compileSdk`: 36
- `targetSdk`: 36
- `adb`: 1.0.41 (platform-tools 37.0.0)
- destino: AVD `Medium_Phone`, Android API 37, `arm64-v8a`
- identificador instalado: `dev.guilhermeluan.wisewarrior`

## Build e execução

Com JDK 17 e `ANDROID_HOME` apontando para o SDK local, foi executado:

```bash
npm run android --workspace apps/frontend
```

O Expo gerou `apps/frontend/android`, o Gradle concluiu `assembleDebug` com
`BUILD SUCCESSFUL`, o APK de debug foi instalado no AVD e a `MainActivity` do
Wise Warrior foi iniciada. O diretório nativo, o APK, `.expo` e `dist` continuaram
ignorados pelo Git.

## Smoke test no emulador

- A rota `/` exibiu `Wise Warrior` e `Fundação universal ativa`.
- A rota inexistente `wise:///runa-inexistente` exibiu
  `Página não encontrada` e o botão `Voltar ao início`.
- Nas duas rotas, o conteúdo permaneceu dentro da área útil de 1080×2400 do
  dispositivo e centralizado, sem sobreposição com as barras do sistema.
- Uma alteração temporária em `src/app/index.tsx` atualizou o texto para
  `Fundação universal ativa no Android` via Metro/Fast Refresh. O APK não foi
  recompilado; em seguida, o texto original foi restaurado.
- O `logcat` do processo foi verificado depois da renderização e não apresentou
  exceção fatal, erro React Native nem tela vermelha. Os avisos de compilação
  observados vieram de dependências do Expo/React Native, sem warning de
  configuração do aplicativo.

## Gates automatizados

- `npm test`: 43 testes aprovados (28 backend, 15 frontend)
- `npm run typecheck --workspace apps/frontend`: aprovado
- `npm run lint --workspace apps/frontend`: aprovado
- `npm run expo:check --workspace apps/frontend`: dependências atualizadas
- `npm run expo:doctor --workspace apps/frontend`: 21/21 checks aprovados
- `expo export --platform android`: bundle Android exportado com sucesso
