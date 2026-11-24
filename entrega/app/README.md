# Wise — Aplicação mobile (Android e iOS)

Versão do Wise para celular. Consome a mesma API da aplicação web
(`../api`).

## Instalação e execução

### Pré-requisitos

| Ferramenta | Versão | Para quê |
|---|---|---|
| Node.js | 22.13 ou mais recente (22 LTS recomendado) | preparar e servir o código |
| npm | 10 ou mais recente (vem com o Node.js) | instalar as dependências |
| API do Wise | rodando na porta `3000` | a aplicação depende dela |

Antes de começar, suba a API seguindo o `../api/README.md`. Confira que
<http://localhost:3000/api/v1/health> responde `{"status":"ok",...}`.

Para cada plataforma, também é preciso:

- **Android** (Windows, macOS ou Linux): [Android Studio](https://developer.android.com/studio)
  com Android SDK Platform 36, Build Tools 36 e `platform-tools`; JDK 17
  (versões mais novas podem quebrar o build); e um emulador criado no Device Manager do
  Android Studio, ou um aparelho com depuração USB ligada. A variável
  `ANDROID_HOME` precisa apontar para o SDK. No macOS:

  ```bash
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
  ```

- **iOS** (só macOS): Xcode com o iOS Simulator e CocoaPods
  (`brew install cocoapods`). Abra o Xcode uma vez para aceitar a licença e
  instalar os componentes extras.

### 1. Instalar as dependências

Na pasta `app/`:

```bash
npm install
```

### 2. Configurar as variáveis de ambiente

```bash
cp .env.example .env
```

| Variável | Obrigatória | Exemplo | Descrição |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | sim | `http://10.0.2.2:3000/api/v1` | endereço da API visto pelo celular, terminando em `/api/v1` |

O endereço muda conforme onde o app roda. Edite o `.env` antes de iniciar:

| Onde o app roda | `EXPO_PUBLIC_API_URL` |
|---|---|
| Emulador Android | `http://10.0.2.2:3000/api/v1` |
| Simulador iOS | `http://localhost:3000/api/v1` (o valor do `.env.example`) |
| Aparelho físico | `http://<IP do computador na rede>:3000/api/v1`, com celular e computador na mesma rede Wi-Fi |

Essa variável vai para o código do app: nunca coloque senhas ou chaves nela.
Depois de mudar o `.env`, rode o comando de iniciar de novo.

### 3. Compilar e abrir o app

Antes de compilar para Android, confira o JDK do terminal:

```bash
java -version
```

A versão precisa ser 17. Com versões mais novas o build pode falhar (veja
"Problemas comuns"). Se não for 17, instale o JDK 17 e aponte o `JAVA_HOME`
para ele no mesmo terminal. No macOS:

```bash
brew install --cask zulu@17
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export PATH="$JAVA_HOME/bin:$PATH"
java -version   # deve mostrar 17
```

Com o emulador Android aberto (ou o aparelho conectado):

```bash
npm run android
```

No macOS, para o simulador iOS:

```bash
npm run ios
```

A primeira execução compila o app nativo e leva alguns minutos. Ao final, o
app é instalado e aberto no emulador ou simulador, e o terminal fica servindo
o código. Deixe esse terminal aberto enquanto usar o app.

Na tela de entrada, toque em **Crie seu personagem** para cadastrar um usuário.

Nas próximas vezes, com o app já instalado, basta:

```bash
npm start
```

e abrir o Wise no emulador ou simulador.

### Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run android` | gera o projeto Android, compila, instala e abre o app |
| `npm run ios` | gera o projeto iOS, compila, instala e abre o app |
| `npm start` | serve o código para um app já instalado |
| `npm test` | testes automatizados |

### Problemas comuns

- **O app abre mas não carrega dados**: o celular não alcança a API. Confira
  o `EXPO_PUBLIC_API_URL` pela tabela acima. No emulador Android, `localhost`
  é o próprio emulador, por isso o endereço é `10.0.2.2`. Num aparelho
  físico, libere a porta 3000 no firewall do computador.
- **`SDK location not found` ou `ANDROID_HOME`**: o Android SDK não foi
  encontrado. Exporte `ANDROID_HOME` como nos pré-requisitos.
- **`No Android connected device found`**: abra um emulador no Device
  Manager do Android Studio antes de rodar `npm run android`, ou confira o
  aparelho com `adb devices`.
- **`configureCMakeDebug` falha com `A restricted method in java.lang.System
  has been called`**: o Gradle rodou com um JDK mais novo que o 17. Aponte o
  `JAVA_HOME` para o JDK 17 (veja o passo 3), pare o Gradle que ficou
  aberto com `(cd android && ./gradlew --stop)` e rode `npm run android` de
  novo.
- **Erro de CocoaPods no iOS**: instale com `brew install cocoapods` e rode
  `npm run ios` de novo.

## Sobre a aplicação

A mesma base de código gera a aplicação mobile e a web (`../web`). No celular,
a navegação fica numa barra inferior com Acampamento, Forja, Personagem e
Guilda, e o menu "Mais" reúne Mercado, Crônicas e Configuração. O app também
abre por links `wise://`, como `wise://sessao`.

- Rotas em `src/app/`, telas por área em `src/features/`.
- Os projetos nativos `android/` e `ios/` são gerados pelos comandos acima e
  não fazem parte da entrega.
