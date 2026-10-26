import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, theme } from '@/design-system';
import type { DailyObjective } from '@/features/chronicles/api';
import { useNow } from '@/features/chronicles/objectives';
import { CoinMark } from '@/features/market/coin';
import { coinsLabel as spokenCoins, formatCoins } from '@/features/market/formatters';
import { CardContent, FramedCard, SectionHeading, cardText, mono } from './card-chrome';
import { formatObjectivesHeader } from './formatters';

export type ObjectivesCardProps = {
  desktop: boolean;
  objectives: { items: DailyObjective[]; renewsAt: string } | undefined;
  isPending: boolean;
  isRefetching: boolean;
  onRetry: () => void;
};

const label = ({ title, completed, progress, target, coins }: DailyObjective) =>
  `${title}. ${completed ? 'Cumprido' : `${progress} de ${target}`}. ${spokenCoins(coins)}.`;

/** Objetivos de hoje: one row per Objetivo on desktop, a horizontal carousel of equal blocks on mobile. */
export function ObjectivesCard({ desktop, objectives, isPending, isRefetching, onRetry }: ObjectivesCardProps) {
  const now = useNow();
  const region = { accessibilityLabel: 'Objetivos de hoje', role: 'region' } as const;

  if (!objectives) {
    return <Shell desktop={desktop} testID={isPending ? 'dashboard-objectives-loading' : 'dashboard-objectives-error'} {...region}>
      {isPending
        ? <Text style={cardText.emptyState}>Carregando os Objetivos…</Text>
        : <>
          <FeedbackMessage message="Não foi possível carregar os Objetivos." title="Objetivos indisponíveis" variant="error" />
          <WiseButton label="Tentar novamente" loading={isRefetching} onPress={onRetry} variant="secondary" />
        </>}
    </Shell>;
  }

  const { items, renewsAt } = objectives;
  const header = formatObjectivesHeader(items.filter(({ completed }) => completed).length, items.length, renewsAt, now);
  return <Shell desktop={desktop} header={items.length ? header : undefined} testID={items.length ? 'dashboard-objectives' : 'dashboard-objectives-empty'} {...region}>
    {items.length === 0
      ? <Text style={cardText.emptyState}>Nenhum Objetivo para hoje.</Text>
      : desktop
        ? items.map((objective, index) => <ObjectiveRow key={objective.id} last={index === items.length - 1} objective={objective} />)
        : <ScrollView contentContainerStyle={styles.carousel} horizontal showsHorizontalScrollIndicator={false} testID="dashboard-objectives-carousel">
          {items.map((objective) => <ObjectiveBlock key={objective.id} objective={objective} />)}
        </ScrollView>}
  </Shell>;
}

function Shell({ children, desktop, header, testID, ...region }: { children: React.ReactNode; desktop: boolean; header?: string; testID: string; accessibilityLabel: string; role: 'region' }) {
  const headerRow = <View style={styles.header}>
    <SectionHeading>Objetivos de hoje</SectionHeading>
    {header ? <Text style={styles.renewal} testID="dashboard-objectives-renewal">{header}</Text> : null}
  </View>;
  if (desktop) {
    return <FramedCard {...region} testID={testID}>
      <CardContent>
        {headerRow}
        {children}
      </CardContent>
    </FramedCard>;
  }
  return <View {...region} style={styles.mobile} testID={testID}>
    {headerRow}
    {children}
  </View>;
}

function Reward({ coins, dim, size }: { coins: number; dim: boolean; size: number }) {
  return <View aria-hidden style={[styles.reward, dim && styles.dim]}>
    <CoinMark scale={2} />
    <Text style={[styles.coins, { fontSize: size }]}>{formatCoins(coins)}</Text>
  </View>;
}

function ObjectiveRow({ objective, last }: { objective: DailyObjective; last: boolean }) {
  const { completed, id, progress, target } = objective;
  return <View accessible accessibilityLabel={label(objective)} style={[styles.row, last && styles.rowLast]} testID={`dashboard-objective-${id}`}>
    <View style={[styles.mark, completed && styles.markDone]}>
      {completed ? <Text style={styles.markGlyph}>✓</Text> : null}
    </View>
    <View style={styles.main}>
      <Text style={[styles.title, completed && styles.titleDone]}>{objective.title}</Text>
      <View style={styles.progress}>
        <View style={styles.bar}>
          <ProgressBar maximumValue={target} size="hairline" testID={`dashboard-objective-${id}-bar`} tone={completed ? 'success' : 'accent'} value={progress} />
        </View>
        <Text style={styles.count}>{progress}/{target}</Text>
      </View>
    </View>
    <Reward coins={objective.coins} dim={completed} size={12} />
  </View>;
}

function ObjectiveBlock({ objective }: { objective: DailyObjective }) {
  const { completed, id, progress, target } = objective;
  return <View accessible accessibilityLabel={label(objective)} style={[styles.block, completed && styles.blockDone]} testID={`dashboard-objective-${id}`}>
    <View style={styles.blockTop}>
      {completed ? <Text style={styles.blockDoneLabel}>✓ Cumprido</Text> : <Text style={styles.blockCount}>{progress}/{target}</Text>}
      <Reward coins={objective.coins} dim={completed} size={11} />
    </View>
    <Text style={[styles.blockTitle, completed && styles.titleMuted]}>{objective.title}</Text>
    <ProgressBar maximumValue={target} size="hairline" testID={`dashboard-objective-${id}-bar`} tone={completed ? 'success' : 'accent'} value={progress} />
  </View>;
}

const styles = StyleSheet.create({
  mobile: { gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.space.stackTight, marginBottom: 8 },
  renewal: { ...mono, fontSize: 10, lineHeight: 14, color: theme.color.textTertiary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderGhost, borderStyle: 'dashed' },
  rowLast: { borderBottomWidth: 0 },
  mark: { width: 16, height: 16, borderRadius: 2, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  markDone: { borderColor: theme.color.accentPrimary, backgroundColor: theme.color.accentPrimary },
  markGlyph: { fontFamily: 'Inter-SemiBold', fontSize: 10, lineHeight: 12, color: theme.color.backgroundCanvas },
  main: { flex: 1, minWidth: 0, gap: 5 },
  title: { fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 17, color: theme.color.textPrimary },
  titleDone: { color: theme.color.textSecondary, textDecorationLine: 'line-through' },
  titleMuted: { color: theme.color.textTertiary },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { flex: 1, minWidth: 0 },
  count: { ...mono, fontSize: 10, color: theme.color.textTertiary },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dim: { opacity: 0.5 },
  coins: { fontFamily: 'JetBrainsMono-Bold', color: theme.color.textPrimary },
  carousel: { gap: 10, paddingRight: 24 },
  block: { width: 148, height: 100, justifyContent: 'space-between', padding: 12, borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  blockDone: { borderColor: theme.color.feedbackSuccess },
  blockTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  blockCount: { fontFamily: 'Cinzel-Bold', fontSize: 18, lineHeight: 22, color: theme.color.textPrimary },
  blockDoneLabel: { fontFamily: 'Inter-Bold', fontSize: 11, lineHeight: 14, color: theme.color.feedbackSuccess },
  blockTitle: { fontFamily: 'Inter-Medium', fontSize: 11, lineHeight: 15, color: theme.color.textSecondary },
});
