import { type Page } from '@playwright/test';

/** Shrinks the window to a phone and opens "Guilda" from the bottom navigation. */
export async function openGuildOnPhone(page: Page): Promise<void> {
  // O cadastro espera a barra lateral do desktop; a tela encolhe para o celular depois.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('mobile-navigation').getByRole('link', { name: 'Guilda' }).click();
}

/** Fills the "Nome da guilda" field and founds the Guild; the Fundar tab must already be open on a phone. */
export async function foundGuildThroughUi(page: Page, name: string): Promise<void> {
  await page.getByLabel('Nome da guilda').fill(name);
  await page.getByRole('button', { name: 'Fundar guilda' }).click();
}
