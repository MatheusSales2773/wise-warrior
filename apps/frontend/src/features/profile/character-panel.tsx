import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ProgressBar, WiseButton, WiseCard, WiseIcon, WiseText, theme, type WiseIconName } from '@/design-system';
import type { EquippedCosmeticItem, SessionMetrics, UserProfile } from '@/features/dashboard/api';
import { formatDayCount, formatSessionsToday, formatXp, levelProgressPercent } from '@/features/dashboard/formatters';
import { formatPlanTier } from './formatters';

export function CharacterStats({ query }: { query: UseQueryResult<SessionMetrics> }) {
  const metrics = query.data;
  if (!metrics && query.isError) {
    return (
      <View style={styles.stack} testID="profile-stats-error">
        <WiseText color="textSecondary" variant="body">Estatísticas indisponíveis.</WiseText>
        <WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void query.refetch()} variant="secondary" />
      </View>
    );
  }
  if (!metrics) {
    return <WiseText color="textSecondary" testID="profile-stats-loading" variant="body">Carregando estatísticas…</WiseText>;
  }
  const streak = formatDayCount(metrics.currentStreakDays);
  const sessions = formatSessionsToday(metrics);
  return (
    <View style={styles.stats} testID="profile-stats">
      <View accessible accessibilityLabel={`Sequência atual: ${streak}`} style={styles.stat} testID="profile-stat-streak">
        <WiseText color="textSecondary" variant="caption">Sequência atual</WiseText>
        <WiseText variant="label">{streak}</WiseText>
      </View>
      <View accessible accessibilityLabel={`Sessões hoje: ${sessions.spoken}`} style={styles.stat} testID="profile-stat-sessions">
        <WiseText color="textSecondary" variant="caption">Sessões hoje</WiseText>
        <WiseText variant="label">{sessions.value}</WiseText>
      </View>
    </View>
  );
}

/** Silhueta padrão do protótipo; o Avatar equipado aparece sobre ela até existir arte por item. */
function Silhouette() {
  const color = theme.color.accentPrimary;
  return (
    <Svg height={168} viewBox="0 0 100 120" width={140}>
      <Path d="M30 32 Q30 18 50 14 Q70 18 70 32 V46 L66 50 L34 50 L30 46 Z" fill={color} fillOpacity={0.35} />
      <Circle cx={44} cy={41} fill={color} fillOpacity={0.6} r={1.2} />
      <Circle cx={56} cy={41} fill={color} fillOpacity={0.6} r={1.2} />
      <Path d="M22 56 Q14 70 14 100 H86 Q86 70 78 56 L70 50 L66 56 L34 56 L30 50 Z" fill={color} fillOpacity={0.3} />
      <Path d="M50 64 L44 72 L50 88 L56 72 Z" fill={color} fillOpacity={0.6} />
    </Svg>
  );
}

function Portrait({ avatar }: { avatar: EquippedCosmeticItem | undefined }) {
  return (
    <View
      accessible
      accessibilityLabel={avatar ? `Avatar: ${avatar.name}` : 'Avatar: silhueta padrão'}
      accessibilityRole="image"
      style={styles.portrait}
      testID="profile-portrait"
    >
      <Silhouette />
      {avatar
        ? (
          <View style={styles.avatarOverlay} testID="profile-avatar">
            <WiseIcon color="accentPrimary" name="person" size="medium" />
            <WiseText style={styles.centered} variant="label">{avatar.name}</WiseText>
          </View>
        )
        : null}
    </View>
  );
}

const SEALS: { category: 'badge' | 'accessory'; label: string; icon: WiseIconName }[] = [
  { category: 'badge', label: 'Badge', icon: 'ribbon' },
  { category: 'accessory', label: 'Acessório', icon: 'diamond' },
];

function Seal({ icon, item, label }: { icon: WiseIconName; item: EquippedCosmeticItem; label: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${item.name}`} style={styles.seal} testID={`profile-seal-${item.category}`}>
      <WiseIcon color="accentPrimary" name={icon} size="small" />
      <WiseText variant="caption">{item.name}</WiseText>
    </View>
  );
}

export function CharacterPanel({ children, previewing = false, style, user }: {
  children: ReactNode;
  previewing?: boolean;
  style?: StyleProp<ViewStyle>;
  user: UserProfile;
}) {
  const xpPercent = levelProgressPercent(user);
  const equippedIn = (category: EquippedCosmeticItem['category']) => user.equipped.find((item) => item.category === category);
  const title = equippedIn('title');
  const seals = SEALS.flatMap((seal) => {
    const item = equippedIn(seal.category);
    return item ? [{ ...seal, item }] : [];
  });
  return (
    <WiseCard accessibilityLabel="Personagem" role="region" style={style} testID="profile-character" variant="ornamented">
      <View style={styles.content}>
        {previewing
          ? <WiseText color="accentPrimary" testID="profile-preview-badge" variant="caption">PRÉVIA · NADA FOI SALVO</WiseText>
          : null}
        <Portrait avatar={equippedIn('avatar')} />
        {title
          ? (
            <View accessible accessibilityLabel={`Título: ${title.name}`} style={styles.banner} testID="profile-title-banner">
              <WiseText color="accentPrimary" style={styles.centered} variant="label">“{title.name}”</WiseText>
            </View>
          )
          : null}
        {seals.length > 0
          ? <View style={styles.seals}>{seals.map((seal) => <Seal icon={seal.icon} item={seal.item} key={seal.category} label={seal.label} />)}</View>
          : null}
        <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">{user.displayName}</WiseText>
        <WiseText color="textSecondary" variant="body">{user.email}</WiseText>
        <WiseText color="textSecondary" testID="profile-plan" variant="caption">{formatPlanTier(user.planTier).toUpperCase()}</WiseText>
        <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">Nível {user.level}</WiseText>
        <WiseText variant="body">{formatXp(user.xpTotal)} XP total · {xpPercent}%</WiseText>
        <ProgressBar
          accessibilityLabel={`Progresso para o nível ${user.level + 1}`}
          maximumValue={user.nextLevelXp}
          minimumValue={user.levelStartXp}
          size="tall"
          testID="profile-progress"
          value={user.xpTotal}
        />
        <WiseText color="textSecondary" variant="body">
          Faltam {formatXp(Math.max(0, user.nextLevelXp - user.xpTotal))} XP para o nível {user.level + 1}
        </WiseText>
        {children}
      </View>
    </WiseCard>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.space.stackDefault },
  content: { padding: theme.space.cardInset, gap: theme.space.stackTight },
  stats: { flexDirection: 'row', gap: theme.space.stackDefault },
  stat: { flex: 1, gap: theme.space.inlineHairline },
  centered: { textAlign: 'center' },
  portrait: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space.stackDefault,
    borderWidth: theme.border.standard,
    borderColor: theme.color.borderGhost,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.surfaceInset,
  },
  avatarOverlay: { position: 'absolute', bottom: theme.space.stackTight, alignItems: 'center', gap: theme.space.inlineHairline },
  banner: {
    paddingVertical: theme.space.inlineTight,
    borderTopWidth: theme.border.standard,
    borderBottomWidth: theme.border.standard,
    borderColor: theme.color.borderGhost,
  },
  seals: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.inlineTight },
  seal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.inlineHairline,
    minHeight: 44,
    paddingHorizontal: theme.space.inlineTight,
    borderWidth: theme.border.standard,
    borderColor: theme.color.borderGhost,
    borderRadius: theme.radius.control,
  },
});
