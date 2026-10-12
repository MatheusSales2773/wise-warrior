import { expect, test } from '@playwright/test';
import { apiUrl, registerThroughUi } from './helpers/auth';
import { backdateStudySessionForE2e } from './helpers/study-session';

const isApi = (path: string, method: string) => (response: { url(): string; request(): { method(): string } }) => {
  const url = new URL(response.url());
  return url.origin === new URL(apiUrl).origin && url.pathname.endsWith(path) && response.request().method() === method;
};

test.describe('Guilda web', () => {
  test('cria a guilda, participa pela Forja, conclui a sessão e vê o progresso e o Ranking interno', async ({ page }) => {
    await registerThroughUi(page, undefined, 'Ana E2E');
    // O atalho "Guilda" do Acampamento repete o nome do link: a navegação usa só a barra lateral.
    const sidebar = page.getByTestId('web-sidebar');

    // 1. Criar a Guild: a Raid da semana nasce com ela.
    await sidebar.getByRole('link', { name: 'Guilda' }).click();
    await page.getByLabel('Nome da guilda').fill(`Ordem E2E ${Date.now()}`);
    await page.getByRole('button', { name: 'Criar guilda' }).click();
    await expect(page.getByTestId('guild-mine')).toBeVisible();

    // 2. Ver a Raid: sem Participantes, o ranking convida a participar.
    await expect(page.getByTestId('guild-raid')).toBeVisible();
    await expect(page.getByTestId('guild-raid-progress')).toHaveAttribute('aria-label', /Progresso da Raid: 0 de \d+ XP/);
    await expect(page.getByTestId('guild-ranking-empty')).toBeVisible();

    // 3. "Participar e iniciar" na Forja, com uma sessão de guilda.
    await sidebar.getByRole('link', { name: 'Forja' }).click();
    await expect(page.getByTestId('study-session-setup')).toBeVisible();
    await page.getByTestId('study-session-mode-guild').click();
    const startResponse = page.waitForResponse(isApi('/sessions', 'POST'));
    await page.getByRole('button', { name: 'Participar e iniciar' }).click();
    const started = await (await startResponse).json() as { id: string; mode: string };
    expect(started.mode).toBe('guild');
    await backdateStudySessionForE2e(started.id);

    // 4. Concluir a sessão: a Contribuição entra na Raid.
    await page.reload();
    const stopResponse = page.waitForResponse(isApi('/stop', 'POST'));
    await page.getByRole('button', { name: 'Encerrar antecipadamente' }).click();
    const stopped = await (await stopResponse).json() as { xpAwarded: number };
    expect(stopped.xpAwarded).toBeGreaterThan(0);

    // 5. Voltar à Guilda: progresso, posição e Ranking interno refletem a Contribuição.
    await sidebar.getByRole('link', { name: 'Guilda' }).click();
    await expect(page.getByTestId('guild-raid-participating')).toBeVisible();
    await expect(page.getByTestId('guild-raid-my-contribution')).toHaveText(`Sua contribuição: ${stopped.xpAwarded} XP`);
    await expect(page.getByTestId('guild-raid-progress')).toHaveAttribute('aria-label', new RegExp(`Progresso da Raid: ${stopped.xpAwarded} de \\d+ XP`));
    await expect(page.getByTestId('guild-raid-my-position')).toHaveText('Sua posição: 1º no Ranking interno');

    const rows = page.locator('[data-testid^="guild-ranking-item-"]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('1º');
    await expect(rows.first()).toContainText('Ana E2E (você)');
    await expect(rows.first()).toContainText(`${stopped.xpAwarded} XP`);
    await expect(rows.first()).toHaveAccessibleName(new RegExp(`^Posição 1: Ana E2E \\(você\\), nível \\d+, Aprendiz, ${stopped.xpAwarded} XP$`));
  });
});
