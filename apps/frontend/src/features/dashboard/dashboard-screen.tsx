import { useQuery } from '@tanstack/react-query';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseText, isDesktopLayout, theme } from '@/design-system';
import { useSessionsObjective, useWeeklyMinutesObjective } from '@/features/chronicles/queries';
import { ActivityCard } from './activity-card';
import { CadenceCard } from './cadence-card';
import { DashboardLayout } from './dashboard-layout';
import { FocusAction } from './focus-action';
import { GuildCard } from './guild-card';
import { MetricsCard } from './metrics-card';
import { DashboardGlow, ProfileCard, ProfileRefreshError } from './profile-card';
import { ProgressionCard } from './progression-card';
import { profileQueryOptions, recentActivityQueryOptions, sessionMetricsQueryOptions, weekSummaryQueryOptions } from './queries';
import { useDashboardRefresh } from './use-dashboard-refresh';
import { useSingleFlightRetry } from './use-single-flight-retry';

export function DashboardScreen() {
  const profile = useQuery(profileQueryOptions());
  const activity = useQuery(recentActivityQueryOptions());
  const metrics = useQuery(sessionMetricsQueryOptions());
  const weekSummary = useQuery(weekSummaryQueryOptions());
  const sessionsObjective = useSessionsObjective();
  const weeklyObjective = useWeeklyMinutesObjective();
  const { width } = useWindowDimensions();
  // Every query "Atualizar", pull-to-refresh and the partial-failure message cover. A new card's query joins here.
  const { partialErrorMessage, refresh, refreshing, statusMessage } = useDashboardRefresh([profile, activity, metrics, weekSummary]);
  const retryActivity = useSingleFlightRetry(activity);
  const retryMetrics = useSingleFlightRetry(metrics);

  if (profile.isPending && !profile.data) {
    return (
      <Screen safeAreaEdges={[]} title="Acampamento" testID="dashboard">
        <View
          accessibilityLabel="Carregando seu painel"
          accessibilityLiveRegion="polite"
          accessibilityState={{ busy: true }}
          aria-atomic
          aria-busy
          aria-live="polite"
          style={styles.loading}
          testID="dashboard-loading"
        >
          <WiseText variant="body">Carregando seu painel…</WiseText>
          <ProgressBar indeterminate accessibilityLabel="Carregando seu painel" testID="dashboard-loading-progress" />
        </View>
      </Screen>
    );
  }
  if (profile.isError && !profile.data) {
    return (
      <Screen safeAreaEdges={[]} title="Acampamento" testID="dashboard">
        <View style={styles.errorContent}>
          <FeedbackMessage message="Não foi possível carregar seu progresso." title="Painel indisponível" variant="error" />
          <WiseButton label="Tentar novamente" onPress={() => void profile.refetch()} />
        </View>
      </Screen>
    );
  }
  const user = profile.data;
  if (!user) return null;
  const desktop = isDesktopLayout(Platform.OS, width);
  // Touch platforms refresh by pulling the screen down; the button is only for web, which has no such gesture.
  const canPullToRefresh = Platform.OS !== 'web';
  const refreshProps = canPullToRefresh ? { refreshing, onRefresh: () => { void refresh(); } } : {};
  return <Screen backgroundOverlay={<DashboardGlow />} safeAreaEdges={[]} title="Acampamento" testID="dashboard" {...refreshProps}>
    {partialErrorMessage ? <View accessibilityLiveRegion="none" aria-live="off" style={styles.partialError} testID="dashboard-partial-error"><WiseText color="feedbackDanger" variant="caption">{partialErrorMessage}</WiseText></View> : null}
    <DashboardLayout
      desktop={desktop}
      header={<>
        <ProfileCard
          compact={width < 640}
          displayName={user.displayName}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
          showRefreshButton={!canPullToRefresh}
          statusMessage={statusMessage}
          title={user.title}
        />
        {profile.isError ? <ProfileRefreshError onRetry={() => void profile.refetch()} retrying={profile.isRefetching} /> : null}
      </>}
      summary={<>
        <ProgressionCard desktop={desktop} level={user.level} levelStartXp={user.levelStartXp} nextLevelXp={user.nextLevelXp} weekSubjects={weekSummary.data?.subjects} xpTotal={user.xpTotal} />
        <MetricsCard
          isError={metrics.isError}
          isPending={metrics.isPending}
          isRefetching={metrics.isRefetching}
          metrics={metrics.data}
          onRetry={() => void retryMetrics()}
          sessionsObjective={sessionsObjective}
          weeklyObjective={weeklyObjective}
        />
      </>}
      cadence={metrics.data ? <CadenceCard cadence={metrics.data.cadence} /> : null}
      activity={<ActivityCard
        isError={activity.isError}
        isPending={activity.isPending}
        isRefetching={activity.isRefetching}
        onRetry={() => void retryActivity()}
        sessions={activity.data}
      />}
      actions={<>
        <GuildCard />
        <FocusAction />
      </>}
    />
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { gap: theme.space.stackDefault, padding: theme.space.cardInset },
  errorContent: { gap: theme.space.stackDefault },
  partialError: { marginBottom: theme.space.stackTight },
});
