# Plano de implementação — Login e Cadastro

**Branch:** `feat-telas-login-cadastro`  
**Escopo:** somente frontend React das rotas públicas `/entrar` e `/cadastro`  
**Referências obrigatórias:** `docs/Wise Warrior _standalone_.html`, `docs/PRD.md`, `docs/api/openapi.yaml`, DTOs reais do backend e ADR-008/ADR-009.

## 1. Objetivo e resultado esperado

Substituir as telas provisórias de login e cadastro por uma experiência de autenticação responsiva, acessível e coerente com a identidade dark-fantasy refinada do standalone. As duas telas devem continuar usando o fluxo real do `AuthContext`, sem mocks, sem duplicar chamadas HTTP e sem alterar o backend.

O usuário deve conseguir:

1. acessar `/entrar`, informar e-mail e senha, autenticar via API e ser redirecionado para `/`;
2. navegar de login para `/cadastro`;
3. criar uma conta com nome, e-mail, senha e confirmação local de senha;
4. receber feedback específico de validação, credenciais inválidas, e-mail já cadastrado e falha inesperada;
5. navegar de cadastro para `/entrar`;
6. usar integralmente as telas por teclado, leitor de tela e viewport mobile.

Não fazem parte do escopo: recuperação de senha, login social, “lembrar de mim”, termos versionados, verificação de e-mail ou alterações no contrato do backend. Esses recursos não existem na API atual e não devem aparecer como controles falsos.

## 2. Direção visual

A direção será **grimório de acesso / portal da fortaleza**, derivada diretamente do standalone:

- fundo `#07070c` com vinheta radial dourada e textura sutil;
- superfícies `#12121c` e `#181826`;
- acento ouro envelhecido `#d4a85a`, com destaque `#f0c97a`;
- texto principal `#f3ead4`, secundário `#b3a98e` e muted `#6b6555`;
- títulos em Cinzel, corpo em Inter e metadados em JetBrains Mono;
- card com borda fina, cantos ornamentais e glow contido;
- sigilo vetorial próprio em CSS/SVG inline, sem imagem externa e sem copiar o bundle do protótipo;
- animação inicial curta (sigilo, copy e card) e transições de foco/hover; tudo desativado por `prefers-reduced-motion`.

Desktop usa composição assimétrica em duas áreas: narrativa/branding à esquerda e formulário à direita. Mobile elimina a área narrativa longa, mantém marca, subtítulo e formulário em uma única coluna, respeitando `safe-area-inset-*`. O formulário nunca ultrapassa 480 px e os alvos interativos têm no mínimo 44 px.

## 3. Arquitetura de componentes e arquivos

### Novos arquivos

- `apps/frontend/src/features/auth/components/AuthShell.tsx`
  - estrutura compartilhada das duas páginas;
  - marca, sigilo, painel narrativo, ornamentos e slot do formulário;
  - recebe `eyebrow`, `title`, `description` e `children`.
- `apps/frontend/src/features/auth/components/PasswordField.tsx`
  - input reutilizável com botão mostrar/ocultar;
  - preserva `name`, autocomplete, validação e atributos ARIA.
- `apps/frontend/src/features/auth/auth-pages.css`
  - todo o layout e estados visuais das páginas públicas;
  - classes prefixadas com `auth-` para evitar colisões com o restante da aplicação.
- `apps/frontend/src/pages/RegisterPage.test.tsx`
  - testes do formulário, validação de confirmação e submissão.

### Arquivos alterados

- `apps/frontend/src/pages/LoginPage.tsx`
  - adota `AuthShell` e `PasswordField`;
  - mantém integração por `useAuth().login`;
  - diferencia erro 401 de falha genérica;
  - usa `autocomplete="email"` e `autocomplete="current-password"`.
- `apps/frontend/src/pages/RegisterPage.tsx`
  - adota os componentes compartilhados;
  - adiciona confirmação de senha somente no cliente;
  - mantém integração por `useAuth().register`;
  - diferencia 409, 400 e falha genérica;
  - usa `autocomplete="name"`, `email` e `new-password`.
- `apps/frontend/src/pages/LoginPage.test.tsx`
  - atualiza as expectativas e testa submissão/erro.
- `apps/frontend/src/styles/tokens.css`
  - alinha tokens existentes com a paleta e nomenclatura visual do standalone sem quebrar os consumidores atuais;
  - adiciona apenas tokens globais reutilizáveis, deixando regras específicas no CSS de autenticação.
