import { expect, test } from '@playwright/test';
import mysql from 'mysql2/promise';
import type { ResultSetHeader } from 'mysql2/promise';
import { apiUrl, registerThroughUi } from './helpers/auth';

async function backdateStudySessionForE2e(studySessionId: string): Promise<void> {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: Number(process.env.E2E_DB_PORT),
    user: 'wise',
    password: 'wise-e2e-password',
    database: 'wise_e2e',
  });

  try {
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE study_sessions
       SET started_at = DATE_SUB(NOW(3), INTERVAL 300 SECOND),
           run_deadline_at = DATE_ADD(
             DATE_SUB(NOW(3), INTERVAL 300 SECOND),
             INTERVAL planned_duration_seconds SECOND
           )
       WHERE id = ? AND state = 'running'`,
      [studySessionId],
    );
    if (result.affectedRows !== 1) throw new Error('Could not prepare the E2E Study Session');
  } finally {
    await connection.end();
  }
}

test.describe('Forja web', () => {
  test('pausa, retoma, encerra com XP e atualiza o Dashboard com a resposta do servidor', async ({ page }) => {
    await registerThroughUi(page);
    await page.getByRole('link', { name: 'Forja' }).click();
    await expect(page.getByTestId('study-session-setup')).toBeVisible();
    await page.getByRole('radio', { name: '15 minutos' }).click();

    const apiPath = new URL(apiUrl).pathname.replace(/\/+$/, '');
    const startResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).origin === new URL(apiUrl).origin
      && new URL(response.url()).pathname === `${apiPath}/sessions`
      && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Iniciar foco' }).click();
    const startResponse = await startResponsePromise;
    expect(startResponse.status()).toBe(201);
    const started = await startResponse.json() as { id: string; plannedDurationSeconds: number };
    expect(started.plannedDurationSeconds).toBe(900);
    await backdateStudySessionForE2e(started.id);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Pausar sessão' })).toBeVisible();
    const pauseResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).origin === new URL(apiUrl).origin
      && new URL(response.url()).pathname.endsWith('/pause')
      && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Pausar sessão' }).click();
    const pauseResponse = await pauseResponsePromise;
    expect(pauseResponse.status()).toBe(200);
    const paused = await pauseResponse.json() as { durationValidSeconds: number };
    expect(paused.durationValidSeconds).toBeGreaterThanOrEqual(300);

    const resumeResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).origin === new URL(apiUrl).origin
      && new URL(response.url()).pathname.endsWith('/resume')
      && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Retomar sessão' }).click();
    const resumeResponse = await resumeResponsePromise;
    expect(resumeResponse.status()).toBe(200);
    const resumed = await resumeResponse.json() as { state: string; durationValidSeconds: number };
    expect(resumed).toMatchObject({ state: 'running' });
    expect(resumed.durationValidSeconds).toBeGreaterThanOrEqual(300);

    const stopResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).origin === new URL(apiUrl).origin
      && new URL(response.url()).pathname.endsWith('/stop')
      && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Encerrar antecipadamente' }).click();
    const stopResponse = await stopResponsePromise;
    expect(stopResponse.status()).toBe(200);
    const result = await stopResponse.json() as {
      id: string;
      state: string;
      subject: string | null;
      endedAt: string;
      durationValidSeconds: number;
      remainingSeconds: number;
      xpAwarded: number;
    };
    expect(result).toEqual(expect.objectContaining({
      id: started.id,
      state: 'stopped_early',
      subject: null,
      remainingSeconds: 0,
    }));
    expect(result.durationValidSeconds).toBeGreaterThanOrEqual(300);
    expect(result.xpAwarded).toBeGreaterThan(0);

    await expect(page.getByTestId('study-session-result')).toContainText('Sessão encerrada antecipadamente');
    await expect(page.getByTestId('study-session-result')).toContainText(`Foco válido: ${String(Math.floor(result.durationValidSeconds / 60)).padStart(2, '0')}:${String(result.durationValidSeconds % 60).padStart(2, '0')}`);
    await expect(page.getByTestId('study-session-result')).toContainText(`XP confirmado: ${result.xpAwarded}`);
    await page.getByRole('link', { name: 'Acampamento' }).click();
    await expect(page.getByTestId('dashboard-progression')).toContainText(`${result.xpAwarded} XP total`);
    const dashboardActivityItem = page.getByTestId('dashboard-activity').locator(
      '[aria-label^="Sessão: Encerrada antecipadamente · solo ·"]',
    );
    await expect(dashboardActivityItem).toHaveCount(1);
    await expect(dashboardActivityItem).toBeVisible();
    const expectedRecentLabel = await page.evaluate(({ endedAt, durationMinutes, xpAwarded }) => {
      const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(endedAt));
      return `Sessão: Encerrada antecipadamente · solo · ${date} · ${durationMinutes} min · ${xpAwarded} XP`;
    }, {
      endedAt: result.endedAt,
      durationMinutes: Math.floor(result.durationValidSeconds / 60),
      xpAwarded: result.xpAwarded,
    });
    await expect(dashboardActivityItem).toHaveAttribute('aria-label', expectedRecentLabel);
  });

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
      endedAt: string;
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
    const cancelledActivityItem = page.getByTestId('dashboard-activity').locator(
      '[aria-label^="Sessão: Cancelada · solo ·"]',
    );
    await expect(cancelledActivityItem).toHaveCount(1);
    await expect(cancelledActivityItem).toBeVisible();
    const expectedCancelledLabel = await page.evaluate(({ endedAt, duration, xpAwarded }) => {
      const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(endedAt));
      return `Sessão: Cancelada · solo · ${date} · ${duration} · ${xpAwarded} XP`;
    }, {
      endedAt: result.endedAt,
      duration: result.durationValidSeconds < 60
        ? `${Math.max(0, Math.floor(result.durationValidSeconds))} s`
        : `${Math.floor(result.durationValidSeconds / 60)} min`,
      xpAwarded: result.xpAwarded,
    });
    await expect(cancelledActivityItem).toHaveAttribute(
      'aria-label',
      expectedCancelledLabel,
    );
  });
});
