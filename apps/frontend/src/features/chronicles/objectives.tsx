import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, WiseIcon, WiseText, theme } from '@/design-system';
import type { DailyObjective } from './api';
import { objectivesQueryOptions } from './queries';

const MINUTE_MS = 60_000;
const mono = 'JetBrainsMono-Medium';

/** "Renova em 08h 12min": the time left until the São Paulo midnight at which the Objetivos renew. */
export function renewalLabel(renewsAt: string, at: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((Date.parse(renewsAt) - at) / MINUTE_MS));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `Renova em ${pad(Math.floor(minutes / 60))}h ${pad(minutes % 60)}min`;
}

const coinsLabel = (coins: number) => `+${coins} ${coins === 1 ? 'Moeda' : 'Moedas'}`;

/** Re-reads the clock each minute so the countdown keeps moving while the tab stays open. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Objetivos de hoje (ADR-014): paid in Moedas the moment they are met, so there is nothing to claim. */
export function Objectives() {
  const objectives = useQuery(objectivesQueryOptions());
  const now = useNow();

  if (objectives.isPending) return <WiseText color="textSecondary" testID="objectives-loading" variant="body">Carregando os Objetivos…</WiseText>;
  if (!objectives.data) {
    return <View style={styles.stack} testID="objectives-error">
      <FeedbackMessage message="Não foi possível carregar os Objetivos." title="Objetivos indisponíveis" variant="error" />
      <WiseButton label="Tentar novamente" loading={objectives.isRefetching} onPress={() => void objectives.refetch()} variant="secondary" />
    </View>;
  }

  const { daily } = objectives.data;
  return <View accessibilityLabel="Objetivos de hoje" role="region" style={styles.card} testID="objectives-daily">
    <View style={styles.header}>
      <Text accessibilityRole="header" aria-level={2} style={styles.heading}>◈ Objetivos de hoje</Text>
      <Text style={styles.renewal} testID="objectives-renewal">{renewalLabel(daily.renewsAt, now)}</Text>
    </View>
    {daily.items.map((objective) => <Objective key={objective.id} objective={objective} />)}
  </View>;
}

function Objective({ objective }: { objective: DailyObjective }) {
  const { completed, id } = objective;
  const label = `${objective.title}. ${completed ? 'Cumprido' : `${objective.progress} de ${objective.target}`}. ${coinsLabel(objective.coins)}.`;
  return <View accessible accessibilityLabel={label} style={styles.row} testID={`objective-${id}`}>
    {completed
      ? <WiseIcon color="feedbackSuccess" name="checkmark-circle" size="emblem" />
      : <View style={styles.pending} />}
    <View style={styles.main}>
      <Text style={[styles.title, completed && styles.titleDone]}>{objective.title}</Text>
      <View style={styles.progress}>
        <View style={styles.bar}>
          <ProgressBar maximumValue={objective.target} size="hairline" testID={`objective-${id}-bar`} tone={completed ? 'success' : 'accent'} value={objective.progress} />
        </View>
        <Text style={styles.count} testID={`objective-${id}-count`}>{objective.progress}/{objective.target}</Text>
      </View>
    </View>
    <Text style={[styles.coins, completed && styles.coinsDone]}>{coinsLabel(objective.coins)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  card: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 10, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 8 },
  heading: { fontFamily: 'Cinzel-Bold', fontSize: 11, lineHeight: 14, letterSpacing: 2.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  renewal: { fontFamily: mono, fontSize: 10, lineHeight: 14, letterSpacing: 1, color: theme.color.textTertiary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderGhost },
  pending: { width: 20, height: 20, marginHorizontal: 1, borderRadius: 10, borderWidth: 1.5, borderColor: theme.color.accentMuted },
  main: { flex: 1, minWidth: 1, gap: 6 },
  title: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 18, color: theme.color.textPrimary },
  titleDone: { color: theme.color.textSecondary },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1, minWidth: 1 },
  count: { fontFamily: mono, fontSize: 10, lineHeight: 14, color: theme.color.textTertiary },
  coins: { fontFamily: mono, fontSize: 12, lineHeight: 16, color: theme.color.accentHighlight },
  coinsDone: { color: theme.color.textTertiary },
});
