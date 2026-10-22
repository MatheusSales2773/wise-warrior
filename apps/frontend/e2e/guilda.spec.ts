import { expect, test } from '@playwright/test';
import { apiUrl, registerThroughUi } from './helpers/auth';
import { foundGuildThroughUi, openGuildOnPhone } from './helpers/guild';
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
    await foundGuildThroughUi(page, `Ordem E2E ${Date.now()}`);
    await expect(page.getByTestId('guild-mine')).toBeVisible();

    // 2. Ver a Raid: sem Participantes, o ranking convida a participar.
    await expect(page.getByTestId('guild-raid')).toBeVisible();
    await expect(page.getByTestId('guild-raid-boss-life')).toHaveAttribute('aria-label', /^Vida do dragão: 100%\./);
    await expect(page.getByTestId('guild-raid-join')).toBeVisible();
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
    await page.getByTestId('study-session-stop-confirm').click();
    const stopped = await (await stopResponse).json() as { xpAwarded: number };
    expect(stopped.xpAwarded).toBeGreaterThan(0);

    // 5. Voltar à Guilda: progresso, posição e Ranking interno refletem a Contribuição.
    await sidebar.getByRole('link', { name: 'Guilda' }).click();
    await expect(page.getByTestId('guild-raid-attack')).toBeVisible();
    await expect(page.getByTestId('guild-raid-my-contribution')).toHaveText(/^\d+,\dh · 1º lugar$/);
    await expect(page.getByTestId('guild-raid-boss-life')).toHaveAttribute('aria-label', /^Vida do dragão: \d+%\./);

    const rows = page.locator('[data-testid^="guild-ranking-item-"]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('1º');
    await expect(rows.first()).toContainText('Ana E2E (você)');
    await expect(rows.first()).toContainText(/\d+,\dh/);
    await expect(rows.first()).toHaveAttribute('aria-label', /^Posição 1: Ana E2E \(você\), nível \d+, Aprendiz, \d+,\dh de foco$/);

    // 6. A batalha (Figma 06b): o golpe aparece em horas de foco, e "Atacar com foco" abre a Forja em modo Guilda.
    await page.getByTestId('guild-raid-battle').click();
    await expect(page).toHaveURL(/\/guilda\/raid$/);
    await expect(page.getByTestId('raid-strikes').locator('[data-testid^="raid-strike-"]').first())
      .toHaveAttribute('aria-label', /^1º: você, \d+,\dh de foco$/);
    await expect(page.getByTestId('raid-boss-life')).toHaveAttribute('aria-label', /^Vida do dragão: \d+%\./);
    await page.getByRole('button', { name: /Atacar com foco/ }).click();
    await expect(page).toHaveURL(/\/sessao\?modo=guilda$/);
    await expect(page.getByTestId('study-session-mode-guild')).toHaveAttribute('aria-checked', 'true');
  });

  test('no celular: encontra a guilda na aba Procurar, busca pelo teclado e entra', async ({ browser }) => {
    const guildName = `Procurar E2E ${Date.now()}`;
    const leaderContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const leader = await leaderContext.newPage();
    const member = await memberContext.newPage();
    try {
      await registerThroughUi(leader, undefined, 'Ana Procurar');
      await leader.getByTestId('web-sidebar').getByRole('link', { name: 'Guilda' }).click();
      await foundGuildThroughUi(leader, guildName);
      await expect(leader.getByTestId('guild-mine')).toBeVisible();

      await registerThroughUi(member, undefined, 'Bruno Procurar');
      await openGuildOnPhone(member);

      // A aba Procurar abre primeiro, com a lista, o emblema e sem o botão "Buscar" (Figma 06d).
      await expect(member.getByRole('tab', { name: 'Procurar' })).toHaveAttribute('aria-selected', 'true');
      await expect(member.getByTestId('guild-directory')).toBeVisible();
      await expect(member.getByTestId('guild-directory-search-submit')).toHaveCount(0);
      await expect(member.locator('[data-testid^="guild-directory-item-"]').first()).toBeVisible();

      const search = member.getByLabel('Buscar por nome');
      await search.fill(guildName);
      await search.press('Enter');
      const row = member.getByRole('button', { name: `Entrar na guilda ${guildName}` });
      await expect(row).toBeVisible();
      await expect(member.locator('[data-testid^="guild-directory-item-"]')).toHaveCount(1);
      await expect(member.locator('[data-testid^="guild-directory-item-"]').first().getByTestId('guild-emblem')).toBeAttached();

      await row.click();
      await expect(member.getByTestId('guild-mine')).toBeVisible();
    } finally {
      await leaderContext.close();
      await memberContext.close();
    }
  });

  test('no celular: funda a guilda na aba Fundar, com contador e dica do nome', async ({ page }) => {
    await registerThroughUi(page, undefined, 'Carla Fundar');
    await openGuildOnPhone(page);

    await page.getByRole('tab', { name: 'Fundar' }).click();
    await expect(page.getByRole('tab', { name: 'Fundar' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('guild-how-it-works')).toBeVisible();
    const form = page.getByTestId('guild-create');
    await expect(form.getByText('3 a 60 caracteres')).toBeVisible();
    await expect(form.getByText('0 / 60')).toBeVisible();

    const name = `Fundar E2E ${Date.now()}`;
    await page.getByLabel('Nome da guilda').fill(name);
    await expect(form.getByText(`${name.length} / 60`)).toBeVisible();
    await page.getByRole('button', { name: 'Fundar guilda' }).click();
    await expect(page.getByTestId('guild-mine')).toBeVisible();
  });

  test('no celular: avisa quando o nome da guilda já existe, sem sair da aba Fundar', async ({ browser }) => {
    const guildName = `Repetida E2E ${Date.now()}`;
    const leaderContext = await browser.newContext();
    const otherContext = await browser.newContext();
    const leader = await leaderContext.newPage();
    const other = await otherContext.newPage();
    try {
      await registerThroughUi(leader, undefined, 'Ana Repetida');
      await leader.getByTestId('web-sidebar').getByRole('link', { name: 'Guilda' }).click();
      await foundGuildThroughUi(leader, guildName);
      await expect(leader.getByTestId('guild-mine')).toBeVisible();

      await registerThroughUi(other, undefined, 'Bia Repetida');
      await openGuildOnPhone(other);
      await other.getByRole('tab', { name: 'Fundar' }).click();
      await foundGuildThroughUi(other, guildName);

      await expect(other.getByTestId('guild-create-error')).toContainText('Já existe uma guilda com esse nome');
      await expect(other.getByRole('tab', { name: 'Fundar' })).toHaveAttribute('aria-selected', 'true');
    } finally {
      await leaderContext.close();
      await otherContext.close();
    }
  });
});
