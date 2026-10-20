import { useInfiniteQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseCard, WiseText, theme } from '@/design-system';
import { SectionHeader } from '@/features/character/character-parts';
import type { PastRaid } from './api';
import { rowText } from './guild-row-text';
import { formatPastRaidMine, formatPastRaidOutcome, formatPastRaidPeriod, formatPastRaidSeal, formatPastRaidTotals, formatRaidWeek, formatWonRaids } from './messages';
import { pastRaidsQueryOptions } from './queries';

/* Raids anteriores da 06c: vencida ou não, e a Contribuição do usuário (só no desktop, como nos frames). */

const { fontFamily: mono } = theme.type.mono;
/** Figma 06c values with no token in the spacing scale. */
const CARD_PADDING = 8;
const ROW_PADDING = 12;

function PastRaidItem({ compact, first, raid }: { compact: boolean; first: boolean; raid: PastRaid }) {
  const isWon = raid.status === 'completed';
  const mineLabel = formatPastRaidMine(raid.me);
  const totals = formatPastRaidTotals(raid);
  return (
    <View
      accessible
      accessibilityLabel={`${raid.mission.name}. ${formatRaidWeek(raid.startsAt, raid.endsAt)}. ${formatPastRaidOutcome(raid.status)}. ${totals}. ${mineLabel}.`}
      style={[styles.item, !first && styles.itemDivided]}
      testID={`guild-past-raid-${raid.id}`}
    >
      <View style={styles.main}>
        <Text style={rowText.name}>{raid.mission.name}</Text>
        <Text style={rowText.detail}>{`${formatPastRaidPeriod(raid.startsAt, raid.endsAt)} · ${totals}`}</Text>
      </View>
      {compact ? null : <Text style={styles.mine} testID={`guild-past-raid-mine-${raid.id}`}>{mineLabel}</Text>}
      {/* The seal says it in words as well as in color. */}
      <View style={[styles.seal, isWon ? styles.sealWon : styles.sealLost]} testID={`guild-past-raid-outcome-${raid.id}`}>
        <Text style={[styles.sealText, isWon ? styles.sealTextWon : styles.sealTextLost]}>{formatPastRaidSeal(raid.status)}</Text>
      </View>
    </View>
  );
}

export function PastRaidsCard({ compact, guildId, level }: { compact: boolean; guildId: string; level: number }) {
  const past = useInfiniteQuery(pastRaidsQueryOptions(guildId));
  const raids = past.data?.pages.flatMap((page) => page.items) ?? [];

  const body = (() => {
    if (past.isPending) return <WiseText color="textSecondary" testID="guild-past-raids-loading" variant="body">Carregando as Raids anteriores…</WiseText>;
    if (past.isError && !past.data) {
      return <View style={styles.message} testID="guild-past-raids-error">
        <FeedbackMessage message="Não foi possível carregar as Raids anteriores." title="Histórico indisponível" variant="error" />
        <WiseButton label="Tentar novamente" loading={past.isRefetching} onPress={() => void past.refetch()} variant="secondary" />
      </View>;
    }
    if (!raids.length) {
      return <WiseText color="textSecondary" testID="guild-past-raids-empty" variant="body">Nenhuma Raid encerrada ainda. A primeira fecha no fim desta semana.</WiseText>;
    }
    return <>
      {past.isError ? <FeedbackMessage message="Não foi possível atualizar o histórico." testID="guild-past-raids-stale" title="Dados desatualizados" variant="error" /> : null}
      {raids.map((raid, index) => <PastRaidItem compact={compact} first={index === 0} key={raid.id} raid={raid} />)}
      {past.isFetchNextPageError ? <FeedbackMessage message="Não foi possível carregar mais Raids." title="Lista incompleta" variant="error" /> : null}
      {past.hasNextPage
        ? <WiseButton label="Carregar mais" loading={past.isFetchingNextPage} onPress={() => void past.fetchNextPage()} testID="guild-past-raids-more" variant="ghost" />
        : null}
    </>;
  })();

  const wonLabel = formatWonRaids(level);
  return (
    <View accessibilityLabel="Raids anteriores" role="region" style={styles.block} testID="guild-past-raids">
      <SectionHeader aside={<Text style={styles.aside} testID="guild-past-raids-won">{compact ? wonLabel : `Nível ${level} · ${wonLabel}`}</Text>}>Raids anteriores</SectionHeader>
      <WiseCard style={styles.card}>{body}</WiseCard>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: theme.space.stackTight },
  card: { padding: CARD_PADDING },
  message: { gap: theme.space.stackDefault, padding: theme.space.stackTight },
  aside: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: theme.color.textTertiary },
  item: { flexDirection: 'row', alignItems: 'center', gap: ROW_PADDING, padding: ROW_PADDING },
  itemDivided: { borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderGhost },
  main: { flex: 1, minWidth: 0, gap: 3 },
  mine: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.textSecondary },
  seal: { paddingVertical: 3, paddingHorizontal: theme.space.inlineTight, borderRadius: theme.radius.pill, borderWidth: theme.border.standard, backgroundColor: theme.color.surfaceInset },
  sealWon: { borderColor: theme.color.feedbackSuccess },
  sealLost: { borderColor: theme.color.feedbackDanger },
  sealText: { fontFamily: mono, fontSize: 9, lineHeight: 12, letterSpacing: 0.8 },
  sealTextWon: { color: theme.color.feedbackSuccess },
  sealTextLost: { color: theme.color.feedbackDanger },
});
