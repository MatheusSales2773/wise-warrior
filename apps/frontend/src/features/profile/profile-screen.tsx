import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAuth } from '@/core/auth/auth-context';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseText, isDesktopLayout, theme } from '@/design-system';
import { profileQueryOptions, sessionMetricsQueryOptions } from '@/features/dashboard/queries';
import { CharacterPanel, CharacterStats } from './character-panel';
import { DevicesContent } from './devices-tab';
import { deviceSessionsQueryOptions } from './queries';
import { ProfileTabs, type ProfileTab } from './profile-tabs';

function ComingSoon({ body, testID, title }: { body: string; testID: string; title: string }) {
  return (
    <View style={styles.stack} testID={testID}>
      <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">{title}</WiseText>
      <WiseText color="textSecondary" variant="body">{body}</WiseText>
    </View>
  );
}

const cosmeticsTab: ProfileTab = {
  id: 'cosmeticos',
  label: 'Cosméticos',
  content: (
    <ComingSoon
      body="Em breve você verá aqui o Catálogo e o Inventário do seu Character."
      testID="profile-cosmetics-soon"
      title="Cosméticos em breve"
    />
  ),
};

const companionTab: ProfileTab = {
  id: 'companheiro',
  label: 'Companheiro',
  content: (
    <ComingSoon
      body="Adiado por decisão do time (ADR-004): mascote com XP próprio, ganho a cada ciclo de foco."
      testID="profile-companion-locked"
      title="Companheiro chega na Fase 2"
    />
  ),
};

export function ProfileScreen() {
  const profile = useQuery(profileQueryOptions());
  const devices = useQuery(deviceSessionsQueryOptions());
  const metrics = useQuery(sessionMetricsQueryOptions());
  const { sessionId } = useAuth();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([profile.refetch(), devices.refetch(), metrics.refetch()]);
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
  // Touch platforms refresh by pulling down; web has no such gesture and relies on the query's own refetching.
  const refreshProps = Platform.OS === 'web' ? {} : { refreshing, onRefresh: () => { void refresh(); } };

  return (
    <Screen safeAreaEdges={[]} testID="profile" title="Personagem" {...refreshProps}>
      {profile.isError
        ? <FeedbackMessage message="Não foi possível atualizar seu personagem." testID="profile-refresh-error" title="Dados desatualizados" variant="error" />
        : null}
      <View style={[styles.grid, desktop && styles.desktopGrid]} testID="profile-layout">
        <CharacterPanel style={desktop ? styles.panelDesktop : undefined} user={user}>
          <CharacterStats query={metrics} />
        </CharacterPanel>
        <View style={styles.column}>
          <ProfileTabs
            tabs={[
              cosmeticsTab,
              companionTab,
              { id: 'dispositivos', label: 'Dispositivos', content: <DevicesContent currentSessionId={sessionId} query={devices} /> },
            ]}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.space.stackDefault },
  grid: { gap: theme.space.stackDefault },
  desktopGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  panelDesktop: { width: theme.layout.sidePanelWidth },
  column: { flex: 1 },
});
