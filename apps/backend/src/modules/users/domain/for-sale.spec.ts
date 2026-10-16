import { forSaleViolation, type SaleListing } from './for-sale';
import { parseUnlockCondition } from './unlock-condition';

const sellable: SaleListing = { forSale: true, price: 120, unlockCondition: 'purchase', requiresPremium: false };

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

  it('puts no constraint on an item that is not À venda', () => {
    expect(forSaleViolation({ forSale: false, price: null, unlockCondition: 'raid:*', requiresPremium: true })).toBeNull();
  });
});
