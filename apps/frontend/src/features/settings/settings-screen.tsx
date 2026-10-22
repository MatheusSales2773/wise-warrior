import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Link, Slot, Stack, usePathname, useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, WiseIcon, isDesktopLayout, theme, type WiseIconName } from '@/design-system';
import { useRuntimeMotionDuration } from '@/design-system/components/motion-runtime';
import { useLogoutAction } from '@/design-system/navigation/LogoutAction';
import { logoutErrorMessage } from '@/features/auth/messages';
import { useSignOut } from '@/features/auth/use-sign-out';
import { equippedItems } from '@/features/character/catalog';
import { HeroGlow } from '@/features/character/character-art';
import { SectionHeader, useFocusRing } from '@/features/character/character-parts';
import { LayeredHero } from '@/features/character/layered-hero';
import type { UserProfile } from '@/features/dashboard/api';
import { profileQueryOptions } from '@/features/dashboard/queries';
import { activeSettingsSection, planName, settingsSection, settingsSections, type SettingsSectionId } from './sections';

const PLAN_DESCRIPTION = 'premium em breve';

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

/* ---------- Cabeçalho da conta ---------- */

function ProfileCard({ user }: { user: UserProfile }) {
  return <View style={styles.profileCard} testID="settings-profile">
    <View style={styles.profileAvatar}>
      <HeroGlow height={86.4} opacity={0.24} style={styles.profileGlow} width={84} />
      <LayeredHero equipped={equippedItems(user)} scale={3} style={styles.profileHero} />
    </View>
    <View style={styles.profileCopy}>
      <Text numberOfLines={1} style={styles.profileName}>{user.displayName}</Text>
      <Text numberOfLines={1} style={styles.profileEmail}>{user.email}</Text>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{`PLANO ${user.planTier.toUpperCase()}`}</Text>
      </View>
    </View>
  </View>;
}

/** The account header from `GET /users/me`, with its own loading and failure states. */
function AccountHeader() {
  const profile = useQuery(profileQueryOptions());
  if (profile.data) return <ProfileCard user={profile.data} />;
  if (profile.isError) {
    return <View style={styles.stateBlock} testID="settings-profile-error">
      <FeedbackMessage message="Não foi possível carregar sua conta." title="Conta indisponível" variant="error" />
      <WiseButton label="Tentar novamente" loading={profile.isRefetching} onPress={() => void profile.refetch()} variant="ghost" />
    </View>;
  }
  return <View accessibilityLabel="Carregando sua conta" accessibilityState={{ busy: true }} aria-busy style={styles.stateBlock} testID="settings-profile-loading">
    <ProgressBar indeterminate accessibilityLabel="Carregando sua conta" />
  </View>;
}

/* ---------- Seções ---------- */

function InfoRow({ icon, title, value }: { icon: WiseIconName; title: string; value: string }) {
  return <View accessible accessibilityLabel={`${title}: ${value}`} style={styles.row}>
    <WiseIcon color="textSecondary" name={icon} size="compact" />
    <Text style={styles.rowTitle}>{title}</Text>
    <Text numberOfLines={1} style={styles.rowValue}>{value}</Text>
  </View>;
}

function PlanContent() {
  const profile = useQuery(profileQueryOptions());
  const tier = profile.data?.planTier;
  return <View style={styles.list}>
    <InfoRow icon="diamond-outline" title="Plano atual" value={tier ? `${planName(tier)} · ${PLAN_DESCRIPTION}` : '…'} />
  </View>;
}

function SectionContent({ id }: { id: SettingsSectionId }) {
  if (id === 'conta') return <AccountHeader />;
  if (id === 'plano') return <PlanContent />;
  return null;
}

function BackToSettings() {
  const router = useRouter();
  const { focusProps, focusStyle } = useFocusRing();
  return <Pressable
    {...focusProps}
    accessibilityLabel="Voltar para Configuração"
    accessibilityRole="button"
    hitSlop={12}
    onPress={() => (router.canGoBack() ? router.back() : router.replace('/configuracao'))}
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
  if (desktop) {
    return <ScrollView contentContainerStyle={styles.desktopSection} testID={`settings-section-${id}`}>
      <View style={styles.card}>
        <SectionHeader>{section.label}</SectionHeader>
        <Text style={styles.description}>{section.description}</Text>
        <SectionContent id={id} />
      </View>
    </ScrollView>;
  }
  return <ScrollView contentContainerStyle={styles.mobileScreen} testID={`settings-section-${id}`}>
    <BackToSettings />
    <Text accessibilityRole="header" aria-level={1} style={styles.mobileTitle}>{section.label}</Text>
    <Text style={styles.description}>{section.description}</Text>
    <SectionContent id={id} />
  </ScrollView>;
}

/* ---------- Lista agrupada (celular) ---------- */

function LinkRow({ first, href, icon, title, value }: { first?: boolean; href: Href; icon: WiseIconName; title: string; value?: string }) {
  const { focusProps, focusStyle } = useFocusRing();
  return <Link asChild href={href}>
    <Pressable {...focusProps} accessibilityLabel={value ? `${title}: ${value}` : title} accessibilityRole="link" style={StyleSheet.flatten([styles.row, !first && styles.rowDivided, focusStyle])}>
      <WiseIcon color="textSecondary" name={icon} size="compact" />
      <Text style={styles.rowTitle}>{title}</Text>
      {value ? <Text numberOfLines={1} style={styles.rowValue}>{value}</Text> : null}
      <WiseIcon color="textTertiary" name="chevron-forward" size="xsmall" />
    </Pressable>
  </Link>;
}

