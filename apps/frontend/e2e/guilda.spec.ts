import { expect, test } from '@playwright/test';
import mysql from 'mysql2/promise';
import type { ResultSetHeader } from 'mysql2/promise';
import { apiPost, apiUrl, registerThroughUi } from './helpers/auth';

/** Moves the running Study Session five minutes back, so stopping it earns XP without waiting in the test. */
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
           run_deadline_at = DATE_ADD(DATE_SUB(NOW(3), INTERVAL 300 SECOND), INTERVAL planned_duration_seconds SECOND)
       WHERE id = ? AND state = 'running'`,
      [studySessionId],
    );
    if (result.affectedRows !== 1) throw new Error('Could not prepare the E2E Study Session');
  } finally {
    await connection.end();
  }
}

test.describe('Guilda web', () => {
  test('cria a Guild, vê a Raid, participa e inicia na Forja, conclui e vê o progresso e o Ranking interno', async ({ page }) => {
    const guildName = `Ordem E2E ${Date.now().toString(36)}`;
    await registerThroughUi(page, undefined, 'Guerreira da Raid');

    await page.getByTestId('web-sidebar').getByRole('link', { name: 'Guilda', exact: true }).click();
    await page.getByLabel('Nome da guilda').fill(guildName);
    await Promise.all([
      page.waitForResponse(apiPost('/guilds')),
      page.getByRole('button', { name: 'Criar guilda' }).click(),
    ]);
    await expect(page.getByTestId('guild-mine-name')).toHaveText(guildName);
    const raidCard = page.getByTestId('guild-raid');
    await expect(raidCard).toContainText('RECOMPENSA DE RAID');
    await expect(page.getByRole('button', { name: 'Participar' })).toBeVisible();
    await expect(page.getByTestId('guild-ranking-empty')).toBeVisible();

    await page.getByRole('link', { name: 'Forja' }).click();
    await page.getByRole('radio', { name: 'Sessão de guilda' }).click();
    const apiPath = new URL(apiUrl).pathname.replace(/\/+$/, '');
    const startResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname === `${apiPath}/sessions` && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Participar e iniciar' }).click();
    const startResponse = await startResponsePromise;
    expect(startResponse.status()).toBe(201);
    const started = await startResponse.json() as { id: string; mode: string; raidId: string | null };
    expect(started).toMatchObject({ mode: 'guild', raidId: expect.any(String) });
    await backdateStudySessionForE2e(started.id);

    await page.reload();
    const stopResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith('/stop') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Encerrar antecipadamente' }).click();
    const stopResponse = await stopResponsePromise;
    expect(stopResponse.status()).toBe(200);
    const { xpAwarded } = await stopResponse.json() as { xpAwarded: number };
    expect(xpAwarded).toBeGreaterThan(0);

    await page.getByTestId('web-sidebar').getByRole('link', { name: 'Guilda', exact: true }).click();
    await expect(raidCard).toContainText(new RegExp(`${xpAwarded} / \\d+ XP`));
    await expect(page.getByTestId('guild-raid-participating')).toHaveText('Você está nesta Raid');
    await expect(page.getByTestId('guild-raid-my-position')).toHaveText('Sua posição no ranking: 1º');
    const ownRow = page.getByTestId('guild-ranking').getByLabel(/^1º lugar: Você, Guerreira da Raid/);
    await expect(ownRow).toContainText(`${xpAwarded} XP`);
    await expect(ownRow).toContainText('Guerreira da Raid (você)');
    await expect(page.getByTestId('guild-past-raids-empty')).toBeVisible();
  });

  test('mostra o progresso da Raid a outro membro com a tela Guilda aberta, sem recarregar (UC02 RE01)', async ({ browser, page }) => {
    const guildName = `Vigia E2E ${Date.now().toString(36)}`;
    await registerThroughUi(page, undefined, 'Fundadora');
    const sidebarLink = (target: typeof page, name: string) =>
      target.getByTestId('web-sidebar').getByRole('link', { name, exact: true });
    await sidebarLink(page, 'Guilda').click();
    await page.getByLabel('Nome da guilda').fill(guildName);
    await page.getByRole('button', { name: 'Criar guilda' }).click();
    await expect(page.getByTestId('guild-mine-name')).toHaveText(guildName);

    const watcherContext = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
      const watcher = await watcherContext.newPage();
      await registerThroughUi(watcher, undefined, 'Sentinela');
      await sidebarLink(watcher, 'Guilda').click();
      await watcher.getByLabel('Buscar por nome').fill(guildName);
      await watcher.getByRole('button', { name: 'Buscar', exact: true }).click();
      await watcher.getByRole('button', { name: `Entrar na guilda ${guildName}` }).click();
      await expect(watcher.getByTestId('guild-mine-name')).toHaveText(guildName);
      await expect(watcher.getByTestId('guild-raid')).toContainText(/\b0 \/ \d+ XP/);

      await sidebarLink(page, 'Forja').click();
      await page.getByRole('radio', { name: 'Sessão de guilda' }).click();
      const startResponse = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith('/sessions') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Participar e iniciar' }).click();
      const started = await (await startResponse).json() as { id: string };
      await backdateStudySessionForE2e(started.id);
      await page.reload();
      const stopResponse = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith('/stop') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Encerrar antecipadamente' }).click();
      const { xpAwarded } = await (await stopResponse).json() as { xpAwarded: number };

      // The watcher never reloads: `raid:progress` updates the Raid and the Ranking interno.
      await expect(watcher.getByTestId('guild-raid')).toContainText(new RegExp(`\\b${xpAwarded} / \\d+ XP`));
      await expect(watcher.getByTestId('guild-ranking').getByLabel(/^1º lugar: Fundadora/)).toContainText(`${xpAwarded} XP`);
    } finally {
      await watcherContext.close();
    }
  });
});
