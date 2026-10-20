import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { WiseCard, WiseText, theme } from '@/design-system';
import { SectionHeader } from '@/features/character/character-parts';
import { PixelSprite } from '@/features/character/PixelSprite';
import { itemSprites, type ItemSpriteName, type PixelSpriteData } from '@/features/character/sprites';
import type { RaidRewardCategory } from './api';
import { RAID_REWARD_RULE, formatRewardCategory, formatRewardCoins, formatRewardName } from './messages';
import { activeRaidQueryOptions } from './queries';

/* Card "Ao derrotar" da 06c: o que a Raid da semana dá a quem contribuir. */

/** The Guild coin of the Figma 06c (a proposal, so not in the item catalog). */
const coinSprite: PixelSpriteData = {
  palette: ['#3a2a10', '#f0c97a', '#b8863a', '#fff6dc'],
  rows: ['..aaaa..', '.abbbca.', 'abbdbbca', 'abdbbbca', 'abbbbbca', 'abbbbcca', '.acccca.', '..aaaa..'],
};

/** The API does not name a sprite per reward, so the art follows the category, as the Figma frame shows for a Título and an Acessório. */
const SPRITE_BY_CATEGORY: Record<RaidRewardCategory, ItemSpriteName> = {
  title: 'mestreDaAurora',
  accessory: 'cristalDaAurora',
  badge: 'seloDosMadrugadores',
  avatar: 'capuzDoErudito',
};

const { fontFamily: mono } = theme.type.mono;
const { fontFamily: sans } = theme.type.label;
/** The sprites are 8 px art and only scale by whole numbers: 3× fits the 40 px frame. */
const SPRITE_SCALE = 3;

function RewardRow({ detail, sprite, testID, title }: { detail: string; sprite: PixelSpriteData; testID?: string; title: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <View aria-hidden style={styles.frame}>
        <PixelSprite scale={SPRITE_SCALE} sprite={sprite} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
    </View>
  );
}

export function RewardsCard({ guildId }: { guildId: string }) {
  const raid = useQuery(activeRaidQueryOptions(guildId));

  const body = (() => {
    if (raid.isPending) return <WiseText color="textSecondary" testID="guild-rewards-loading" variant="body">Carregando as recompensas…</WiseText>;
    if (raid.isError && raid.data === undefined) {
      // The Raid card shares this query and owns the retry.
      return <Text style={styles.note} testID="guild-rewards-error">Não foi possível carregar as recompensas da Raid.</Text>;
    }
    if (!raid.data) {
      return <Text style={styles.note} testID="guild-rewards-empty">Sem Raid nesta semana. As recompensas aparecem quando a próxima começar.</Text>;
    }
    return <>
      {raid.data.rewards.map((reward) => (
        <RewardRow
          detail={formatRewardCategory(reward.category)}
          key={reward.itemId}
          sprite={itemSprites[SPRITE_BY_CATEGORY[reward.category]]}
          testID={`guild-reward-${reward.itemId}`}
          title={formatRewardName(reward)}
        />
      ))}
      <RewardRow detail="Para cada Participante" sprite={coinSprite} testID="guild-reward-coins" title={formatRewardCoins(raid.data.coins)} />
      <Text style={styles.note}>{RAID_REWARD_RULE}</Text>
    </>;
  })();

  return (
    <WiseCard accessibilityLabel="Ao derrotar" role="region" testID="guild-rewards">
      <View style={styles.content}>
        <SectionHeader>Ao derrotar</SectionHeader>
        {body}
      </View>
    </WiseCard>
  );
}

const styles = StyleSheet.create({
  // Figma 06c: 20 px of card padding, a value the spacing scale has no step for.
  content: { padding: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  frame: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: sans, fontSize: 13, lineHeight: 16, color: theme.color.textPrimary },
  rowDetail: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.textTertiary },
  note: { fontFamily: theme.type.body.fontFamily, fontSize: 11, lineHeight: 15, color: theme.color.textTertiary },
});
