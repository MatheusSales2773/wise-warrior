import { useQuery } from '@tanstack/react-query';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseText, isDesktopLayout, theme } from '@/design-system';
import { equippedItems } from '@/features/character/catalog';
import { activeRaidQueryOptions, myGuildQueryOptions } from '@/features/guild/queries';
import { milestonesQueryOptions, objectivesQueryOptions, useSessionsObjective, useWeeklyMinutesObjective } from '@/features/chronicles/queries';
import { coinBalanceQueryOptions } from '@/features/market/queries';
import { useActiveStudySession, useFocusCycle } from '@/features/study-session/queries';
import { ActivityCard } from './activity-card';
import { CadenceCard } from './cadence-card';
import { DashboardLayout } from './dashboard-layout';
import { FocusAction, FocusFooter, useActiveFocus } from './focus-action';
import { MetricsCard } from './metrics-card';
import { NextMilestoneCard, milestoneGridGap } from './next-milestone-card';
import { ObjectivesCard } from './objectives-card';
import { DashboardGlow, ProfileCard, ProfileRefreshError } from './profile-card';
import { ProgressionCard } from './progression-card';
import { RaidCard } from './raid-card';
import { profileQueryOptions, recentActivityQueryOptions, sessionMetricsQueryOptions, weekSummaryQueryOptions } from './queries';
import { useDashboardRefresh } from './use-dashboard-refresh';
import { useSingleFlightRetry } from './use-single-flight-retry';

export function DashboardScreen() {
  const profile = useQuery(profileQueryOptions());
  const activity = useQuery(recentActivityQueryOptions());
  const metrics = useQuery(sessionMetricsQueryOptions());
  const weekSummary = useQuery(weekSummaryQueryOptions());
  // A failed query hides only its own part: no balance, no "N/4", or "Iniciar foco" when the active session cannot load.
  const coins = useQuery(coinBalanceQueryOptions());
  const cycle = useFocusCycle();
  const activeSession = useActiveStudySession();
  const focus = useActiveFocus(activeSession.data);
  const objectives = useQuery(objectivesQueryOptions());
  const milestones = useQuery(milestonesQueryOptions());
  const guild = useQuery(myGuildQueryOptions());
  const guildId = guild.data?.guild.id;
  // Without a Guild there is no Raid to ask about, so this query only runs (and refreshes) once the Guild is known.
  const raid = useQuery({ ...activeRaidQueryOptions(guildId ?? ''), enabled: guildId !== undefined });
  const sessionsObjective = useSessionsObjective();
  const weeklyObjective = useWeeklyMinutesObjective();
  const { width } = useWindowDimensions();
  // Every query "Atualizar", pull-to-refresh and the partial-failure message cover. A new card's query joins here.
  const { partialErrorMessage, refresh, refreshing, statusMessage } = useDashboardRefresh([profile, activity, metrics, weekSummary, coins, cycle, activeSession, objectives, milestones, guild, ...(guildId === undefined ? [] : [raid])]);
  const retryActivity = useSingleFlightRetry(activity);
  const retryMetrics = useSingleFlightRetry(metrics);
  const retryObjectives = useSingleFlightRetry(objectives);
  const retryMilestones = useSingleFlightRetry(milestones);
  const retryGuild = useSingleFlightRetry(guild);
  const retryRaid = useSingleFlightRetry(raid);

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
  const focusAction = <FocusAction cycle={cycle.data} focus={focus} />;
  return <Screen
    backgroundOverlay={<DashboardGlow />}
    footer={desktop ? undefined : <FocusFooter cycle={cycle.data} focus={focus} />}
    safeAreaEdges={[]}
    title="Acampamento"
    testID="dashboard"
    {...refreshProps}
  >
    {partialErrorMessage ? <View accessibilityLiveRegion="none" aria-live="off" style={styles.partialError} testID="dashboard-partial-error"><WiseText color="feedbackDanger" variant="caption">{partialErrorMessage}</WiseText></View> : null}
    <DashboardLayout
      desktop={desktop}
      header={<>
        <ProfileCard
          action={desktop ? focusAction : undefined}
          coins={coins.data}
          compact={width < 640}
          displayName={user.displayName}
          equipped={equippedItems(user)}
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
      objectives={<ObjectivesCard
        desktop={desktop}
        isPending={objectives.isPending}
        isRefetching={objectives.isRefetching}
        objectives={objectives.data?.daily}
        onRetry={() => void retryObjectives()}
      />}
      highlights={<View style={desktop ? styles.highlightsStack : styles.highlightsGrid} testID="dashboard-highlights">
        <RaidCard desktop={desktop} guild={guild} onRetryGuild={() => void retryGuild()} onRetryRaid={() => void retryRaid()} raid={raid} />
        <NextMilestoneCard
          desktop={desktop}
          isPending={milestones.isPending}
          isRefetching={milestones.isRefetching}
          milestones={milestones.data}
          onRetry={() => void retryMilestones()}
        />
      </View>}
      cadence={metrics.data ? <CadenceCard cadence={metrics.data.cadence} /> : null}
      activity={<ActivityCard
        isError={activity.isError}
        isPending={activity.isPending}
        isRefetching={activity.isRefetching}
        onRetry={() => void retryActivity()}
        sessions={activity.data}
      />}
    />
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { gap: theme.space.stackDefault, padding: theme.space.cardInset },
  errorContent: { gap: theme.space.stackDefault },
  highlightsStack: { gap: 18 },
  // The Raid block on the left and the Próximo Marco on the right, side by side.
  highlightsGrid: { flexDirection: 'row', gap: milestoneGridGap },
  partialError: { marginBottom: theme.space.stackTight },
});
