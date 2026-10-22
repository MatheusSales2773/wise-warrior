import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Link, Slot, Stack, usePathname, useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, WiseButton, WiseIcon, isDesktopLayout, theme, type WiseIconName } from '@/design-system';
import { useRuntimeMotionDuration } from '@/design-system/components/motion-runtime';
import { useLogoutAction } from '@/design-system/navigation/LogoutAction';
import { logoutErrorMessage } from '@/features/auth/messages';
import { useSignOut } from '@/features/auth/use-sign-out';
import { SectionHeader, useFocusRing } from '@/features/character/character-parts';
import { profileQueryOptions } from '@/features/dashboard/queries';
import { activeSettingsSection, menuHref, settingsSection, settingsSections, type SettingsSectionId } from './sections';
import { useActiveDevicesLabel } from './devices-content';
import { useDefaultFocusLabel } from './focus-content';
import { RenameContent } from './rename-form';
import { AccountHeader, InfoRow, settingsStyles } from './settings-content';

/** Live counts shown beside a section's name, for the sections that have one. */
function useSectionMeta(): Partial<Record<SettingsSectionId, string>> {
  return { foco: useDefaultFocusLabel(), dispositivos: useActiveDevicesLabel() };
}

function useDesktop() {
  const { width } = useWindowDimensions();
  return isDesktopLayout(Platform.OS, width);
}

function appVersionLabel() {
  const version = Constants.expoConfig?.version;
  return version ? `Wise Warrior · versão ${version}` : 'Wise Warrior';
}

function VersionFooter() {
  return <Text style={styles.version} testID="settings-version">{appVersionLabel()}</Text>;
}

/* ---------- Seções ---------- */

function BackToSettings() {
  const router = useRouter();
  const { focusProps, focusStyle } = useFocusRing();
  return <Pressable
    {...focusProps}
    accessibilityLabel="Voltar para Configuração"
    accessibilityRole="button"
    hitSlop={12}
    // Native stacks the list under every section (anchor), so back is the list; the web may have come from anywhere.
    onPress={() => (Platform.OS !== 'web' && router.canGoBack() ? router.back() : router.navigate('/configuracao'))}
    style={[styles.back, focusStyle]}
  >
    <WiseIcon color="accentPrimary" name="chevron-back" size="small" />
    <Text style={styles.backLabel}>Configuração</Text>
  </Pressable>;
}

/** One Configuração section: a card beside the menu on desktop, its own screen with "‹ Configuração" on phones. */
export function SettingsSectionScreen({ id }: { id: SettingsSectionId }) {
  const desktop = useDesktop();
  const section = settingsSection(id);
  const meta = useSectionMeta()[id];
  if (desktop) {
    return <ScrollView contentContainerStyle={styles.desktopSection} testID={`settings-section-${id}`}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <SectionHeader>{section.label}</SectionHeader>
          {meta ? <Text style={styles.cardMeta} testID={`settings-section-meta-${id}`}>{meta}</Text> : null}
        </View>
        <Text style={styles.description}>{section.description}</Text>
        {section.Content ? <section.Content /> : null}
      </View>
    </ScrollView>;
  }
  return <ScrollView contentContainerStyle={styles.mobileScreen} testID={`settings-section-${id}`}>
    <BackToSettings />
    <Text accessibilityRole="header" aria-level={1} style={styles.mobileTitle}>{section.label}</Text>
    <Text style={styles.description}>{section.description}</Text>
    {section.Content ? <section.Content /> : null}
  </ScrollView>;
}

/** The phone's edit screen for the warrior name, opened from the "Nome do guerreiro" row. */
export function RenameScreen() {
  return <ScrollView contentContainerStyle={styles.mobileScreen} testID="settings-rename">
    <BackToSettings />
    <Text accessibilityRole="header" aria-level={1} style={styles.mobileTitle}>Nome do guerreiro</Text>
    <Text style={styles.description}>Como a sua guilda vê você.</Text>
    <RenameContent />
  </ScrollView>;
}

/* ---------- Lista agrupada (celular) ---------- */

