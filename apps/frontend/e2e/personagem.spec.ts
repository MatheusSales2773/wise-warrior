import { expect, test } from '@playwright/test';
import { registerThroughUi } from './helpers/auth';

test.describe('personagem', () => {
  test('equipa um Título, recarrega a página e vê o Título no painel', async ({ page }) => {
    await registerThroughUi(page);
    await page.goto('/perfil');

    // Um novo Character começa com o Título inicial equipado; desequipar deixa o painel sem banner.
    const banner = page.getByTestId('profile-title-banner');
    await expect(banner).toContainText('Aprendiz');
    await page.getByRole('button', { name: /^Aprendiz,/ }).click();
    await page.getByRole('button', { name: 'Desequipar Aprendiz' }).click();
    await expect(banner).toHaveCount(0);

    // A Prévia aparece no painel sem salvar; Equipar confirma.
    await page.getByRole('button', { name: /^Aprendiz,/ }).click();
    await expect(banner).toContainText('Aprendiz');
    await expect(page.getByTestId('profile-preview-badge')).toBeVisible();
    await page.getByRole('button', { name: 'Equipar Aprendiz' }).click();
    await expect(page.getByRole('button', { name: 'Aprendiz, equipado' })).toBeVisible();

    await page.reload();

    await expect(page.getByTestId('profile-title-banner')).toContainText('Aprendiz');
    await expect(page.getByRole('button', { name: 'Aprendiz, equipado' })).toBeVisible();
  });
});
