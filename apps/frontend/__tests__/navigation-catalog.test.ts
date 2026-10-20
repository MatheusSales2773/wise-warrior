import { bottomBarDestinations, destinations, isDestinationActive, moreMenuDestinations, primaryDestinations, futureDestinations } from '@/design-system/navigation/destinations';

describe('navigation catalog', () => {
  it('defines the five real routes and exact Ionicon states once', () => {
    expect(destinations).toEqual([
      { label: 'Acampamento', href: '/', inactiveIcon: 'home-outline', activeIcon: 'home', available: true, position: 0, compact: 'bar' },
      { label: 'Forja', href: '/sessao', inactiveIcon: 'hammer-outline', activeIcon: 'hammer', available: true, position: 1, compact: 'bar' },
      { label: 'Personagem', href: '/perfil', inactiveIcon: 'person-outline', activeIcon: 'person', available: true, position: 2, compact: 'bar' },
      { label: 'Guilda', href: '/guilda', inactiveIcon: 'shield-outline', activeIcon: 'shield', available: true, position: 3, compact: 'bar' },
      { label: 'Mercado', href: '/mercado', inactiveIcon: 'storefront-outline', activeIcon: 'storefront', available: true, position: 4, compact: 'more' },
      { label: 'Crônicas', href: null, inactiveIcon: null, activeIcon: null, available: false, position: 5 },
      { label: 'Configuração', href: null, inactiveIcon: null, activeIcon: null, available: false, position: 6 },
    ]);
    expect(primaryDestinations).toHaveLength(5);
    expect(futureDestinations).toHaveLength(2);
    // Phones keep four destinations in the bar; the Mercado lives in "Mais".
    expect(bottomBarDestinations.map(({ label }) => label)).toEqual(['Acampamento', 'Forja', 'Personagem', 'Guilda']);
    expect(moreMenuDestinations.map(({ label }) => label)).toEqual(['Mercado']);
  });

  it.each([
    ['/', 'Acampamento'],
    ['/sessao', 'Forja'],
    ['/sessao/ativa', 'Forja'],
    ['/perfil', 'Personagem'],
    ['/guilda/membros', 'Guilda'],
    ['/mercado', 'Mercado'],
    ['/mercado/extrato', 'Mercado'],
  ])('selects exactly one destination for %s', (pathname, label) => {
    expect(primaryDestinations.filter((destination) => isDestinationActive(destination, pathname)).map(({ label: value }) => value)).toEqual([label]);
  });

  it.each(['/outra', '/sessaoinvalida', '/perfilado', '/guildados', '/mercadoria'])('does not use partial segment matches for %s', (pathname) => {
    expect(primaryDestinations.some((destination) => isDestinationActive(destination, pathname))).toBe(false);
  });
});
