import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, WiseIcon, WiseText, theme } from '@/design-system';
import type { DailyObjective, WeeklyObjective } from './api';
import { objectivesQueryOptions } from './queries';
import { MINUTE_MS, useNow } from './use-now';

const mono = 'JetBrainsMono-Medium';

/** "Renova em 08h 12min": the time left until the São Paulo midnight at which the Objetivos renew. */
export function renewalLabel(renewsAt: string, at: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((Date.parse(renewsAt) - at) / MINUTE_MS));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `Renova em ${pad(Math.floor(minutes / 60))}h ${pad(minutes % 60)}min`;
}

/** The two numbers of a progress count; focus minutes read as hours with a decimal comma: "3,1" of "5h". */
function countParts({ progress, target, unit }: Pick<WeeklyObjective, 'progress' | 'target'> & { unit?: WeeklyObjective['unit'] }) {
  if (unit !== 'minutes') return { done: String(progress), total: String(target) };
  const hours = (minutes: number) => String(Math.floor((minutes / 60) * 10) / 10).replace('.', ',');
  return { done: hours(progress), total: `${hours(target)}h` };
}

/** "3,1/5h", "2/3": the count shown beside the bar. */
export function countLabel(progress: number, target: number, unit?: WeeklyObjective['unit']): string {
  const { done, total } = countParts({ progress, target, unit });
  return `${done}/${total}`;
}

const coinsLabel = (coins: number) => `+${coins} ${coins === 1 ? 'Moeda' : 'Moedas'}`;

/** Objetivos de hoje e da semana (ADR-014): pagos em Moedas no instante em que são cumpridos, sem nada a resgatar. */
export function Objectives({ desktop = true }: { desktop?: boolean }) {
  const objectives = useQuery(objectivesQueryOptions());
  const now = useNow();

  if (objectives.isPending) return <WiseText color="textSecondary" testID="objectives-loading" variant="body">Carregando os Objetivos…</WiseText>;
  if (!objectives.data) {
    return <View style={styles.stack} testID="objectives-error">
      <FeedbackMessage message="Não foi possível carregar os Objetivos." title="Objetivos indisponíveis" variant="error" />
      <WiseButton label="Tentar novamente" loading={objectives.isRefetching} onPress={() => void objectives.refetch()} variant="secondary" />
    </View>;
  }

  const { daily, weekly } = objectives.data;
  return <View style={styles.stack}>
    <ObjectivesCard
      heading="Objetivos de hoje"
      items={daily.items}
      renewal={renewalLabel(daily.renewsAt, now)}
      renewalTestID="objectives-renewal"
      testID="objectives-daily"
    />
    <ObjectivesCard
      heading={desktop ? 'Objetivos da semana' : 'Semana'}
      items={weekly.items}
      renewal="Renova segunda"
      renewalTestID="objectives-weekly-renewal"
      testID="objectives-weekly"
    />
  </View>;
}

function ObjectivesCard({ heading, items, renewal, renewalTestID, testID }: {
  heading: string;
  items: (DailyObjective | WeeklyObjective)[];
  renewal: string;
  renewalTestID: string;
  testID: string;
}) {
  return <View accessibilityLabel={heading} role="region" style={styles.card} testID={testID}>
    <View style={styles.header}>
      <Text accessibilityRole="header" aria-level={2} style={styles.heading}>◈ {heading}</Text>
      <Text style={styles.renewal} testID={renewalTestID}>{renewal}</Text>
    </View>
    {items.map((objective) => <Objective key={objective.id} objective={objective} />)}
  </View>;
}

function Objective({ objective }: { objective: DailyObjective | WeeklyObjective }) {
  const { completed, id } = objective;
  const unit = 'unit' in objective ? objective.unit : undefined;
  const { done, total } = countParts({ progress: objective.progress, target: objective.target, unit });
  const label = `${objective.title}. ${completed ? 'Cumprido' : `${done} de ${total}`}. ${coinsLabel(objective.coins)}.`;
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
        <Text style={styles.count} testID={`objective-${id}-count`}>{done}/{total}</Text>
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
