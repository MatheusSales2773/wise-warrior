import { bottomBarDestinations, destinations, isDestinationActive, moreMenuDestinations, primaryDestinations, futureDestinations } from '@/design-system/navigation/destinations';

describe('navigation catalog', () => {
  it('defines the six real routes and exact Ionicon states once', () => {
    expect(destinations).toEqual([
      { label: 'Acampamento', href: '/', inactiveIcon: 'home-outline', activeIcon: 'home', available: true, position: 0, compact: 'bar' },
      { label: 'Forja', href: '/sessao', inactiveIcon: 'hammer-outline', activeIcon: 'hammer', available: true, position: 1, compact: 'bar' },
      { label: 'Personagem', href: '/perfil', inactiveIcon: 'person-outline', activeIcon: 'person', available: true, position: 2, compact: 'bar' },
      { label: 'Guilda', href: '/guilda', inactiveIcon: 'shield-outline', activeIcon: 'shield', available: true, position: 3, compact: 'bar' },
      { label: 'Mercado', href: '/mercado', inactiveIcon: 'storefront-outline', activeIcon: 'storefront', available: true, position: 4, compact: 'more' },
      { label: 'Crônicas', href: null, inactiveIcon: null, activeIcon: null, available: false, position: 5 },
      { label: 'Configuração', href: '/configuracao', inactiveIcon: 'settings-outline', activeIcon: 'settings', available: true, position: 6, compact: 'more' },
    ]);
    expect(primaryDestinations).toHaveLength(6);
    expect(futureDestinations).toHaveLength(1);
    // Phones keep four destinations in the bar; the Mercado and the Configuração live in "Mais".
    expect(bottomBarDestinations.map(({ label }) => label)).toEqual(['Acampamento', 'Forja', 'Personagem', 'Guilda']);
    expect(moreMenuDestinations.map(({ label }) => label)).toEqual(['Mercado', 'Configuração']);
  });

  it.each([
    ['/', 'Acampamento'],
    ['/sessao', 'Forja'],
    ['/sessao/ativa', 'Forja'],
    ['/perfil', 'Personagem'],
    ['/guilda/membros', 'Guilda'],
    ['/mercado', 'Mercado'],
    ['/mercado/extrato', 'Mercado'],
    ['/configuracao', 'Configuração'],
    ['/configuracao/foco', 'Configuração'],
  ])('selects exactly one destination for %s', (pathname, label) => {
    expect(primaryDestinations.filter((destination) => isDestinationActive(destination, pathname)).map(({ label: value }) => value)).toEqual([label]);
  });

  it.each(['/outra', '/sessaoinvalida', '/perfilado', '/guildados', '/mercadoria', '/configuracaox'])('does not use partial segment matches for %s', (pathname) => {
    expect(primaryDestinations.some((destination) => isDestinationActive(destination, pathname))).toBe(false);
  });
});
