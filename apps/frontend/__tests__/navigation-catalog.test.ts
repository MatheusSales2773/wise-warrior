import { destinations, isDestinationActive, primaryDestinations, futureDestinations } from '@/design-system/navigation/destinations';

describe('navigation catalog', () => {
  it('defines the four real routes and exact Ionicon states once', () => {
    expect(destinations).toEqual([
      { label: 'Acampamento', href: '/', inactiveIcon: 'home-outline', activeIcon: 'home', available: true, position: 0 },
      { label: 'Forja', href: '/sessao', inactiveIcon: 'hammer-outline', activeIcon: 'hammer', available: true, position: 1 },
      { label: 'Personagem', href: '/perfil', inactiveIcon: 'person-outline', activeIcon: 'person', available: true, position: 2 },
      { label: 'Guilda', href: '/guilda', inactiveIcon: 'shield-outline', activeIcon: 'shield', available: true, position: 3 },
      { label: 'Mercado Arcano', href: null, inactiveIcon: null, activeIcon: null, available: false, position: 4 },
      { label: 'Crônicas', href: null, inactiveIcon: null, activeIcon: null, available: false, position: 5 },
      { label: 'Configuração', href: null, inactiveIcon: null, activeIcon: null, available: false, position: 6 },
    ]);
    expect(primaryDestinations).toHaveLength(4);
    expect(futureDestinations).toHaveLength(3);
  });

  it.each([
    ['/', 'Acampamento'],
    ['/sessao', 'Forja'],
    ['/sessao/ativa', 'Forja'],
    ['/perfil', 'Personagem'],
    ['/guilda/membros', 'Guilda'],
  ])('selects exactly one destination for %s', (pathname, label) => {
    expect(primaryDestinations.filter((destination) => isDestinationActive(destination, pathname)).map(({ label: value }) => value)).toEqual([label]);
  });

  it.each(['/outra', '/sessaoinvalida', '/perfilado', '/guildados'])('does not use partial segment matches for %s', (pathname) => {
    expect(primaryDestinations.some((destination) => isDestinationActive(destination, pathname))).toBe(false);
  });
});
