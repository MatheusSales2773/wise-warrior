import type { WiseIconName } from '../icons/WiseIcon';

export type PrimaryDestination = {
  readonly available: true;
  readonly label: string;
  readonly href: '/' | '/sessao' | '/perfil' | '/guilda';
  readonly inactiveIcon: WiseIconName;
  readonly activeIcon: WiseIconName;
  readonly position: number;
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
  { label: 'Acampamento', href: '/', inactiveIcon: 'home-outline', activeIcon: 'home', available: true, position: 0 },
  { label: 'Forja', href: '/sessao', inactiveIcon: 'hammer-outline', activeIcon: 'hammer', available: true, position: 1 },
  { label: 'Personagem', href: '/perfil', inactiveIcon: 'person-outline', activeIcon: 'person', available: true, position: 2 },
  { label: 'Guilda', href: '/guilda', inactiveIcon: 'shield-outline', activeIcon: 'shield', available: true, position: 3 },
  { label: 'Mercado Arcano', href: null, inactiveIcon: null, activeIcon: null, available: false, position: 4 },
  { label: 'Crônicas', href: null, inactiveIcon: null, activeIcon: null, available: false, position: 5 },
  { label: 'Configuração', href: null, inactiveIcon: null, activeIcon: null, available: false, position: 6 },
] as const satisfies readonly (PrimaryDestination | FutureDestination)[];

export const primaryDestinations: readonly PrimaryDestination[] = destinations.filter(
  (destination): destination is (typeof destinations)[number] & PrimaryDestination => destination.available,
);

export const futureDestinations: readonly FutureDestination[] = destinations.filter(
  (destination): destination is (typeof destinations)[number] & FutureDestination => !destination.available,
);

export function isDestinationActive(destination: PrimaryDestination, pathname: string): boolean {
  if (destination.href === '/') return pathname === '/';
  return pathname === destination.href || pathname.startsWith(`${destination.href}/`);
}
