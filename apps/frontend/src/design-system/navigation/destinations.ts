import type { WiseIconName } from '../icons/WiseIcon';

export type PrimaryDestination = {
  readonly available: true;
  readonly label: string;
  readonly href: '/' | '/sessao' | '/perfil' | '/guilda' | '/mercado';
  readonly inactiveIcon: WiseIconName;
  readonly activeIcon: WiseIconName;
  readonly position: number;
  /** Phones keep four destinations in the bottom bar; the rest live in "Mais". The web sidebar lists them all. */
  readonly compact: 'bar' | 'more';
};

export type FutureDestination = {
  readonly label: string;
  readonly available: false;
  readonly href: null;
  readonly inactiveIcon: null;
  readonly activeIcon: null;
  readonly position: number;
};

export const destinations = [
  { label: 'Acampamento', href: '/', inactiveIcon: 'home-outline', activeIcon: 'home', available: true, position: 0, compact: 'bar' },
  { label: 'Forja', href: '/sessao', inactiveIcon: 'hammer-outline', activeIcon: 'hammer', available: true, position: 1, compact: 'bar' },
  { label: 'Personagem', href: '/perfil', inactiveIcon: 'person-outline', activeIcon: 'person', available: true, position: 2, compact: 'bar' },
  { label: 'Guilda', href: '/guilda', inactiveIcon: 'shield-outline', activeIcon: 'shield', available: true, position: 3, compact: 'bar' },
  { label: 'Mercado', href: '/mercado', inactiveIcon: 'storefront-outline', activeIcon: 'storefront', available: true, position: 4, compact: 'more' },
  { label: 'Crônicas', href: null, inactiveIcon: null, activeIcon: null, available: false, position: 5 },
  { label: 'Configuração', href: null, inactiveIcon: null, activeIcon: null, available: false, position: 6 },
] as const satisfies readonly (PrimaryDestination | FutureDestination)[];

export const primaryDestinations: readonly PrimaryDestination[] = destinations.filter(
  (destination): destination is (typeof destinations)[number] & PrimaryDestination => destination.available,
);

export const bottomBarDestinations: readonly PrimaryDestination[] = primaryDestinations.filter((destination) => destination.compact === 'bar');

export const moreMenuDestinations: readonly PrimaryDestination[] = primaryDestinations.filter((destination) => destination.compact === 'more');

export const futureDestinations: readonly FutureDestination[] = destinations.filter(
  (destination): destination is (typeof destinations)[number] & FutureDestination => !destination.available,
);

export function isDestinationActive(destination: PrimaryDestination, pathname: string): boolean {
  if (destination.href === '/') return pathname === '/';
  return pathname === destination.href || pathname.startsWith(`${destination.href}/`);
}
