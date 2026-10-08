import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAuth } from '@/core/auth/auth-context';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseCard, WiseText, isDesktopLayout, theme } from '@/design-system';
import { formatSessionDate, formatXp } from '@/features/dashboard/formatters';
import { profileQueryOptions } from '@/features/dashboard/queries';
import type { DeviceSession } from './api';
import { describeDevice, formatPlanTier } from './formatters';
import { deviceSessionsQueryOptions } from './queries';

function DeviceItem({ current, device }: { current: boolean; device: DeviceSession }) {
  const name = describeDevice(device);
  const lastUsed = `Último acesso: ${formatSessionDate(device.lastUsedAt)}`;
  return (
    <View
      accessible
      accessibilityLabel={`${name}${current ? ', este dispositivo' : ''}. ${lastUsed}`}
      style={styles.deviceItem}
      testID={`profile-device-${device.id}`}
    >
      <View style={styles.deviceMain}>
        <WiseText variant="label">{name}</WiseText>
        <WiseText color="textSecondary" variant="body">{lastUsed}</WiseText>
      </View>
      {current ? <WiseText color="accentPrimary" testID={`profile-device-current-${device.id}`} variant="caption">ESTE DISPOSITIVO</WiseText> : null}
    </View>
  );
}

function DevicesCard({ currentSessionId, query }: { currentSessionId: string | null; query: UseQueryResult<DeviceSession[]> }) {
  const body = (() => {
    if (query.isPending && !query.data) {
      return <WiseText color="textSecondary" testID="profile-devices-loading" variant="body">Carregando seus dispositivos…</WiseText>;
    }
    if (query.isError && !query.data) {
      return <View style={styles.stack} testID="profile-devices-error">
        <FeedbackMessage message="Não foi possível carregar seus dispositivos." title="Dispositivos indisponíveis" variant="error" />
        <WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void query.refetch()} variant="secondary" />
      </View>;
    }
    const devices = query.data ?? [];
    if (!devices.length) return <WiseText color="textSecondary" variant="body">Nenhum dispositivo com sessão ativa.</WiseText>;
    return devices.map((device) => <DeviceItem current={device.id === currentSessionId} device={device} key={device.id} />);
  })();

  return (
    <WiseCard accessibilityLabel="Dispositivos conectados" role="region" testID="profile-devices">
      <View style={styles.cardContent}>
        <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">Dispositivos conectados</WiseText>
        {body}
      </View>
    </WiseCard>
  );
}

export function ProfileScreen() {
  const profile = useQuery(profileQueryOptions());
  const devices = useQuery(deviceSessionsQueryOptions());
  const { sessionId } = useAuth();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([profile.refetch(), devices.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (profile.isPending && !profile.data) {
    return (
      <Screen safeAreaEdges={[]} testID="profile" title="Personagem">
        <View accessibilityLabel="Carregando seu personagem" accessibilityState={{ busy: true }} aria-busy style={styles.stack} testID="profile-loading">
          <WiseText variant="body">Carregando seu personagem…</WiseText>
          <ProgressBar indeterminate accessibilityLabel="Carregando seu personagem" />
        </View>
      </Screen>
    );
  }
  const user = profile.data;
  if (!user) {
    return (
      <Screen safeAreaEdges={[]} testID="profile" title="Personagem">
        <View style={styles.stack} testID="profile-error">
          <FeedbackMessage message="Não foi possível carregar seu personagem." title="Personagem indisponível" variant="error" />
          <WiseButton label="Tentar novamente" onPress={() => void profile.refetch()} />
        </View>
      </Screen>
    );
  }

  const desktop = isDesktopLayout(Platform.OS, width);
  const levelSpan = Math.max(1, user.nextLevelXp - user.levelStartXp);
  const xpPercent = Math.min(100, Math.round(((user.xpTotal - user.levelStartXp) / levelSpan) * 100));
  // Touch platforms refresh by pulling down; web has no such gesture and relies on the query's own refetching.
  const refreshProps = Platform.OS === 'web' ? {} : { refreshing, onRefresh: () => { void refresh(); } };

  return (
    <Screen safeAreaEdges={[]} testID="profile" title="Personagem" {...refreshProps}>
      {profile.isError
        ? <FeedbackMessage message="Não foi possível atualizar seu personagem." testID="profile-refresh-error" title="Dados desatualizados" variant="error" />
        : null}
      <View style={[styles.grid, desktop && styles.desktopGrid]}>
        <View style={styles.column}>
          <WiseCard accessibilityLabel="Personagem" role="region" testID="profile-character" variant="ornamented">
            <View style={styles.cardContent}>
              <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">{user.displayName}</WiseText>
              <WiseText color="accentPrimary" testID="profile-character-title" variant="label">{user.title || 'Sem título ainda'}</WiseText>
              <WiseText color="textSecondary" variant="body">{user.email}</WiseText>
              <WiseText color="textSecondary" testID="profile-plan" variant="caption">{formatPlanTier(user.planTier).toUpperCase()}</WiseText>
            </View>
          </WiseCard>
          <WiseCard accessibilityLabel="Progressão" role="region" testID="profile-progression">
            <View style={styles.cardContent}>
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
            </View>
          </WiseCard>
        </View>
        <View style={styles.column}>
          <DevicesCard currentSessionId={sessionId} query={devices} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.space.stackDefault },
  grid: { gap: theme.space.stackDefault },
  desktopGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1, gap: theme.space.stackDefault },
  cardContent: { padding: theme.space.cardInset, gap: theme.space.stackTight },
  deviceItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.stackTight },
  deviceMain: { flex: 1, gap: theme.space.inlineHairline },
});
