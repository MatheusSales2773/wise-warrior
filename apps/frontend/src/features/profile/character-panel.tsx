import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ProgressBar, WiseButton, WiseCard, WiseText, theme } from '@/design-system';
import type { SessionMetrics, UserProfile } from '@/features/dashboard/api';
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

export function CharacterPanel({ children, style, user }: { children: ReactNode; style?: StyleProp<ViewStyle>; user: UserProfile }) {
  const xpPercent = levelProgressPercent(user);
  return (
    <WiseCard accessibilityLabel="Personagem" role="region" style={style} testID="profile-character" variant="ornamented">
      <View style={styles.content}>
        <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">{user.displayName}</WiseText>
        <WiseText color="accentPrimary" testID="profile-character-title" variant="label">{user.title || 'Sem título ainda'}</WiseText>
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
});