- `apps/frontend/index.html`
  - mantém as famílias já definidas no projeto; nenhuma dependência visual nova.

Não será adicionada biblioteca de formulário, ícones ou animação. O escopo é pequeno e React/CSS nativos são suficientes.

## 4. Contrato da API e fluxo de dados

### Login

`POST /api/v1/auth/login`

```json
{
  "email": "usuario@exemplo.com",
  "password": "senha informada",
  "deviceLabel": "navigator.userAgent"
}
```

- `200`: o `AuthContext` armazena o access token apenas em memória, conecta o Socket.IO e a página navega para `/` com `replace: true`;
- `401`: exibir “E-mail ou senha incorretos.”;
- outros erros: exibir “Não foi possível entrar agora. Tente novamente.”.

### Cadastro

`POST /api/v1/auth/register`

```json
{
  "displayName": "2 a 60 caracteres",
  "email": "e-mail válido",
  "password": "8 a 128 caracteres"
}
```

O campo `confirmPassword` nunca é enviado ao backend.

- `201`: o `AuthContext` aplica a sessão retornada e a página navega para `/` com `replace: true`;
- `409`: exibir “Este e-mail já está cadastrado.”;
- `400`: exibir “Revise os campos destacados.”;
- outros erros: exibir “Não foi possível criar sua conta agora. Tente novamente.”.

Os botões ficam desabilitados durante a requisição e o rótulo muda para o estado em progresso. Não deve haver dupla submissão. Os dados do formulário permanecem preenchidos em caso de erro.

## 5. Validação, acessibilidade e estados

- Login: e-mail obrigatório e válido; senha obrigatória.
- Cadastro: nome obrigatório entre 2 e 60 caracteres; e-mail obrigatório e válido; senha entre 8 e 128 caracteres; confirmação idêntica à senha.
- Erros locais são associados ao campo com `aria-describedby` e `aria-invalid`.
- Erro de API é anunciado em um bloco `role="alert"`.
- Estado de envio usa `aria-busy` no formulário e texto explícito no botão.
- Mostrar/ocultar senha é um `button type="button"` com nome acessível dinâmico.
- A ordem de tabulação segue visualmente a ordem dos campos.
- Contraste deve permanecer compatível com WCAG AA e o foco visível não pode depender apenas de glow.
- O layout deve funcionar em 320 px, 375 px, 768 px, 1024 px e desktop largo sem overflow horizontal.
- Sem conteúdo importante em pseudo-elementos; ornamentos são decorativos e ignorados por tecnologia assistiva.

Estados visuais obrigatórios: repouso, hover, focus-visible, preenchido, inválido, disabled/submitting e alerta de API.

## 6. Testes e verificação

### Testes automatizados

Login:

- renderiza e-mail, senha, CTA e link de cadastro;
- alterna visibilidade da senha;
- chama `login(email, password, navigator.userAgent)` uma única vez;
- redireciona após sucesso;
- apresenta mensagem correta em 401;
- mantém botão desabilitado durante envio.

Cadastro:

- renderiza nome, e-mail, senha, confirmação, CTA e link de login;
- não submete quando as senhas divergem;
- chama `register(email, password, displayName)` sem enviar confirmação;
- redireciona após sucesso;
- apresenta mensagem específica em 409;
- respeita limites 2–60 e 8–128.

### Comandos de aceite

```bash
npm test --workspace apps/frontend
npm run build --workspace apps/frontend
```

### QA visual/manual

- comparar paleta, tipografia, densidade, molduras e atmosfera com o standalone;
- conferir as cinco larguras-alvo;
- percorrer ambos os formulários apenas com teclado;
- verificar foco, mensagens de erro, loading e `prefers-reduced-motion`;
- confirmar que nenhuma chamada é feita para endpoint inexistente.

## 7. Critérios de conclusão

A entrega só está concluída quando:

1. `/entrar` e `/cadastro` possuem aparência final coerente entre si e com o standalone;
2. ambos os fluxos usam o `AuthContext` e respeitam exatamente os DTOs e status da API;
3. todos os estados de validação, carregamento e erro estão implementados;
4. não há regressão nas rotas protegidas ou no restauro de sessão;
5. testes e build do frontend passam;
6. não há alteração de backend, dependência desnecessária ou funcionalidade sem suporte da API;
7. o diff não inclui nem sobrescreve a alteração preexistente do usuário em `package-lock.json`.
