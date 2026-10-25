import { StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseText, theme } from '@/design-system';
import { CardContent, CardTitle, FramedCard, cardText, mono } from './card-chrome';
import { formatCappedReason, formatDiscardReason, formatDuration, formatSessionDate, formatXp } from './formatters';
import type { RecentStudySession } from './api';

const NO_SUBJECT_LABEL = 'Sem matéria';
const DETAIL_SEPARATOR = ' · ';

function joinDetails(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(DETAIL_SEPARATOR);
}

function formatSessionMode(mode: string): string {
  return mode === 'guild' ? 'guilda' : mode;
}

function formatSessionState(state: RecentStudySession['state']): string {
  switch (state) {
    case 'completed': return 'Concluída';
    case 'stopped_early': return 'Encerrada antecipadamente';
    case 'cancelled': return 'Cancelada';
    case 'discarded': return 'Descartada';
    case 'paused': return 'Pausada';
    case 'running': return 'Em andamento';
    default: return '';
  }
}

function describeActivity(session: RecentStudySession) {
  const subject = session.subject?.trim() || null;
  const subjectLabel = subject ?? NO_SUBJECT_LABEL;
  const isGuild = session.mode === 'guild';
  const modeLabel = formatSessionMode(session.mode);
  const discarded = session.discardedReason
    ? formatDiscardReason(session.discardedReason)
    : session.cappedReason ? formatCappedReason(session.cappedReason) : null;
  const xp = `${formatXp(session.xpAwarded)} XP`;
  const metaLine = joinDetails([formatSessionState(session.state), modeLabel, formatSessionDate(session.endedAt), formatDuration(session.durationValidSeconds)]);

  return {
    a11yLabel: `Sessão: ${joinDetails([subjectLabel, metaLine, xp, discarded])}`,
    discarded,
    hasSubject: subject !== null,
    metaLine,
    guildLabel: isGuild ? modeLabel : null,
    subjectLabel,
    xp,
  };
}

function ActivityItem({ session }: { session: RecentStudySession }) {
  const item = describeActivity(session);

  return (
    <View accessible accessibilityLabel={item.a11yLabel} style={styles.activityItem}>
      <View style={styles.activityMain}>
        <Text allowFontScaling ellipsizeMode="tail" numberOfLines={2} style={styles.activitySubject} testID={`dashboard-activity-title-${session.id}`}>
          <Text style={item.hasSubject ? undefined : styles.activityNoSubject}>{item.subjectLabel}</Text>
          {item.guildLabel ? `${DETAIL_SEPARATOR}${item.guildLabel}` : null}
        </Text>
        <Text style={styles.activityMeta} testID={`dashboard-activity-meta-${session.id}`}>{item.metaLine}</Text>
      </View>
      {item.discarded
        ? <Text style={styles.activityDiscarded}>{item.discarded}</Text>
        : <Text style={styles.activityXp}>+{item.xp}</Text>}
    </View>
  );
}

export type ActivityCardProps = {
  sessions: RecentStudySession[] | undefined;
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  onRetry: () => void;
};

export function ActivityCard({ sessions: loaded, isPending, isError, isRefetching, onRetry }: ActivityCardProps) {
  if (isPending && !loaded) {
    return (
      <FramedCard accessibilityLabel="Atividade recente" role="region" testID="dashboard-activity-loading">
        <CardContent>
          <CardTitle>Atividade recente</CardTitle>
          <Text style={cardText.emptyState}>Carregando sessões recentes…</Text>
        </CardContent>
      </FramedCard>
    );
  }

  if (isError && !loaded) {
    return (
      <FramedCard accessibilityLabel="Atividade recente" role="region" testID="dashboard-activity-error">
        <CardContent>
          <CardTitle>Atividade recente</CardTitle>
          <FeedbackMessage message="Não foi possível carregar suas sessões recentes." title="Atividade indisponível" variant="error" />
          <WiseButton label="Tentar novamente" loading={isRefetching} onPress={onRetry} variant="secondary" />
        </CardContent>
      </FramedCard>
    );
  }

  const sessions = loaded ?? [];
  return (
    <FramedCard accessibilityLabel="Atividade recente" role="region" testID={sessions.length ? 'dashboard-activity' : 'dashboard-activity-empty'}>
      <CardContent>
        <CardTitle>Atividade recente</CardTitle>
        {sessions.length
          ? sessions.slice(0, 5).map((session) => <ActivityItem key={session.id} session={session} />)
          : <Text style={cardText.emptyState}>Nenhuma sessão encerrada ainda. Suas sessões encerradas aparecerão aqui.</Text>}
        {isRefetching ? <WiseText color="textSecondary" testID="dashboard-activity-refreshing" variant="caption">Atualizando atividade…</WiseText> : null}
        {isError ? (
          <View style={styles.activityRefreshError} testID="dashboard-activity-refresh-error">
            <FeedbackMessage message="Não foi possível atualizar suas sessões concluídas." title="Atividade desatualizada" variant="error" />
            <WiseButton label="Tentar novamente" loading={isRefetching} onPress={onRetry} variant="secondary" />
          </View>
        ) : null}
      </CardContent>
    </FramedCard>
  );
}

const styles = StyleSheet.create({
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, minWidth: 0, paddingVertical: 10, borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderGhost, borderStyle: 'dashed' },
  activityMain: { flex: 1, minWidth: 0, gap: 3 },
  activitySubject: { fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 17, color: theme.color.textPrimary },
  activityNoSubject: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 17, color: theme.color.textTertiary },
  activityMeta: { fontFamily: 'Inter-Regular', fontSize: 10, lineHeight: 14, letterSpacing: 0.6, color: theme.color.textTertiary },
  activityXp: { fontFamily: 'JetBrainsMono-SemiBold', fontSize: 12, lineHeight: 17, color: theme.color.accentHighlight, flexShrink: 0 },
  activityDiscarded: { ...mono, fontSize: 11, lineHeight: 16, color: theme.color.feedbackDanger, flexShrink: 1, maxWidth: '45%', textAlign: 'right' },
  activityRefreshError: { gap: theme.space.stackDefault, marginTop: theme.space.stackTight },
});