function Group({ children, label }: { children: ReactNode; label: string }) {
  return <View style={styles.group}>
    <Text accessibilityRole="header" aria-level={2} style={styles.groupLabel}>{label.toUpperCase()}</Text>
    <View style={styles.list}>{children}</View>
  </View>;
}

function SignOutButton() {
  const signOut = useSignOut();
  const { error, pending, submit } = useLogoutAction(signOut);
  return <View style={styles.stateBlock}>
    <WiseButton label="Sair da conta" leading={<WiseIcon color="feedbackDanger" name="log-out-outline" size="xsmall" />} loading={pending} onPress={submit} variant="danger" />
    {error !== null ? <FeedbackMessage message={logoutErrorMessage(error)} title="Erro ao sair" variant="error" /> : null}
  </View>;
}

function SettingsList() {
  const profile = useQuery(profileQueryOptions());
  const user = profile.data;
  return <ScrollView contentContainerStyle={styles.mobileScreen} testID="settings-list">
    <Text accessibilityRole="header" aria-level={1} style={styles.mobileTitle}>Configuração</Text>
    <AccountHeader />
    <Group label="Conta">
      <LinkRow first href="/configuracao/conta" icon="person-outline" title="Nome do guerreiro" value={user?.displayName} />
      {user ? <View style={styles.rowDivided}><InfoRow icon="mail-outline" title="E-mail" value={user.email} /></View> : null}
    </Group>
    <Group label="Foco">
      <LinkRow first href="/configuracao/foco" icon="hammer-outline" title="Foco" />
    </Group>
    <Group label="Segurança">
      <LinkRow first href="/configuracao/dispositivos" icon="phone-portrait-outline" title="Dispositivos conectados" />
    </Group>
    <Group label="Acessibilidade">
      <LinkRow first href="/configuracao/acessibilidade" icon="accessibility-outline" title="Acessibilidade" />
    </Group>
    <Group label="Plano">
      <LinkRow first href="/configuracao/plano" icon="diamond-outline" title="Plano atual" value={user ? `${planName(user.planTier)} · ${PLAN_DESCRIPTION}` : undefined} />
    </Group>
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
  const signOut = useSignOut();
  const { error, pending, submit } = useLogoutAction(signOut);
  const { focusProps, focusStyle } = useFocusRing();
  return <>
    <Pressable {...focusProps} accessibilityLabel="Sair da conta" accessibilityRole="button" accessibilityState={{ busy: pending, disabled: pending }} disabled={pending} onPress={submit} style={[styles.menuItem, focusStyle]}>
      <WiseIcon color="feedbackDanger" name="log-out-outline" size="compact" />
      <Text style={[styles.menuLabel, styles.menuLabelDanger]}>Sair da conta</Text>
    </Pressable>
    {error !== null ? <FeedbackMessage message={logoutErrorMessage(error)} title="Erro ao sair" variant="error" /> : null}
  </>;
}

function SettingsMenu({ active }: { active: SettingsSectionId }) {
  const profile = useQuery(profileQueryOptions());
  const tier = profile.data?.planTier;
  return <View accessibilityLabel="Seções da configuração" role="navigation" style={styles.menu}>
    {settingsSections.map((section) => <MenuItem
      active={section.id === active}
      href={section.desktopHref}
      icon={section.icon}
      key={section.id}
      label={section.label}
      meta={section.id === 'plano' && tier ? tier.toUpperCase() : undefined}
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

  card: { gap: theme.space.controlInset, padding: 22, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  description: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: theme.color.textSecondary },

  mobileScreen: { gap: 18, paddingHorizontal: theme.space.cardInset, paddingTop: 28, paddingBottom: theme.space.cardInset },
  mobileTitle: { fontFamily: cinzel, fontSize: 24, lineHeight: 32, color: theme.color.textPrimary },
  back: { minHeight: theme.layout.touchTarget, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -4, marginVertical: -12 },
  backLabel: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 17, color: theme.color.accentPrimary },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 12, paddingRight: 14, paddingVertical: 12, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceCard },
  profileAvatar: { width: 60, height: 72, overflow: 'hidden', borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceInset },
  profileGlow: { position: 'absolute', top: -8.2, left: -13 },
  profileHero: { position: 'absolute', top: -5, left: 5 },
  profileCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 3 },
  profileName: { fontFamily: cinzel, fontSize: 17, lineHeight: 23, color: theme.color.textPrimary },
  profileEmail: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 15, color: theme.color.textSecondary },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceInset },
  pillText: { fontFamily: mono, fontSize: 9, lineHeight: 12, letterSpacing: 0.8, color: theme.color.accentPrimary },
  stateBlock: { gap: theme.space.inlineTight },

  group: { gap: theme.space.inlineTight },
  groupLabel: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 1.2, color: theme.color.textTertiary },
  list: { overflow: 'hidden', borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  row: { minHeight: theme.layout.touchTarget, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowDivided: { borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderGhost },
  rowTitle: { flex: 1, fontFamily: 'Inter-Medium', fontSize: 14, lineHeight: 17, color: theme.color.textPrimary },
  rowValue: { flexShrink: 1, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 16, color: theme.color.textTertiary },

  version: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: theme.color.textTertiary },
});
