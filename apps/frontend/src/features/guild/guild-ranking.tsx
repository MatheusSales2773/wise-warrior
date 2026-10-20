import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, WiseCard, WiseText, theme } from '@/design-system';
import { SectionHeader, useFocusRing } from '@/features/character/character-parts';
import type { RaidRankingEntry } from './api';
import { HeroAvatar } from './hero-avatar';
import { formatPosition } from './messages';
import { rowText } from './guild-row-text';
import { raidRankingQueryOptions } from './queries';
import { formatFocusHours, rankingEntryLabel } from './raid-battle';

/* Ranking interno da 06c: só os primeiros Participantes; a lista inteira fica na tela "Ver batalha". */

/** Rows per layout, as in the Figma 06c frames: five on the desktop, four on the phone. */
const RANKING_ROWS = { desktop: 5, mobile: 4 } as const;

const { fontFamily: mono } = theme.type.mono;
/** Figma 06c values with no token in the spacing scale. */
const CARD_PADDING = 9;
const ROW_PADDING_RIGHT = 14;
const BAR_WIDTH = { desktop: 160, compact: 56 } as const;
const HOURS_WIDTH = 44;
const POSITION_WIDTH = 22;

function SeeAllLink() {
  const { focusProps, focusStyle } = useFocusRing();
  return <Link asChild href="/guilda/raid">
    <Pressable {...focusProps} accessibilityLabel="Ver todos os participantes do Ranking interno" accessibilityRole="link" hitSlop={12} style={StyleSheet.flatten([styles.seeAll, focusStyle])} testID="guild-ranking-all">
      <Text style={styles.seeAllText}>Ver todos</Text>
    </Pressable>
  </Link>;
}

function RankingItem({ compact, entry, fraction }: { compact: boolean; entry: RaidRankingEntry; fraction: number }) {
  const name = entry.isMe ? (compact ? 'Você' : `${entry.displayName} (você)`) : entry.displayName;
  const detail = [`Nv ${entry.level}`, entry.title].filter(Boolean).join(' · ');
  return (
    <View
      accessible
      accessibilityLabel={rankingEntryLabel(entry)}
      style={[styles.item, entry.isMe && styles.itemMe]}
      testID={`guild-ranking-item-${entry.userId}`}
    >
      <Text style={[styles.position, entry.position === 1 && styles.positionFirst]}>{formatPosition(entry.position)}</Text>
      <HeroAvatar entry={entry} style={styles.avatar} />
      <View style={styles.main}>
        <Text numberOfLines={1} style={[rowText.name, entry.isMe && styles.nameMe]}>{name}</Text>
        <Text numberOfLines={1} style={rowText.detail}>{detail}</Text>
      </View>
      <View style={compact ? styles.barCompact : styles.bar}>
        <ProgressBar accessibilityLabel={`Contribuição de ${entry.isMe ? 'você' : entry.displayName}`} maximumValue={1} size="hairline" value={fraction} />
      </View>
      <Text style={styles.hours}>{formatFocusHours(entry.contributionXp, { precise: true })}</Text>
    </View>
  );
}

export function RankingCard({ compact, guildId, raidId }: { compact: boolean; guildId: string; raidId: string }) {
  const ranking = useInfiniteQuery(raidRankingQueryOptions(guildId, raidId));
  const entries = ranking.data?.pages.flatMap((page) => page.items) ?? [];
  // The ranking is sorted by Contribution, so the first row is the best one and sets the bar scale.
  const best = Math.max(0, ...entries.map((entry) => entry.contributionXp));
  const rows = entries.slice(0, compact ? RANKING_ROWS.mobile : RANKING_ROWS.desktop);

  const body = (() => {
    if (ranking.isPending) return <WiseText color="textSecondary" testID="guild-ranking-loading" variant="body">Carregando o ranking…</WiseText>;
    if (ranking.isError && !ranking.data) {
      return <View style={styles.message} testID="guild-ranking-error">
        <FeedbackMessage message="Não foi possível carregar o Ranking interno." title="Ranking indisponível" variant="error" />
        <WiseButton label="Tentar novamente" loading={ranking.isRefetching} onPress={() => void ranking.refetch()} variant="secondary" />
      </View>;
    }
    if (!rows.length) {
      return <WiseText color="textSecondary" testID="guild-ranking-empty" variant="body">Ninguém confirmou participação ainda. Participe para abrir o ranking.</WiseText>;
    }
    return <>
      {ranking.isError ? <FeedbackMessage message="Não foi possível atualizar o ranking." testID="guild-ranking-stale" title="Dados desatualizados" variant="error" /> : null}
      {rows.map((entry) => <RankingItem compact={compact} entry={entry} fraction={best > 0 ? entry.contributionXp / best : 0} key={entry.userId} />)}
    </>;
  })();

  return (
    <View accessibilityLabel="Ranking interno" role="region" style={styles.block} testID="guild-ranking">
      <SectionHeader aside={<SeeAllLink />}>Ranking interno</SectionHeader>
      <WiseCard style={styles.card}>{body}</WiseCard>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: theme.space.stackTight },
  card: { padding: CARD_PADDING, gap: theme.space.inlineHairline },
  message: { gap: theme.space.stackDefault, padding: theme.space.stackTight },
  seeAll: { minHeight: 44, justifyContent: 'center' },
  seeAllText: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: theme.color.accentPrimary },
  item: { flexDirection: 'row', alignItems: 'center', gap: theme.space.stackTight, paddingVertical: theme.space.inlineTight, paddingLeft: theme.space.stackTight, paddingRight: ROW_PADDING_RIGHT, borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: 'transparent' },
  // The own row is marked by a border and by the name as well as by the fill, never by color alone.
  itemMe: { backgroundColor: theme.color.surfaceElevated, borderColor: theme.color.accentMuted },
  position: { width: POSITION_WIDTH, fontFamily: mono, fontSize: 11, lineHeight: 15, letterSpacing: 0.8, color: theme.color.textTertiary },
  positionFirst: { color: theme.color.accentHighlight },
  avatar: { borderColor: theme.color.borderGhost },
  main: { flex: 1, minWidth: 0, gap: 2 },
  nameMe: { color: theme.color.accentHighlight },
  bar: { width: BAR_WIDTH.desktop },
  barCompact: { width: BAR_WIDTH.compact },
  hours: { width: HOURS_WIDTH, textAlign: 'right', fontFamily: mono, fontSize: 11, lineHeight: 15, color: theme.color.textPrimary },
});