function LinkRow({ href, icon, title, value }: { href: Href; icon: WiseIconName; title: string; value?: string }) {
  const { focusProps, focusStyle } = useFocusRing();
  return <Link asChild href={href}>
    <Pressable {...focusProps} accessibilityLabel={value ? `${title}: ${value}` : title} accessibilityRole="link" style={StyleSheet.flatten([settingsStyles.row, focusStyle])}>
      <WiseIcon color="textSecondary" name={icon} size="compact" />
      <Text style={settingsStyles.rowTitle}>{title}</Text>
      {value ? <Text numberOfLines={1} style={settingsStyles.rowValue}>{value}</Text> : null}
      <WiseIcon color="textTertiary" name="chevron-forward" size="xsmall" />
    </Pressable>
  </Link>;
}

function Group({ children, label }: { children: ReactNode; label: string }) {
  return <View style={styles.group}>
    <Text accessibilityRole="header" aria-level={2} style={styles.groupLabel}>{label.toUpperCase()}</Text>
    <View style={settingsStyles.list}>{children}</View>
  </View>;
}

/** "Sair da conta" logs this device out; the trigger differs between the phone button and the desktop menu. */
function SignOut({ children }: { children: (action: { pending: boolean; submit: () => Promise<void> }) => ReactNode }) {
  const { error, pending, submit } = useLogoutAction(useSignOut());
  return <>
    {children({ pending, submit })}
    {error !== null ? <FeedbackMessage message={logoutErrorMessage(error)} title="Erro ao sair" variant="error" /> : null}
  </>;
}

function SignOutButton() {
  return <View style={settingsStyles.stateBlock}>
    <SignOut>
      {({ pending, submit }) => <WiseButton label="Sair da conta" leading={<WiseIcon color="feedbackDanger" name="log-out-outline" size="xsmall" />} loading={pending} onPress={submit} variant="danger" />}
    </SignOut>
  </View>;
}

function SettingsList() {
  const profile = useQuery(profileQueryOptions());
  const user = profile.data;
  const meta = useSectionMeta();
  return <ScrollView contentContainerStyle={styles.mobileScreen} testID="settings-list">
    <Text accessibilityRole="header" aria-level={1} style={styles.mobileTitle}>Configuração</Text>
    <AccountHeader />
    {settingsSections.map((section) => <Group key={section.id} label={section.group}>
      <LinkRow href={section.row.href ?? section.href} icon={section.row.icon} title={section.row.title} value={meta[section.id] ?? (user && section.row.value?.(user))} />
      {user && section.details?.(user).map((detail) => <View key={detail.title} style={settingsStyles.rowDivided}><InfoRow {...detail} /></View>)}
    </Group>)}
    <SignOutButton />
    <VersionFooter />
  </ScrollView>;
}

/** `/configuracao`: Conta e segurança beside the menu on desktop, the grouped list on phones. */
export function SettingsHome() {
  return useDesktop() ? <SettingsSectionScreen id="conta" /> : <SettingsList />;
}

/* ---------- Menu lateral (desktop) ---------- */

function MenuItem({ active, href, icon, label, meta }: { active: boolean; href: Href; icon: WiseIconName; label: string; meta?: string }) {
  const { focusProps, focusStyle } = useFocusRing();
  return <Link asChild href={href}>
    <Pressable {...focusProps} accessibilityLabel={label} accessibilityRole="link" accessibilityState={{ selected: active }} style={StyleSheet.flatten([styles.menuItem, active && styles.menuItemActive, focusStyle])}>
      <WiseIcon color={active ? 'accentHighlight' : 'textSecondary'} name={icon} size="compact" />
      <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>{label}</Text>
      {meta ? <Text style={styles.menuMeta}>{meta}</Text> : null}
    </Pressable>
  </Link>;
}

function MenuSignOut() {
  const { focusProps, focusStyle } = useFocusRing();
  return <SignOut>
    {({ pending, submit }) => <Pressable {...focusProps} accessibilityLabel="Sair da conta" accessibilityRole="button" accessibilityState={{ busy: pending, disabled: pending }} disabled={pending} onPress={submit} style={[styles.menuItem, focusStyle]}>
      <WiseIcon color="feedbackDanger" name="log-out-outline" size="compact" />
      <Text style={[styles.menuLabel, styles.menuLabelDanger]}>Sair da conta</Text>
    </Pressable>}
  </SignOut>;
}

