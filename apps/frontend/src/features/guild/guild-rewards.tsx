import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { WiseCard, WiseText, theme } from '@/design-system';
import { SectionHeader } from '@/features/character/character-parts';
import { PixelSprite } from '@/features/character/PixelSprite';
import { itemSprites, type ItemSpriteName } from '@/features/character/sprites';
import type { RaidRewardCategory } from './api';
import { CARD_PADDING, FRAME_RADIUS, cardText } from './guild-card-style';
import {
  RAID_REWARD_RULE, REWARDS_EMPTY, REWARDS_ERROR, REWARDS_LOADING, REWARD_COINS_DETAIL,
  formatRewardCategory, formatRewardCoins, formatRewardName,
} from './messages';
import { activeRaidQueryOptions } from './queries';

/* "Ao derrotar" card of the 06c: what the Raid of the week gives to whoever contributes. */

/** The API does not name a sprite per reward, so the art follows the category, as the Figma frame shows for a Título and an Acessório. */
const SPRITE_BY_CATEGORY: Record<RaidRewardCategory, ItemSpriteName> = {
  title: 'mestreDaAurora',
  accessory: 'cristalDaAurora',
  badge: 'seloDosMadrugadores',
  avatar: 'capuzDoErudito',
};

const REWARD_GAP = 12;
const REWARD_FRAME_SIZE = 40;
/** The sprites are 8 px art and only scale by whole numbers: 3× fits the 40 px frame. */
const SPRITE_SCALE = 3;

function RewardRow({ detail, sprite, testID, title }: { detail: string; sprite: ItemSpriteName; testID?: string; title: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <View aria-hidden style={styles.frame}>
        <PixelSprite scale={SPRITE_SCALE} sprite={itemSprites[sprite]} />
      </View>
      <View style={styles.rowText}>
        <Text style={cardText.name}>{title}</Text>
        <Text style={cardText.meta}>{detail}</Text>
      </View>
    </View>
  );
}

export function RewardsCard({ guildId }: { guildId: string }) {
  const raid = useQuery(activeRaidQueryOptions(guildId));

  const body = (() => {
    if (raid.isPending) return <WiseText color="textSecondary" testID="guild-rewards-loading" variant="body">{REWARDS_LOADING}</WiseText>;
    // The Raid card shares this query and owns the retry.
    if (raid.isError && raid.data === undefined) return <Text style={cardText.note} testID="guild-rewards-error">{REWARDS_ERROR}</Text>;
    if (!raid.data) return <Text style={cardText.note} testID="guild-rewards-empty">{REWARDS_EMPTY}</Text>;
    return <>
      {raid.data.rewards.map((reward) => (
        <RewardRow detail={formatRewardCategory(reward.category)} key={reward.itemId} sprite={SPRITE_BY_CATEGORY[reward.category]} testID={`guild-reward-${reward.itemId}`} title={formatRewardName(reward)} />
      ))}
      <RewardRow detail={REWARD_COINS_DETAIL} sprite="moedaDaGuilda" testID="guild-reward-coins" title={formatRewardCoins(raid.data.coins)} />
      <Text style={cardText.note}>{RAID_REWARD_RULE}</Text>
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
  content: { padding: CARD_PADDING, gap: REWARD_GAP },
  row: { flexDirection: 'row', alignItems: 'center', gap: REWARD_GAP },
  frame: { width: REWARD_FRAME_SIZE, height: REWARD_FRAME_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: FRAME_RADIUS, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
});
