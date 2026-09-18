import { expect, test, type Page } from '@playwright/test';
import { apiGet, apiUrl, registerThroughUi, uniqueCredentials } from './helpers/auth';

async function createAndCompleteSession(page: Page, accessToken: string, subject: string): Promise<void> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const started = await page.request.post(`${apiUrl}/sessions`, { data: { subject, mode: 'solo' }, headers });
  expect(started.ok()).toBe(true);
  const session = (await started.json()) as { id: string };
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  const completed = await page.request.post(`${apiUrl}/sessions/${session.id}/complete`, { headers });
  expect(completed.ok()).toBe(true);
  expect(await completed.json()).toEqual(expect.objectContaining({
    id: session.id,
    endedAt: expect.any(String),
  }));
}

test.describe('painel web', () => {
  test('exibe o perfil inicial e uma atividade vazia honesta', async ({ page }) => {
    const recentResponse = page.waitForResponse(apiGet('/sessions/recent'));
    await registerThroughUi(page);

    const recent = await recentResponse;
    expect(recent.status()).toBe(200);
    expect(await recent.json()).toEqual([]);
    await expect(page.getByTestId('dashboard-profile')).toContainText('Boas-vindas, Guerreiro E2E');
    await expect(page.getByTestId('dashboard-progression')).toContainText('Nível 1');
    await expect(page.getByTestId('dashboard-progression')).toContainText('0 XP total');
    await expect(page.getByTestId('dashboard-activity-empty')).toContainText(
      'Nenhuma sessão concluída ainda. Suas sessões concluídas aparecerão aqui.',
    );
  });

  test('atualiza a atividade depois de criar e concluir uma sessão pela API', async ({ page }) => {
    const registered = await registerThroughUi(page);
    const subject = `Estudo E2E ${Date.now()}`;
    await createAndCompleteSession(page, registered.accessToken, subject);

    await page.getByRole('button', { name: 'Atualizar dados' }).click();
    await expect(page.getByTestId('dashboard-activity')).toContainText(subject);
    await expect(page.getByTestId('dashboard-activity')).toContainText('solo');
  });

  test('isola a atividade ao sair e cadastrar uma segunda conta', async ({ page }) => {
    const first = await registerThroughUi(page, uniqueCredentials(), 'Primeiro Guerreiro');
    const subject = `Sessão da primeira conta ${Date.now()}`;
    await createAndCompleteSession(page, first.accessToken, subject);
    await page.getByRole('button', { name: 'Atualizar dados' }).click();
    await expect(page.getByTestId('dashboard-activity')).toContainText(subject);

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/entrar(?:[/?#]|$)/);
    await registerThroughUi(page, uniqueCredentials(), 'Segundo Guerreiro');

    await expect(page.getByTestId('dashboard-profile')).toContainText('Boas-vindas, Segundo Guerreiro');
    await expect(page.getByTestId('dashboard-activity-empty')).toBeVisible();
    await expect(page.getByText(subject)).toHaveCount(0);
  });

  test('preserva o perfil quando sessões recentes falham parcialmente', async ({ page }) => {
    await registerThroughUi(page);
    await page.route(`${apiUrl}/sessions/recent`, (route) => route.abort('failed'));
    await page.reload();

    await expect(page.getByTestId('dashboard-profile')).toContainText('Boas-vindas, Guerreiro E2E');
    await expect(page.getByTestId('dashboard-activity-error')).toBeVisible();
    await expect(page.getByTestId('dashboard-partial-error')).toContainText('Alguns dados não foram atualizados.');
  });

  test('faz uma única renovação e repete a requisição protegida expirada', async ({ page }) => {
    await registerThroughUi(page);
    let expiredRequestUsed = false;
    await page.route(`${apiUrl}/users/me`, async (route) => {
      if (expiredRequestUsed) return route.continue();
      expiredRequestUsed = true;
      await route.continue({ headers: { ...route.request().headers(), authorization: 'Bearer expired-e2e-token' } });
    });

    let refreshCount = 0;
    page.on('response', (response) => {
      if (response.url() === `${apiUrl}/auth/refresh` && response.request().method() === 'POST') refreshCount += 1;
    });
    const refresh = page.waitForResponse((response) => response.url() === `${apiUrl}/auth/refresh` && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Atualizar dados' }).click();
    const refreshResponse = await refresh;
    expect(refreshResponse.ok()).toBe(true);
    await expect(page.getByTestId('dashboard-profile')).toContainText('Boas-vindas, Guerreiro E2E');
    expect(expiredRequestUsed).toBe(true);
    expect(refreshCount).toBe(1);
  });
});
