import { visiblePacks } from './packs';

describe('visiblePacks', () => {
  const pack = (id: string, name: string, forSale: boolean) => ({ id, name, forSale });

  it('lists the Pacotes for sale ordered by name, each with owned false when the user paid none', () => {
    const packs = [pack('z', 'Pacote Zeta', true), pack('d', 'Pacote do Dragão', true), pack('a', 'Pacote Alfa', true)];

    expect(visiblePacks(packs, new Set())).toEqual([
      { id: 'a', name: 'Pacote Alfa', forSale: true, owned: false },
      { id: 'd', name: 'Pacote do Dragão', forSale: true, owned: false },
      { id: 'z', name: 'Pacote Zeta', forSale: true, owned: false },
    ]);
  });

  it('marks owned only the Pacote the user paid', () => {
    const packs = [pack('d', 'Pacote do Dragão', true), pack('a', 'Pacote Alfa', true)];

    expect(visiblePacks(packs, new Set(['d'])).map(({ id, owned }) => [id, owned])).toEqual([['a', false], ['d', true]]);
  });

  it('keeps a paid Pacote that left the shelf, owned, and drops an unpaid one off the shelf', () => {
    const packs = [pack('paid', 'Pacote Pago', false), pack('unpaid', 'Pacote Antigo', false), pack('d', 'Pacote do Dragão', true)];

    expect(visiblePacks(packs, new Set(['paid'])).map(({ id, owned }) => [id, owned])).toEqual([['d', false], ['paid', true]]);
  });
});
