import { expect, test, type Page, type Response } from '@playwright/test';

const apiUrl = (process.env.E2E_API_URL ?? 'https://127.0.0.1:8443/api/v1').replace(/\/+$/, '');

type Credentials = {
  email: string;
  password: string;
};

type AuthSnapshot = Credentials & {
  accessToken: string;
  refreshToken: string;
};

function uniqueCredentials(): Credentials {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return { email: `e2e-${suffix}@example.com`, password: 'WiseWarrior!123' };
}

async function expectPublicLogin(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/entrar(?:[/?#]|$)/);
  await expect(page.getByRole('button', { name: 'Entrar na batalha' })).toBeVisible();
}

function apiPost(path: string) {
  return (response: Response) =>
    response.url() === `${apiUrl}${path}` && response.request().method() === 'POST';
}

async function refreshCookieValue(page: Page): Promise<string> {
  const refreshCookie = (await page.context().cookies(`${apiUrl}/auth/refresh`)).find(
    (cookie) => cookie.name === 'ww_refresh',
  );
  if (!refreshCookie) throw new Error('Expected a Web refresh cookie');
  return refreshCookie.value;
}

async function expectNoBrowserCredentials(page: Page, credentials: string[]): Promise<void> {
  const browserStorage = await page.evaluate(() => ({
    cookie: document.cookie,
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
  }));
  const serializedStorage = JSON.stringify(browserStorage);
  expect(serializedStorage.toLowerCase()).not.toMatch(/access.?token|refresh.?token|bearer|ww_refresh/);
  for (const credential of credentials) {
    expect(serializedStorage).not.toContain(credential);
  }
}

async function registerThroughUi(page: Page, credentials = uniqueCredentials()): Promise<AuthSnapshot> {
  await page.goto('/cadastro');
  await page.getByLabel('Nome do guerreiro').fill('Guerreiro E2E');
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(credentials.password);
  await page.getByLabel('Confirmar senha').fill(credentials.password);
  const [response] = await Promise.all([
    page.waitForResponse(apiPost('/auth/register')),
    page.waitForURL((url) => url.pathname === '/' || url.pathname.endsWith('/sessao')),
    page.getByRole('button', { name: 'Criar personagem' }).click(),
  ]);
  const body = (await response.json()) as { accessToken: string };
  const refreshToken = await refreshCookieValue(page);
  await expect(page.getByTestId('web-sidebar')).toBeVisible();
  return { ...credentials, accessToken: body.accessToken, refreshToken };
}

async function loginThroughUi(page: Page, credentials: Credentials): Promise<AuthSnapshot> {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(credentials.password);
  const [response] = await Promise.all([
    page.waitForResponse(apiPost('/auth/login')),
    page.waitForURL((url) => url.pathname === '/' || url.pathname.endsWith('/sessao')),
    page.getByRole('button', { name: 'Entrar na batalha' }).click(),
  ]);
  const body = (await response.json()) as { accessToken: string };
  const refreshToken = await refreshCookieValue(page);
  return { ...credentials, accessToken: body.accessToken, refreshToken };
}

test.describe('autenticação web', () => {
  test('mantém /entrar e /cadastro navegáveis na SPA', async ({ page }) => {
    await page.goto('/entrar');
    await expectPublicLogin(page);
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Senha', exact: true })).toBeVisible();

    await page.goto('/cadastro');
    await expect(page).toHaveURL(/\/cadastro(?:[/?#]|$)/);
    await expect(page.getByRole('button', { name: 'Criar personagem' })).toBeVisible();
    await expect(page.getByLabel('Nome do guerreiro')).toBeVisible();
  });

  test('cadastra, protege a sessão web, restaura no reload, desloga e entra novamente', async ({ page }) => {
    const registered = await registerThroughUi(page);

    const cookies = await page.context().cookies(`${apiUrl}/auth/refresh`);
    const refreshCookie = cookies.find((cookie) => cookie.name === 'ww_refresh');
    expect(refreshCookie).toMatchObject({
      httpOnly: true,
      path: '/api/v1/auth',
      sameSite: 'Lax',
      secure: true,
    });
    expect(refreshCookie?.value).toBe(registered.refreshToken);
    expect(await page.evaluate(() => document.cookie)).not.toContain('ww_refresh');
    await expectNoBrowserCredentials(page, [registered.accessToken, registered.refreshToken]);

    const [restoreResponse] = await Promise.all([
      page.waitForResponse(apiPost('/auth/refresh')),
      page.reload(),
    ]);
    const restoreBody = (await restoreResponse.json()) as { accessToken: string };
    const restoredRefreshToken = await refreshCookieValue(page);
    await expect(page.getByTestId('web-sidebar')).toBeVisible();
    await expectNoBrowserCredentials(page, [
      registered.accessToken,
      registered.refreshToken,
      restoreBody.accessToken,
      restoredRefreshToken,
    ]);

    await page.getByRole('button', { name: 'Sair' }).click();
    await expectPublicLogin(page);
    await expect(page.getByTestId('web-sidebar')).toHaveCount(0);
    const cookiesAfterLogout = await page.context().cookies(`${apiUrl}/auth/refresh`);
    expect(cookiesAfterLogout.some((cookie) => cookie.name === 'ww_refresh')).toBe(false);

    const loggedIn = await loginThroughUi(page, registered);
    await expect(page.getByTestId('web-sidebar')).toBeVisible();
    await expectNoBrowserCredentials(page, [loggedIn.accessToken, loggedIn.refreshToken]);
  });

  test('redireciona /perfil anônimo e a API rejeita chamada sem bearer', async ({ page }) => {
    await page.goto('/perfil');
    await expectPublicLogin(page);

    const response = await page.request.get(`${apiUrl}/users/me`);
    expect(response.status()).toBe(401);
  });

  test('mantém o cadastro público quando a API está indisponível', async ({ page }) => {
    const credentials = uniqueCredentials();
    await page.route(`${apiUrl}/auth/register`, (route) => route.abort('failed'));
    await page.goto('/cadastro');
    await page.getByLabel('Nome do guerreiro').fill('Guerreiro E2E');
    await page.getByLabel('E-mail').fill(credentials.email);
    await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(credentials.password);
    await page.getByLabel('Confirmar senha').fill(credentials.password);
    await page.getByRole('button', { name: 'Criar personagem' }).click();

    await expect(page).toHaveURL(/\/cadastro(?:[/?#]|$)/);
    await expect(page.getByRole('alert')).toContainText('Não foi possível criar sua conta agora');
    await expect(page.getByTestId('web-sidebar')).toHaveCount(0);
  });

  test('mantém o login público quando a API está indisponível', async ({ page }) => {
    const credentials = uniqueCredentials();
    await page.route(`${apiUrl}/auth/login`, (route) => route.abort('failed'));
    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill(credentials.email);
    await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Entrar na batalha' }).click();

    await expectPublicLogin(page);
    await expect(page.getByRole('alert')).toContainText('Não foi possível entrar agora');
    await expect(page.getByTestId('web-sidebar')).toHaveCount(0);
  });

  test('credencial inválida permanece em /entrar sem montar o shell', async ({ page }) => {
    await page.goto('/entrar');
    const credentials = uniqueCredentials();
    await page.getByLabel('E-mail').fill(credentials.email);
    await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(credentials.password);

    const loginResponse = page.waitForResponse(
      (response) => response.url() === `${apiUrl}/auth/login` && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Entrar na batalha' }).click();
    await expect((await loginResponse).status()).toBe(401);
    await expectPublicLogin(page);
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.');
    await expect(page.getByTestId('web-sidebar')).toHaveCount(0);
  });

  test('classifica restauração com API indisponível sem exibir shell ou logout falso', async ({ page }) => {
    await registerThroughUi(page);
    await page.route(`${apiUrl}/auth/refresh`, (route) => route.abort('failed'));

    await page.reload();
    await expect(page.getByTestId('session-unavailable-safe-area')).toBeVisible();
    await expect(page.getByTestId('web-sidebar')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0);
  });

  test('mantém a sessão ativa quando o logout fica indisponível', async ({ page }) => {
    await registerThroughUi(page);
    await page.route(`${apiUrl}/auth/logout`, (route) => route.abort('failed'));

    await page.getByRole('button', { name: 'Sair' }).click();

    await expect(page.getByTestId('web-sidebar')).toBeVisible();
    await expect(page.getByTestId('logout-error')).toContainText(
      'Sua sessão continua ativa; verifique sua conexão e tente novamente.',
    );
  });
});
