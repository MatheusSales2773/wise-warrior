import { expect, test } from '@playwright/test';
import { registerThroughUi } from './helpers/auth';

test.describe('personagem', () => {
  test('equipa um Título, recarrega a página e vê o Título no painel', async ({ page }) => {
    await registerThroughUi(page);
    await page.goto('/perfil');

    // Um novo Character começa com o Título inicial equipado; desequipar esvazia o slot.
    const titleSlot = page.getByTestId('character-slot-title');
    await expect(titleSlot).toHaveAccessibleName('Título: Aprendiz');
    await titleSlot.click();
    await page.getByRole('button', { name: 'Desequipar Aprendiz' }).click();
    await expect(titleSlot).toHaveAccessibleName('Título: vazio. Equipar título');

    // A Prévia aparece no painel sem salvar; Equipar confirma.
    await titleSlot.click();
    await page.getByRole('radio', { name: /^Aprendiz,/ }).click();
    await expect(page.getByTestId('character-identity')).toContainText('Aprendiz');
    await expect(page.getByTestId('character-preview')).toBeVisible();
    await page.getByRole('button', { name: 'Equipar título' }).click();
    await expect(page.getByTestId('equipment-drawer')).toHaveCount(0);
    await expect(titleSlot).toHaveAccessibleName('Título: Aprendiz');

    await page.reload();

    await expect(page.getByTestId('character-slot-title')).toHaveAccessibleName('Título: Aprendiz');
    await expect(page.getByTestId('character-identity')).toContainText('Aprendiz');
  });
});
