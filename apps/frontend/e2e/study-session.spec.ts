import { expect, test } from '@playwright/test';
import { apiUrl, registerThroughUi } from './helpers/auth';

test.describe('Forja web', () => {
  test('confirma cancelamento, preserva o histórico e atualiza o Dashboard sem XP', async ({ page }) => {
    await registerThroughUi(page);
    await page.getByRole('link', { name: 'Forja' }).click();
    await expect(page.getByTestId('study-session-setup')).toBeVisible();

    await page.getByRole('button', { name: 'Iniciar foco' }).click();
    await expect(page.getByRole('button', { name: 'Pausar sessão' })).toBeVisible();
    await page.getByRole('button', { name: 'Pausar sessão' }).click();
    await expect(page.getByRole('button', { name: 'Retomar sessão' })).toBeVisible();
    await page.getByRole('button', { name: 'Retomar sessão' }).click();
    await expect(page.getByRole('button', { name: 'Cancelar sessão' })).toBeVisible();

    const stopResponse = page.waitForResponse((response) =>
      new URL(response.url()).origin === new URL(apiUrl).origin
      && new URL(response.url()).pathname.endsWith('/stop')
      && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Cancelar sessão' }).click();
    const response = await stopResponse;
    expect(response.url()).toContain(`${apiUrl}/sessions/`);
    expect(response.status()).toBe(200);
    const result = await response.json() as {
      state: string;
      subject: string | null;
      durationValidSeconds: number;
      remainingSeconds: number;
      xpAwarded: number;
    };
    expect(result).toEqual(expect.objectContaining({
      state: 'cancelled', subject: null, remainingSeconds: 0, xpAwarded: 0,
    }));
    expect(result.durationValidSeconds).toBeLessThan(300);

    await expect(page.getByTestId('study-session-result')).toContainText('Sessão cancelada');
    await expect(page.getByTestId('study-session-result')).toContainText('XP confirmado: 0');
    await expect(page.getByRole('button', { name: 'Nova sessão' })).toBeVisible();
    await page.getByRole('link', { name: 'Acampamento' }).click();
    await expect(page.getByTestId('dashboard-progression')).toContainText('0 XP total');
    await expect(page.getByTestId('dashboard-activity')).toContainText('Cancelada');
    await expect(page.getByTestId('dashboard-activity')).toContainText(/\d+ (?:s|min) · 0 XP/);
    await expect(page.getByTestId('dashboard-activity')).not.toContainText('Sem matéria');
  });
});
