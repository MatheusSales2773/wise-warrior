import { expect, test } from '@playwright/test';
import { apiUrl, registerThroughUi } from './helpers/auth';
import { backdateStudySessionForE2e } from './helpers/study-session';

const isApi = (path: string, method: string) => (response: { url(): string; request(): { method(): string } }) => {
  const url = new URL(response.url());
  return url.origin === new URL(apiUrl).origin && url.pathname.endsWith(path) && response.request().method() === method;
};

test.describe('Forja: recuperação e histórico (#17)', () => {
  test('mostra a conexão, sobrevive à queda de rede e à recarga, e lista a sessão no histórico do dia', async ({ page, context }) => {
    await registerThroughUi(page);
    await page.getByTestId('web-sidebar').getByRole('link', { name: 'Forja' }).click();
    await expect(page.getByTestId('study-session-today-card')).toContainText('Nenhuma sessão encerrada hoje.');
    await expect(page.getByTestId('forge-week-summary')).toHaveText(/^Últimos 7 dias: 0 min de foco válido em 0 dias\.$/);

    const startResponse = page.waitForResponse(isApi('/sessions', 'POST'));
    await page.getByRole('button', { name: 'Iniciar foco' }).click();
    const started = await (await startResponse).json() as { id: string };
    await expect(page.getByTestId('study-session-sync-label')).toHaveText('Sincronizado');

    // Perda de rede: a sessão continua na tela e o app diz que está sem conexão.
    await context.setOffline(true);
    await expect(page.getByTestId('study-session-sync-label')).toHaveText('Sem conexão');
    await expect(page.getByTestId('study-session-active')).toBeVisible();

    // Reconexão: o app reconcilia com o servidor sozinho.
    const reconcile = page.waitForResponse(isApi('/sessions/active', 'GET'));
    await context.setOffline(false);
    await reconcile;
    await expect(page.getByTestId('study-session-sync-label')).toHaveText('Sincronizado');

    // Recarga: a mesma sessão volta, com o tempo vindo do servidor, sem criar outra.
    await backdateStudySessionForE2e(started.id);
    const restored = page.waitForResponse(isApi('/sessions/active', 'GET'));
    await page.reload();
    expect((await (await restored).json() as { id: string }).id).toBe(started.id);
    await expect(page.getByTestId('study-session-active')).toBeVisible();

    // Encerrar: a sessão entra no histórico do dia, com o XP confirmado pelo servidor.
    const stopResponse = page.waitForResponse(isApi('/stop', 'POST'));
    await page.getByRole('button', { name: 'Encerrar antecipadamente' }).click();
    await page.getByTestId('study-session-stop-confirm').click();
    const stopped = await (await stopResponse).json() as { xpAwarded: number };
    expect(stopped.xpAwarded).toBeGreaterThan(0);

    // A Pronta lista o dia no card Hoje; o relógio marca a sessão que não concluiu por inteiro.
    const today = page.getByTestId('study-session-today-card');
    await expect(today).toContainText('Sem matéria');
    await expect(today).toContainText(`+${stopped.xpAwarded} XP`);
    await expect(page.getByTestId('forge-week-summary')).toHaveText(/^Últimos 7 dias: \d+ min de foco válido em 1 dia\.$/);
  });
});
