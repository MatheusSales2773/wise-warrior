import { visiblePacks } from './packs';

describe('visiblePacks', () => {
  const pack = (id: string, name: string, forSale: boolean) => ({ id, name, forSale });

  it('lists the Pacotes for sale ordered by name, each with owned false when the user paid none', () => {
    // The ids sort the other way round, so ordering by id instead of name fails here.
    const packs = [pack('a', 'Pacote Zeta', true), pack('d', 'Pacote do Dragão', true), pack('z', 'Pacote Alfa', true)];

    expect(visiblePacks(packs, new Set())).toEqual([
      { id: 'z', name: 'Pacote Alfa', forSale: true, owned: false },
      { id: 'd', name: 'Pacote do Dragão', forSale: true, owned: false },
      { id: 'a', name: 'Pacote Zeta', forSale: true, owned: false },
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
