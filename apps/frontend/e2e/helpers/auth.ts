import { expect, type Page, type Response } from '@playwright/test';

export const apiUrl = (process.env.E2E_API_URL ?? 'https://127.0.0.1:8443/api/v1').replace(/\/+$/, '');

export type Credentials = { email: string; password: string };
export type AuthSnapshot = Credentials & { accessToken: string; refreshToken: string };

export function uniqueCredentials(): Credentials {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return { email: `e2e-${suffix}@example.com`, password: 'WiseWarrior!123' };
}

export async function expectPublicLogin(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/entrar(?:[/?#]|$)/);
  await expect(page.getByRole('button', { name: 'Entrar na batalha' })).toBeVisible();
}

export function apiPost(path: string) {
  return (response: Response) => response.url() === `${apiUrl}${path}` && response.request().method() === 'POST';
}

export function apiGet(path: string) {
  return (response: Response) => response.url() === `${apiUrl}${path}` && response.request().method() === 'GET';
}

export async function refreshCookieValue(page: Page): Promise<string> {
  const refreshCookie = (await page.context().cookies(`${apiUrl}/auth/refresh`)).find((cookie) => cookie.name === 'ww_refresh');
  if (!refreshCookie) throw new Error('Expected a Web refresh cookie');
  return refreshCookie.value;
}

export async function expectNoBrowserCredentials(page: Page, credentials: string[]): Promise<void> {
  const browserStorage = await page.evaluate(() => ({ cookie: document.cookie, local: Object.entries(localStorage), session: Object.entries(sessionStorage) }));
  const serializedStorage = JSON.stringify(browserStorage);
  expect(serializedStorage.toLowerCase()).not.toMatch(/access.?token|refresh.?token|bearer|ww_refresh/);
  for (const credential of credentials) expect(serializedStorage).not.toContain(credential);
}

export async function registerThroughUi(
  page: Page,
  credentials = uniqueCredentials(),
  displayName = 'Guerreiro E2E',
): Promise<AuthSnapshot> {
  await page.goto('/cadastro');
  await page.getByLabel('Nome do guerreiro').fill(displayName);
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

export async function loginThroughUi(page: Page, credentials: Credentials): Promise<AuthSnapshot> {
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
