import { forSaleViolation, type SaleListing } from './for-sale';
import { parseUnlockCondition } from './unlock-condition';

const sellable: SaleListing = { category: 'accessory', forSale: true, price: 120, unlockCondition: 'purchase', requiresPremium: false };

describe('Cosmetic Item À venda (ADR-012)', () => {
  it('reads the purchase Condição de desbloqueio', () => {
    expect(parseUnlockCondition('purchase')).toEqual({ type: 'purchase' });
  });

  it('accepts a purchasable item priced from 30 to 300', () => {
    expect(forSaleViolation(sellable)).toBeNull();
    expect(forSaleViolation({ ...sellable, price: 30 })).toBeNull();
    expect(forSaleViolation({ ...sellable, price: 300 })).toBeNull();
  });

  it.each([29, 301, 0, 99.5, null])('rejects the price %s', (price) => {
    expect(forSaleViolation({ ...sellable, price })).not.toBeNull();
  });

  it.each(['raid:*', 'raid:vigilia-da-aurora', 'level:5', 'level:1'])(
    'rejects an item unlocked by %s: Recompensa de Raid and level items are never À venda',
    (unlockCondition) => {
      expect(forSaleViolation({ ...sellable, unlockCondition })).not.toBeNull();
    },
  );

  it('rejects an Item premium', () => {
    expect(forSaleViolation({ ...sellable, requiresPremium: true })).not.toBeNull();
  });

  it('rejects a premium item whatever its Condição de desbloqueio, and a Pacote item', () => {
    expect(forSaleViolation({ ...sellable, unlockCondition: 'level:1', requiresPremium: true })).not.toBeNull();
    expect(forSaleViolation({ ...sellable, unlockCondition: 'purchase', requiresPremium: true })).toBe('Item premium não pode estar À venda');
  });

  it('refuses a Pacote item for sale', () => {
    const reason = 'Só um item com Condição de desbloqueio de compra pode estar À venda';
    expect(forSaleViolation({ ...sellable, unlockCondition: 'pack:dragao' })).toBe(reason);
    expect(forSaleViolation({ ...sellable, unlockCondition: 'pack:dragao', requiresPremium: true })).toBe(reason);
  });

  it('rejects a Badge: the Badge is always earned, never À venda', () => {
    expect(forSaleViolation({ ...sellable, category: 'badge' })).not.toBeNull();
  });

  it.each(['avatar', 'title', 'accessory', 'weapon'] as const)('accepts a %s À venda', (category) => {
    expect(forSaleViolation({ ...sellable, category })).toBeNull();
  });

  it('puts no constraint on an item that is not À venda', () => {
    expect(forSaleViolation({ category: 'badge', forSale: false, price: null, unlockCondition: 'raid:*', requiresPremium: true })).toBeNull();
  });
});
