import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, WiseIcon, theme, type WiseIconName } from '@/design-system';
import { equippedItems } from '@/features/character/catalog';
import { HeroGlow } from '@/features/character/character-art';
import { LayeredHero } from '@/features/character/layered-hero';
import type { UserProfile } from '@/features/dashboard/api';
import { profileQueryOptions } from '@/features/dashboard/queries';
import { planLabel } from './plan';

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
export function AccountHeader() {
  const profile = useQuery(profileQueryOptions());
  if (profile.data) return <ProfileCard user={profile.data} />;
  if (profile.isError) {
    return <View style={settingsStyles.stateBlock} testID="settings-profile-error">
      <FeedbackMessage message="Não foi possível carregar sua conta." title="Conta indisponível" variant="error" />
      <WiseButton label="Tentar novamente" loading={profile.isRefetching} onPress={() => void profile.refetch()} variant="ghost" />
    </View>;
  }
  return <View accessibilityLabel="Carregando sua conta" accessibilityState={{ busy: true }} aria-busy style={settingsStyles.stateBlock} testID="settings-profile-loading">
    <ProgressBar indeterminate accessibilityLabel="Carregando sua conta" />
  </View>;
}

export function InfoRow({ icon, title, value }: { icon: WiseIconName; title: string; value: string }) {
  return <View accessible accessibilityLabel={`${title}: ${value}`} style={settingsStyles.row}>
    <WiseIcon color="textSecondary" name={icon} size="compact" />
    <Text style={settingsStyles.rowTitle}>{title}</Text>
    <Text numberOfLines={1} style={settingsStyles.rowValue}>{value}</Text>
  </View>;
}

export function PlanContent() {
  const profile = useQuery(profileQueryOptions());
  if (!profile.data) return <AccountHeader />;
  return <View style={settingsStyles.list}>
    <InfoRow icon="diamond-outline" title="Plano atual" value={planLabel(profile.data.planTier)} />
  </View>;
}

/** The list card and its rows, shared by the section content and the phone list. */
export const settingsStyles = StyleSheet.create({
  stateBlock: { gap: theme.space.inlineTight },
  list: { overflow: 'hidden', borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  row: { minHeight: theme.layout.touchTarget, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowDivided: { borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderGhost },
  rowTitle: { flex: 1, fontFamily: 'Inter-Medium', fontSize: 14, lineHeight: 17, color: theme.color.textPrimary },
  rowValue: { flexShrink: 1, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 16, color: theme.color.textTertiary },
});

const styles = StyleSheet.create({
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 12, paddingRight: 14, paddingVertical: 12, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceCard },
  profileAvatar: { width: 60, height: 72, overflow: 'hidden', borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceInset },
  profileGlow: { position: 'absolute', top: -8.2, left: -13 },
  profileHero: { position: 'absolute', top: -5, left: 5 },
  profileCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 3 },
  profileName: { fontFamily: 'Cinzel-Bold', fontSize: 17, lineHeight: 23, color: theme.color.textPrimary },
  profileEmail: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 15, color: theme.color.textSecondary },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceInset },
  pillText: { fontFamily: 'JetBrainsMono-Medium', fontSize: 9, lineHeight: 12, letterSpacing: 0.8, color: theme.color.accentPrimary },
});
