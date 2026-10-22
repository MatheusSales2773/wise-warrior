import type { Href } from 'expo-router';
import type { ComponentType } from 'react';
import type { WiseIconName } from '@/design-system';
import type { UserProfile } from '@/features/dashboard/api';
import { planLabel } from './plan';
import { DevicesContent } from './devices-content';
import { PublicProfile } from './public-profile-card';
import { PlanContent } from './settings-content';

export type SettingsSectionId = 'conta' | 'foco' | 'dispositivos' | 'acessibilidade' | 'plano';

/** A read-only line of the phone list, shown under the section's row. */
export type SettingsDetail = { readonly icon: WiseIconName; readonly title: string; readonly value: string };

/** Everything the desktop menu, the phone list and the section screen show for one section. */
export type SettingsSection = {
  readonly id: SettingsSectionId;
  /** Name in the desktop menu and the section's heading. */
  readonly label: string;
  readonly description: string;
  readonly href: `/configuracao/${SettingsSectionId}`;
  /** Icon in the desktop menu. */
  readonly icon: WiseIconName;
  /** The phone list's group around this section's row. */
  readonly group: string;
  readonly row: {
    readonly title: string;
    /** Where the row leads when it is not the section itself. */
    readonly href?: Href;
    readonly icon: WiseIconName;
    readonly value?: (user: UserProfile) => string;
  };
  readonly details?: (user: UserProfile) => readonly SettingsDetail[];
  /** What the section shows below its description; `null` while it is still a skeleton. */
  readonly Content: ComponentType | null;
};

export const settingsSections: readonly SettingsSection[] = [
  {
    id: 'conta', label: 'Conta e segurança', description: 'Seu nome na guilda e a identidade com que você entra.', href: '/configuracao/conta', icon: 'key-outline',
    group: 'Conta', row: { title: 'Nome do guerreiro', icon: 'person-outline', href: '/configuracao/nome', value: (user) => user.displayName },
    details: (user) => [{ icon: 'mail-outline', title: 'E-mail', value: user.email }],
    Content: PublicProfile,
  },
  {
    id: 'foco', label: 'Foco', description: 'Como a Forja abre e se comporta.', href: '/configuracao/foco', icon: 'hammer-outline',
    group: 'Foco', row: { title: 'Foco', icon: 'hammer-outline' }, Content: null,
  },
  {
    id: 'dispositivos', label: 'Dispositivos', description: 'Os aparelhos e navegadores em que você está conectado.', href: '/configuracao/dispositivos', icon: 'phone-portrait-outline',
    group: 'Segurança', row: { title: 'Dispositivos conectados', icon: 'phone-portrait-outline' }, Content: DevicesContent,
  },
  {
    id: 'acessibilidade', label: 'Acessibilidade', description: 'Ajustes de movimento do app.', href: '/configuracao/acessibilidade', icon: 'accessibility-outline',
    group: 'Acessibilidade', row: { title: 'Acessibilidade', icon: 'accessibility-outline' }, Content: null,
  },
  {
    id: 'plano', label: 'Plano', description: 'O plano da sua conta.', href: '/configuracao/plano', icon: 'diamond-outline',
    group: 'Plano', row: { title: 'Plano atual', icon: 'diamond-outline', value: (user) => planLabel(user.planTier) },
    Content: PlanContent,
  },
];

export function settingsSection(id: SettingsSectionId): SettingsSection {
  const section = settingsSections.find((candidate) => candidate.id === id);
  if (!section) throw new Error(`Unknown settings section "${id}".`);
  return section;
}

/** Desktop opens the Configuração on Conta e segurança, so its menu item points at the root. */
export function menuHref(section: SettingsSection): '/configuracao' | SettingsSection['href'] {
  return section.id === 'conta' ? '/configuracao' : section.href;
}

/** The section a Configuração address shows; the root is Conta e segurança. */
export function activeSettingsSection(pathname: string): SettingsSectionId {
  return settingsSections.find((section) => pathname === section.href)?.id ?? 'conta';
}
