import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, WiseText, theme } from '@/design-system';
import { cosmeticSprite } from '@/features/character/catalog';
import { PixelSprite } from '@/features/character/PixelSprite';
import { itemSprites } from '@/features/character/sprites';
import type { Milestone } from './api';
import { milestoneBadge, milestoneDescription, milestoneShortName } from './milestones';
import { milestonesQueryOptions } from './queries';

const mono = 'JetBrainsMono-Medium';
const PIXEL = 4;
const MOBILE_PIXEL = 5;

const spriteOf = (milestone: Milestone) => itemSprites[cosmeticSprite({ category: 'badge', name: milestone.name })];

/** Marcos (ADR-014): the Badges of the Catálogo with their progress. A column of rows on desktop, four blocks on mobile. */
export function Milestones({ desktop }: { desktop: boolean }) {
  const milestones = useQuery(milestonesQueryOptions());

  if (milestones.isPending) return <WiseText color="textSecondary" testID="milestones-loading" variant="body">Carregando os Marcos…</WiseText>;
  if (!milestones.data) {
    return <View style={styles.stack} testID="milestones-error">
      <FeedbackMessage message="Não foi possível carregar os Marcos." title="Marcos indisponíveis" variant="error" />
      <WiseButton label="Tentar novamente" loading={milestones.isRefetching} onPress={() => void milestones.refetch()} variant="secondary" />
    </View>;
  }

  const { earned, total, items } = milestones.data;
  const count = <Text accessibilityLabel={`${earned} de ${total} conquistados`} style={styles.count} testID="milestones-count">{earned} de {total}</Text>;
  const heading = <Text accessibilityRole="header" aria-level={2} style={styles.heading}>◈ Marcos</Text>;

  if (desktop) {
    return <View accessibilityLabel="Marcos" role="region" style={styles.card} testID="milestones">
      <View style={styles.header}>{heading}{count}</View>
      {items.map((milestone) => <MilestoneRow key={milestone.id} milestone={milestone} />)}
    </View>;
  }
  return <View accessibilityLabel="Marcos" role="region" style={styles.mobile} testID="milestones">
    <View style={styles.header}>{heading}{count}</View>
    <View style={styles.blocks}>
      {items.map((milestone) => <MilestoneBlock key={milestone.id} milestone={milestone} />)}
    </View>
  </View>;
}

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const { earned, id } = milestone;
  const description = milestoneDescription(milestone);
  return <View accessible accessibilityLabel={`${milestone.name}. ${earned ? 'Conquistado' : description}.`} style={styles.row} testID={`milestone-${id}`}>
    <View style={[styles.sprite, earned && styles.spriteEarned]}>
      <PixelSprite opacity={earned ? 1 : 0.6} scale={PIXEL} sprite={spriteOf(milestone)} />
    </View>
    <View style={styles.main}>
      <View style={styles.titleLine}>
        <Text style={styles.name}>{milestone.name}</Text>
        {earned ? <View style={styles.pill}><Text style={styles.pillText}>Conquistado</Text></View> : null}
      </View>
      {earned ? null : <ProgressBar maximumValue={milestone.target} size="hairline" testID={`milestone-${id}-bar`} value={milestone.progress} />}
      <Text style={styles.description} testID={`milestone-${id}-description`}>{description}</Text>
    </View>
  </View>;
}

function MilestoneBlock({ milestone }: { milestone: Milestone }) {
  const { earned, id } = milestone;
  const badge = milestoneBadge(milestone);
  return <View accessible accessibilityLabel={`${milestone.name}. ${earned ? 'Conquistado' : milestoneDescription(milestone)}.`} style={[styles.block, earned && styles.blockEarned]} testID={`milestone-${id}`}>
    <PixelSprite opacity={earned ? 1 : 0.6} scale={MOBILE_PIXEL} sprite={spriteOf(milestone)} />
    <Text numberOfLines={1} style={styles.blockName}>{milestoneShortName(milestone)}</Text>
    <Text style={[styles.blockBadge, earned && styles.blockBadgeEarned]} testID={`milestone-${id}-badge`}>{badge}</Text>
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  card: { gap: 14, padding: 22, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  mobile: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heading: { fontFamily: 'Cinzel-Bold', fontSize: 11, lineHeight: 14, letterSpacing: 2.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  count: { fontFamily: mono, fontSize: 10, lineHeight: 14, letterSpacing: 1, color: theme.color.textTertiary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sprite: { padding: 6, borderRadius: 3, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset },
  spriteEarned: { borderColor: theme.color.accentPrimary, backgroundColor: theme.color.surfaceElevated },
  main: { flex: 1, minWidth: 1, gap: 5 },
  titleLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.textPrimary },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: theme.border.standard, borderColor: theme.color.feedbackSuccess, backgroundColor: theme.color.surfaceInset },
  pillText: { fontFamily: mono, fontSize: 9, lineHeight: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.color.feedbackSuccess },
  description: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 14, color: theme.color.textTertiary },
  blocks: { flexDirection: 'row', gap: 10 },
  block: { flex: 1, minWidth: 1, alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 10, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  blockEarned: { borderColor: theme.color.accentPrimary, backgroundColor: theme.color.surfaceElevated },
  blockName: { fontFamily: 'Inter-SemiBold', fontSize: 12, lineHeight: 15, color: theme.color.textPrimary },
  blockBadge: { fontFamily: mono, fontSize: 10, lineHeight: 14, color: theme.color.textTertiary },
  blockBadgeEarned: { color: theme.color.feedbackSuccess },
});
