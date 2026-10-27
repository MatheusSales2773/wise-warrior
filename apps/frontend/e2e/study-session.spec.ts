import { expect, test } from '@playwright/test';
import { apiUrl, registerThroughUi } from './helpers/auth';
import { backdateStudySessionForE2e, expireStudySessionForE2e } from './helpers/study-session';

test.describe('Forja web', () => {
  test('inicia com Matéria, pausa, retoma, encerra com XP e atualiza o Dashboard com a resposta do servidor', async ({ page }) => {
    await registerThroughUi(page);
    await page.getByRole('link', { name: 'Forja' }).click();
    await expect(page.getByTestId('study-session-setup')).toBeVisible();
    await expect(page.getByRole('radio', { name: '25 minutos' })).toBeChecked();
    await page.getByRole('radio', { name: '15 minutos' }).click();
    await expect(page.getByRole('radio', { name: '15 minutos' })).toBeChecked();
    await expect(page.getByLabel('Matéria')).toHaveValue('');
    await page.getByLabel('Matéria').fill('  Cálculo   II ');

    const apiPath = new URL(apiUrl).pathname.replace(/\/+$/, '');
    const startResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).origin === new URL(apiUrl).origin
      && new URL(response.url()).pathname === `${apiPath}/sessions`
      && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Iniciar foco' }).click();
    const startResponse = await startResponsePromise;
    expect(startResponse.status()).toBe(201);
    const started = await startResponse.json() as { id: string; plannedDurationSeconds: number; subject: string | null };
    expect(started.plannedDurationSeconds).toBe(900);
    expect(started.subject).toBe('Cálculo II');
    await backdateStudySessionForE2e(started.id);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Pausar sessão' })).toBeVisible();
    await expect(page.getByTestId('study-session-subject')).toHaveText('Cálculo II');
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
    await expect(page.getByTestId('study-session-pause-count')).toHaveText(/Pausas\s*1/);

    const stopResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).origin === new URL(apiUrl).origin
      && new URL(response.url()).pathname.endsWith('/stop')
      && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Encerrar antecipadamente' }).click();
    await page.getByTestId('study-session-stop-confirm').click();
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
      subject: 'Cálculo II',
      remainingSeconds: 0,
    }));
    expect(result.durationValidSeconds).toBeGreaterThanOrEqual(300);
    expect(result.xpAwarded).toBeGreaterThan(0);

    const resultStage = page.getByTestId('study-session-result');
    const resultCard = page.getByTestId('study-session-result-card');
    await expect(resultCard).toContainText('Sessão encerrada antecipadamente');
    await expect(page.getByTestId('study-session-result-subject')).toHaveText('Cálculo II');
    await expect(page.getByTestId('study-session-result-valid-focus')).toHaveText(`${String(Math.floor(result.durationValidSeconds / 60)).padStart(2, '0')}:${String(result.durationValidSeconds % 60).padStart(2, '0')}`);
    await expect(page.getByTestId('study-session-pause-count')).toHaveText(/Pausas\s*1/);
    await expect(page.getByTestId('study-session-summary-xp')).toContainText(`+${result.xpAwarded} XP`);
    await expect(resultStage).toContainText('confirmado');
    await expect(resultCard.getByRole('button', { name: /Iniciar pausa/ })).toHaveCount(0);
    await page.getByRole('link', { name: 'Acampamento' }).click();
    await expect(page.getByTestId('dashboard-progression')).toContainText(`${result.xpAwarded} XP total`);
    const dashboardActivityItem = page.getByTestId('dashboard-activity').locator(
      '[aria-label^="Sessão: Cálculo II · Encerrada antecipadamente · solo ·"]',
    );
    await expect(dashboardActivityItem).toHaveCount(1);
    await expect(dashboardActivityItem).toBeVisible();
    const expectedRecentLabel = await page.evaluate(({ endedAt, durationMinutes, xpAwarded }) => {
      const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(endedAt));
      return `Sessão: Cálculo II · Encerrada antecipadamente · solo · ${date} · ${durationMinutes} min · ${xpAwarded} XP`;
    }, {
      endedAt: result.endedAt,
      durationMinutes: Math.floor(result.durationValidSeconds / 60),
      xpAwarded: result.xpAwarded,
    });
    await expect(dashboardActivityItem).toHaveAttribute('aria-label', expectedRecentLabel);
    await expect(page.getByTestId('dashboard-activity')).toContainText('Cálculo II');
  });

  test('conclui a sessão no prazo, mostra o Resultado v2 e leva à Pausa Pomodoro', async ({ page }) => {
    const isApi = (path: string, method: string) => (response: { url(): string; request(): { method(): string } }) => {
      const url = new URL(response.url());
      return url.origin === new URL(apiUrl).origin && url.pathname.endsWith(path) && response.request().method() === method;
    };
    await registerThroughUi(page);
    await page.getByRole('link', { name: 'Forja' }).click();
    await expect(page.getByTestId('study-session-setup')).toBeVisible();
    await page.getByRole('radio', { name: '15 minutos' }).click();
    await page.getByLabel('Matéria').fill('Álgebra');

    const startResponse = page.waitForResponse(isApi('/sessions', 'POST'));
    await page.getByRole('button', { name: 'Iniciar foco' }).click();
    const started = await (await startResponse).json() as { id: string };

    await page.getByRole('button', { name: 'Pausar sessão' }).click();
    await page.getByRole('button', { name: 'Retomar sessão' }).click();
    await expect(page.getByRole('button', { name: 'Pausar sessão' })).toBeVisible();
    await expect(page.getByTestId('study-session-pause-count')).toHaveText(/Pausas\s*1/);

    // O relógio chega a zero: a leitura da sessão ativa conclui o foco no servidor.
    await expireStudySessionForE2e(started.id);
    const completionRead = page.waitForResponse(isApi('/sessions/active', 'GET'));
    await page.reload();
    const completed = await (await completionRead).json() as { state: string; durationValidSeconds: number; xpAwarded: number };
    expect(completed.state).toBe('completed');
    expect(completed.xpAwarded).toBeGreaterThan(0);

    // Resultado: anel fechado, foco válido e XP confirmados, e o card com a oferta de pausa.
    const resultCard = page.getByTestId('study-session-result-card');
    await expect(resultCard).toContainText('Sessão concluída');
    await expect(page.getByText('◈ Sessão concluída ◈')).toBeVisible();
    const validFocus = `${String(Math.floor(completed.durationValidSeconds / 60)).padStart(2, '0')}:${String(completed.durationValidSeconds % 60).padStart(2, '0')}`;
    await expect(page.getByTestId('study-session-result-timer')).toHaveText(validFocus);
    await expect(page.getByTestId('study-session-result-valid-focus')).toHaveText(validFocus);
    await expect(page.getByTestId('study-session-result-subject')).toHaveText('Álgebra');
    await expect(page.getByTestId('study-session-pause-count')).toHaveText(/Pausas\s*1/);
    await expect(page.getByTestId('study-session-summary-xp')).toContainText(`+${completed.xpAwarded} XP`);
    await expect(resultCard.getByText('Forja 1 de 4')).toBeVisible();
    await expect(resultCard.getByText('Pausa curta de 5 minutos. Não concede XP.')).toBeVisible();
    await expect(resultCard.getByRole('button', { name: 'Nova sessão' })).toBeVisible();

    // Pausa Pomodoro: contagem sem XP, card "Hora de descansar" com a sessão anterior.
    await resultCard.getByRole('button', { name: 'Iniciar pausa curta' }).click();
    await expect(page.getByTestId('study-session-break')).toBeVisible();
    await expect(page.getByText('◈ PAUSA CURTA ◈')).toBeVisible();
    await expect(page.getByTestId('study-session-break-timer')).toHaveText(/^0[45]:\d\d$/);
    await expect(page.getByText('restantes · 5 min · sem XP')).toBeVisible();
    const breakCard = page.getByTestId('study-session-break-card');
    await expect(breakCard).toContainText('Hora de descansar');
    await expect(breakCard).toContainText('FORJA 1 DE 4');
    await expect(breakCard).toContainText('Álgebra');
    await expect(breakCard).toContainText(`+${completed.xpAwarded}`);

    await breakCard.getByRole('button', { name: 'Pular pausa' }).click();
    await expect(page.getByTestId('study-session-setup')).toBeVisible();
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
    await page.getByTestId('study-session-stop-confirm').click();
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

    await expect(page.getByTestId('study-session-result-card')).toContainText('Sessão cancelada');
    await expect(page.getByTestId('study-session-result-subject')).toHaveText('Sem matéria');
    await expect(page.getByTestId('study-session-summary-xp')).toContainText('+0 XP');
    await expect(page.getByRole('button', { name: 'Nova sessão' })).toBeVisible();
    await page.getByRole('link', { name: 'Acampamento' }).click();
    await expect(page.getByTestId('dashboard-progression')).toContainText('0 XP total');
    const cancelledActivityItem = page.getByTestId('dashboard-activity').locator(
      '[aria-label^="Sessão: Sem matéria · Cancelada · solo ·"]',
    );
    await expect(cancelledActivityItem).toHaveCount(1);
    await expect(cancelledActivityItem).toBeVisible();
    const expectedCancelledLabel = await page.evaluate(({ endedAt, duration, xpAwarded }) => {
      const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(endedAt));
      return `Sessão: Sem matéria · Cancelada · solo · ${date} · ${duration} · ${xpAwarded} XP`;
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
