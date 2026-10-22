import type { WiseIconName } from '@/design-system';

export type SettingsSectionId = 'conta' | 'foco' | 'dispositivos' | 'acessibilidade' | 'plano';

export type SettingsSection = {
  readonly id: SettingsSectionId;
  /** Name in the desktop menu and the section's heading. */
  readonly label: string;
  readonly description: string;
  /** Desktop opens the Configuração on Conta e segurança, so its menu item points at the root. */
  readonly desktopHref: '/configuracao' | `/configuracao/${SettingsSectionId}`;
  readonly href: `/configuracao/${SettingsSectionId}`;
  readonly icon: WiseIconName;
};

export const settingsSections: readonly SettingsSection[] = [
  { id: 'conta', label: 'Conta e segurança', description: 'Seu nome na guilda e a identidade com que você entra.', desktopHref: '/configuracao', href: '/configuracao/conta', icon: 'key-outline' },
  { id: 'foco', label: 'Foco', description: 'Como a Forja abre e se comporta.', desktopHref: '/configuracao/foco', href: '/configuracao/foco', icon: 'hammer-outline' },
  { id: 'dispositivos', label: 'Dispositivos', description: 'Os aparelhos e navegadores em que você está conectado.', desktopHref: '/configuracao/dispositivos', href: '/configuracao/dispositivos', icon: 'phone-portrait-outline' },
  { id: 'acessibilidade', label: 'Acessibilidade', description: 'Ajustes de movimento do app.', desktopHref: '/configuracao/acessibilidade', href: '/configuracao/acessibilidade', icon: 'accessibility-outline' },
  { id: 'plano', label: 'Plano', description: 'O plano da sua conta.', desktopHref: '/configuracao/plano', href: '/configuracao/plano', icon: 'diamond-outline' },
];

export function settingsSection(id: SettingsSectionId): SettingsSection {
  const section = settingsSections.find((candidate) => candidate.id === id);
  if (!section) throw new Error(`Unknown settings section "${id}".`);
  return section;
}

/** The section a Configuração address shows; the root is Conta e segurança. */
export function activeSettingsSection(pathname: string): SettingsSectionId {
  return settingsSections.find((section) => pathname === section.href || pathname.startsWith(`${section.href}/`))?.id ?? 'conta';
}

/** "free" → "Free"; the plan name as the server sends it, capitalized. */
export function planName(planTier: string): string {
  return planTier.charAt(0).toUpperCase() + planTier.slice(1);
}