function SettingsMenu({ active }: { active: SettingsSectionId }) {
  const profile = useQuery(profileQueryOptions());
  const tier = profile.data?.planTier;
  const sectionMeta = useSectionMeta();
  return <View accessibilityLabel="Seções da configuração" role="navigation" style={styles.menu}>
    {settingsSections.map((section) => <MenuItem
      active={section.id === active}
      href={menuHref(section)}
      icon={section.icon}
      key={section.id}
      label={section.label}
      meta={section.id === 'plano' && tier ? tier.toUpperCase() : sectionMeta[section.id]}
    />)}
    <View style={styles.menuDivider} />
    <MenuSignOut />
  </View>;
}

/* ---------- Layout ---------- */

/**
 * Wraps every Configuração route. Native apps stack each section over the list so the system back returns to it;
 * the web leaves back to the browser history, so the same element stays mounted across the desktop breakpoint.
 */
export function SettingsLayout() {
  const desktop = useDesktop();
  const pathname = usePathname();
  const duration = useRuntimeMotionDuration();
  const stack = Platform.OS === 'web'
    ? <Slot />
    : <Stack screenOptions={{
      animation: duration === theme.motion.none ? 'none' : 'default',
      contentStyle: { backgroundColor: theme.color.backgroundCanvas },
      headerShown: false,
    }} />;

  return <View style={styles.root} testID="settings">
    {desktop
      ? <View style={styles.desktopHeader}>
        <Text style={styles.eyebrow}>◈ Conta e preferências</Text>
        <Text accessibilityRole="header" aria-level={1} style={styles.desktopTitle}>Configuração</Text>
      </View>
      : null}
    <View style={desktop ? styles.desktopBody : styles.mobileBody}>
      {desktop
        ? <View style={styles.menuColumn}>
          <SettingsMenu active={activeSettingsSection(pathname)} />
          <VersionFooter />
        </View>
        : null}
      <View style={styles.stack}>{stack}</View>
    </View>
  </View>;
}

const cinzel = 'Cinzel-Bold';
const mono = 'JetBrainsMono-Medium';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.backgroundCanvas },
  stack: { flex: 1 },
  mobileBody: { flex: 1 },

  desktopHeader: { gap: 4, marginHorizontal: 48, paddingTop: 36, paddingBottom: 29, borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderSubtle },
  eyebrow: { fontFamily: cinzel, fontSize: 10, lineHeight: 13, letterSpacing: 2.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  desktopTitle: { fontFamily: cinzel, fontSize: 28, lineHeight: 38, color: theme.color.textPrimary },
  desktopBody: { flex: 1, flexDirection: 'row', gap: 24, paddingHorizontal: 48, paddingTop: 31 },
  menuColumn: { width: 264, gap: theme.space.stackDefault },
  desktopSection: { paddingBottom: 48 },

  menu: { gap: 4, padding: 10, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  menuItem: { minHeight: theme.layout.touchTarget - 4, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: 'transparent' },
  menuItemActive: { backgroundColor: theme.color.surfaceElevated, borderColor: theme.color.borderEmphasis },
  menuLabel: { flex: 1, fontFamily: 'Inter-Medium', fontSize: 14, lineHeight: 17, color: theme.color.textSecondary },
  menuLabelActive: { color: theme.color.accentHighlight },
  menuLabelDanger: { color: theme.color.feedbackDanger },
  menuMeta: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.textTertiary },
  menuDivider: { height: 1, backgroundColor: theme.color.borderGhost },

  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.space.inlineTight },
  cardMeta: { fontFamily: mono, fontSize: 11, lineHeight: 14, color: theme.color.textTertiary },
  card: { gap: theme.space.controlInset, padding: 22, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  description: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: theme.color.textSecondary },

  mobileScreen: { gap: 18, paddingHorizontal: theme.space.cardInset, paddingTop: 28, paddingBottom: theme.space.cardInset },
  mobileTitle: { fontFamily: cinzel, fontSize: 24, lineHeight: 32, color: theme.color.textPrimary },
  back: { minHeight: theme.layout.touchTarget, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -4, marginVertical: -12 },
  backLabel: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 17, color: theme.color.accentPrimary },


  group: { gap: theme.space.inlineTight },
  groupLabel: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 1.2, color: theme.color.textTertiary },

  version: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: theme.color.textTertiary },
});
