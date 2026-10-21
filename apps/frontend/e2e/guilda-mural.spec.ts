import { expect, test } from '@playwright/test';
import { registerThroughUi } from './helpers/auth';
import { foundGuildThroughUi, openGuildOnPhone } from './helpers/guild';

test.describe('Mural da Guilda web', () => {
  test('dois membros: um envia, o outro recebe em tempo real e vê o "N online" mudar', async ({ browser }) => {
    const guildName = `Mural E2E ${Date.now()}`;
    const anaContext = await browser.newContext();
    const brunoContext = await browser.newContext();
    const ana = await anaContext.newPage();
    const bruno = await brunoContext.newPage();

    try {
      // 1. Ana funda a Guild e abre o Mural: só ela está online.
      await registerThroughUi(ana, undefined, 'Ana Mural');
      await ana.getByTestId('web-sidebar').getByRole('link', { name: 'Guilda' }).click();
      await foundGuildThroughUi(ana, guildName);
      await expect(ana.getByTestId('guild-online-count')).toHaveText('1 online');
      // No desktop o Mural fica na coluna lateral, sem abas.
      await expect(ana.getByTestId('guild-mural-empty')).toBeVisible();

      // 2. Bruno entra na mesma Guild: o "N online" da Ana sobe sem recarregar.
      await registerThroughUi(bruno, undefined, 'Bruno Mural');
      await bruno.getByTestId('web-sidebar').getByRole('link', { name: 'Guilda' }).click();
      await bruno.getByLabel('Buscar por nome').fill(guildName);
      await bruno.getByRole('button', { name: 'Buscar' }).click();
      await bruno.getByRole('button', { name: `Entrar na guilda ${guildName}` }).click();
      await expect(bruno.getByTestId('guild-online-count')).toHaveText('2 online');
      await expect(ana.getByTestId('guild-online-count')).toHaveText('2 online');

      // 3. Bruno escreve no Mural; a mensagem chega na Ana em tempo real.
      await bruno.getByLabel('Mensagem para a guilda').fill('Bora estudar, Ana?');
      await bruno.getByRole('button', { name: 'Enviar' }).click();
      await expect(bruno.getByTestId('guild-mural-messages')).toContainText('Bora estudar, Ana?');
      await expect(ana.getByTestId('guild-mural-messages')).toContainText('Bruno Mural');
      await expect(ana.getByTestId('guild-mural-messages')).toContainText('Bora estudar, Ana?');

      // 4. Bruno sai: a Ana volta a ver só ela online.
      await brunoContext.close();
      await expect(ana.getByTestId('guild-online-count')).toHaveText('1 online');
    } finally {
      await anaContext.close();
      await brunoContext.close().catch(() => undefined);
    }
  });

  test('no mobile: navega pelas quatro abas e o Mural segue conectado', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await registerThroughUi(page, undefined, 'Ana Mobile');
      await openGuildOnPhone(page);
      // No celular a tela sem guilda abre em "Procurar": a fundação fica na aba "Fundar".
      await page.getByRole('tab', { name: 'Fundar' }).click();
      await foundGuildThroughUi(page, `Abas E2E ${Date.now()}`);
      await expect(page.getByTestId('guild-online-count')).toHaveText('1 online');

      await expect(page.getByRole('tab', { name: 'Raid' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('guild-raid')).toBeVisible();

      await page.getByRole('tab', { name: 'Mural' }).click();
      await expect(page.getByTestId('guild-mural-empty')).toBeVisible();
      await expect(page.getByTestId('guild-raid')).toHaveCount(0);
      await page.getByLabel('Mensagem para a guilda').fill('Olá do celular');
      await page.getByRole('button', { name: 'Enviar' }).click();
      await expect(page.getByTestId('guild-mural-messages')).toContainText('Olá do celular');

      await page.getByRole('tab', { name: 'Membros' }).click();
      await expect(page.getByTestId('guild-members')).toBeVisible();
      await page.getByRole('tab', { name: 'Histórico' }).click();
      await expect(page.getByTestId('guild-past-raids')).toBeVisible();

      // Voltar ao Mural: a conexão continua, sem tela de reconexão.
      await page.getByRole('tab', { name: 'Mural' }).click();
      await expect(page.getByTestId('guild-mural-messages')).toContainText('Olá do celular');
      await expect(page.getByTestId('guild-mural-reconnecting')).toHaveCount(0);
      await expect(page.getByTestId('guild-online-count')).toHaveText('1 online');
    } finally {
      await context.close();
    }
  });
});
