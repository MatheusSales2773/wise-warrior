import { expect, test } from '@playwright/test';
import { apiUrl, registerThroughUi } from './helpers/auth';

const isApi = (path: RegExp, method: string) => (response: { url(): string; request(): { method(): string } }) => {
  const url = new URL(response.url());
  return url.origin === new URL(apiUrl).origin && path.test(url.pathname) && response.request().method() === method;
};

test.describe('Mercado: bolsa, Loja e Extrato', () => {
  test('um novo usuário vê as 90 Moedas de boas-vindas, compra um item e encontra a Compra no Extrato', async ({ page }) => {
    await registerThroughUi(page);
    await page.getByTestId('web-sidebar').getByRole('link', { name: 'Mercado' }).click();
    await expect(page).toHaveURL(/\/mercado$/);
    await expect(page.getByTestId('market-balance')).toHaveText('90');

    // Itens: the first one the welcome Moedas cover. Prices come from the seeded catalog (#174), not from this test.
    await page.getByTestId('market-tab-itens').click();
    const affordable = page.locator('[data-testid^="market-item-"][aria-label$="Disponível para comprar."]').first();
    await expect(affordable).toBeVisible();
    const label = await affordable.getAttribute('aria-label');
    const [, name, price] = /^(.+), [^,]+\. (\d+) Moedas?\./.exec(label ?? '') ?? [];
    expect(name, `item label: ${label}`).toBeTruthy();
    await affordable.click();

    await page.getByTestId('market-item-preview-buy').click();
    await expect(page.getByRole('dialog', { name: `Confirmar compra de ${name}` })).toBeVisible();
    const bought = page.waitForResponse(isApi(/\/shop\/items\/[^/]+\/purchase$/, 'POST'));
    await page.getByTestId('purchase-confirm').click();
    const purchase = await (await bought).json() as { balance: number; price: number };
    expect(purchase.price).toBe(Number(price));

    await expect(page.getByTestId('purchase-done-title')).toHaveText(`${name} é seu`);
    await expect(page.getByTestId('market-balance')).toHaveText(String(purchase.balance));
    await page.getByTestId('purchase-close').click();
    await expect(page.locator(`[data-testid^="market-item-"][aria-label^="${name},"]`).first()).toHaveAttribute('aria-label', /No seu Inventário\.$/);

    // Extrato: the Compra on top of the welcome credit, each with the balance after it.
    await page.getByTestId('market-statement-link').click();
    await expect(page).toHaveURL(/\/mercado\/extrato$/);
    await expect(page.getByTestId('statement-balance')).toHaveText(String(purchase.balance));
    const ledger = page.getByTestId('statement-ledger');
    await expect(ledger.getByText(`Compra · ${name}`)).toBeVisible();
    await expect(ledger.getByText(`−${price}`)).toBeVisible();
    await expect(ledger.getByText('Moedas de boas-vindas')).toBeVisible();
    await expect(ledger.getByText('+90')).toBeVisible();
  });
});
