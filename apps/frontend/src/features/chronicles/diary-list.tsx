import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseText, theme } from '@/design-system';
import type { SessionHistoryItem, SessionHistoryState } from '@/features/dashboard/api';
import { formatDuration } from '@/features/dashboard/formatters';
import { sessionHistoryQueryOptions } from '@/features/dashboard/queries';
import { useFocusRing } from '@/features/character/character-parts';
import { diaryStatus, diaryXp, groupByDay, isDiscarded, isTruncated, rowLabel, sessionClock } from './diary';

type Filter = 'all' | SessionHistoryState;

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'completed', label: 'Concluídas' },
  { id: 'truncated', label: 'Truncadas' },
  { id: 'discarded', label: 'Descartadas' },
];

const EMPTY_COPY: Record<Filter, string> = {
  all: 'Nenhuma sessão por aqui ainda. As sessões que você encerrar aparecem no Diário.',
  completed: 'Nenhuma sessão concluída.',
  truncated: 'Nenhuma sessão truncada.',
  discarded: 'Nenhuma sessão descartada.',
};

/** The Diário: Study Sessions across days, newest first, with the server-side outcome filters. */
export function Diary({ desktop, loadMore }: { desktop: boolean; loadMore: boolean }) {
  const [filter, setFilter] = useState<Filter>('all');
  const history = useInfiniteQuery(sessionHistoryQueryOptions({ state: filter === 'all' ? undefined : filter }));
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = history;

  // Infinite scroll: the screen reports when the reader is near the end of what is loaded.
  useEffect(() => {
    if (loadMore && hasNextPage && !isFetching && !isFetchNextPageError) void fetchNextPage();
  }, [loadMore, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage, items.length]);

  const body = (() => {
    if (history.isPending) return <WiseText color="textSecondary" testID="diary-loading" variant="body">Carregando o Diário…</WiseText>;
    if (history.isError && !history.data) {
      return <View style={styles.stack} testID="diary-error">
        <FeedbackMessage message="Não foi possível carregar o Diário." title="Diário indisponível" variant="error" />
        <WiseButton label="Tentar novamente" loading={history.isRefetching} onPress={() => void history.refetch()} variant="secondary" />
      </View>;
    }
    if (!items.length) return <WiseText color="textSecondary" testID="diary-empty" variant="body">{EMPTY_COPY[filter]}</WiseText>;
    return <>
      {history.isError && !isFetchNextPageError ? <FeedbackMessage message="Não foi possível atualizar o Diário." testID="diary-stale" title="Dados desatualizados" variant="error" /> : null}
      {groupByDay(items).map((day) => (
        <View key={day.dayKey} testID={`diary-day-${day.dayKey}`}>
          <Text accessibilityRole="header" aria-level={2} style={styles.day}>{day.heading}</Text>
          {day.items.map((item) => <Row desktop={desktop} item={item} key={item.id} />)}
        </View>
      ))}
      {isFetchNextPageError ? <FeedbackMessage message="Não foi possível carregar mais sessões." testID="diary-more-error" title="Lista incompleta" variant="error" /> : null}
      {hasNextPage
        ? <WiseButton label="Carregar mais" loading={history.isFetchingNextPage} onPress={() => void fetchNextPage()} testID="diary-more" variant="ghost" />
        : null}
    </>;
  })();

  return <View style={styles.stack}>
    <View accessibilityLabel="Filtrar o Diário" role="tablist" style={styles.filters} testID="diary-filters">
      {FILTERS.map(({ id, label }) => <FilterChip active={filter === id} id={id} key={id} label={label} onPress={() => setFilter(id)} />)}
    </View>
    <View accessibilityLabel="Diário de sessões" role="region" style={styles.card} testID="diary">{body}</View>
  </View>;
}

function FilterChip({ active, id, label, onPress }: { active: boolean; id: Filter; label: string; onPress: () => void }) {
  const { focusProps, focusStyle } = useFocusRing();
  return <Pressable
    {...focusProps}
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
    aria-selected={active}
    onPress={onPress}
    style={StyleSheet.flatten([styles.chip, active && styles.chipActive, focusStyle])}
    testID={`diary-filter-${id}`}
  >
    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
  </Pressable>;
}

function Row({ desktop, item }: { desktop: boolean; item: SessionHistoryItem }) {
  const subject = item.subject?.trim() || 'Sem matéria';
  const guild = item.mode === 'guild';
  const dimmed = isTruncated(item) || isDiscarded(item);
  const duration = formatDuration(item.durationValidSeconds);
  return <View accessible accessibilityLabel={rowLabel(item)} style={styles.row} testID={`diary-item-${item.id}`}>
    <Text style={styles.clock}>{sessionClock(item.endedAt)}</Text>
    <View style={styles.main}>
      <Text numberOfLines={1} style={[styles.subject, dimmed && styles.subjectDimmed]}>{subject}</Text>
      {desktop
        ? <Text numberOfLines={1} style={styles.status} testID={`diary-status-${item.id}`}>{diaryStatus(item)}</Text>
        : <>
          <Text style={styles.status}>{guild ? 'Guilda' : 'Solo'} · {duration}</Text>
          {dimmed ? <Text style={styles.status} testID={`diary-status-${item.id}`}>{diaryStatus(item)}</Text> : null}
        </>}
    </View>
    {desktop ? <View style={[styles.pill, guild && styles.pillGuild]}><Text style={[styles.pillLabel, guild && styles.pillLabelGuild]}>{guild ? 'GUILDA' : 'SOLO'}</Text></View> : null}
    {desktop ? <Text style={styles.duration}>{duration}</Text> : null}
    <Text style={[styles.xp, isDiscarded(item) && styles.xpNone]} testID={`diary-xp-${item.id}`}>{diaryXp(item)}</Text>
  </View>;
}

const mono = 'JetBrainsMono-Medium';

const styles = StyleSheet.create({
  stack: { gap: 16 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: theme.layout.touchTarget, justifyContent: 'center', paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle },
  chipActive: { borderColor: theme.color.accentPrimary, backgroundColor: theme.color.surfaceCard },
  chipLabel: { fontFamily: 'Inter-SemiBold', fontSize: 12, lineHeight: 16, color: theme.color.textSecondary },
  chipLabelActive: { color: theme.color.accentHighlight },
  card: { gap: 4, paddingVertical: 8, paddingHorizontal: 22, paddingBottom: 22, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  day: { paddingTop: 14, paddingBottom: 6, fontFamily: mono, fontSize: 10, lineHeight: 14, letterSpacing: 1.2, color: theme.color.accentPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderGhost },
  clock: { fontFamily: mono, fontSize: 12, lineHeight: 16, color: theme.color.textTertiary },
  main: { flex: 1, minWidth: 1, gap: 3 },
  subject: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 18, color: theme.color.textPrimary },
  subjectDimmed: { color: theme.color.textSecondary },
  status: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: theme.color.textTertiary },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset },
  pillGuild: { borderColor: theme.color.accentMuted },
  pillLabel: { fontFamily: mono, fontSize: 9, lineHeight: 12, letterSpacing: 0.8, color: theme.color.textSecondary },
  pillLabelGuild: { color: theme.color.accentPrimary },
  duration: { width: 56, textAlign: 'right', fontFamily: mono, fontSize: 12, lineHeight: 16, color: theme.color.textSecondary },
  xp: { minWidth: 72, textAlign: 'right', fontFamily: mono, fontSize: 12, lineHeight: 16, color: theme.color.accentHighlight },
  xpNone: { color: theme.color.textTertiary },
});
