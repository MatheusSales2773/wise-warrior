import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, WiseIcon, WiseText, theme } from '@/design-system';
import { isApiError } from '@/core/api/api-error';
import { SectionHeader } from '@/features/character/character-parts';
import { joinRaid, type ActiveRaid } from './api';
import { RAID_GOAL_REACHED, formatPosition, formatRaidEnds, formatRewardSummary, joinRaidErrorMessage } from './messages';
import { activeRaidQueryOptions, guildKeys } from './queries';
import { formatBattleTimeLeft, formatFocusHours, formatRaidHit, formatStreakDays, raidParty } from './raid-battle';
import { RaidScene } from './raid-scene';
import { raidSceneArt } from './raid-scene-art';
import { RAID_SCENE_HEIGHT, RAID_SCENE_WIDTH } from './raid-scene-sprites';
import { AttackButton, JoinRaidButton, TimePill, WeekGrid, bossLifeView } from './raid-shared';
import { useRaidTimeLeft } from './use-raid-clock';

/* Card da Raid da semana da Guilda, Figma "06c · Guilda — Início" (desktop e aba Raid do celular). */

const SCENE_FRAME_HEIGHT = { desktop: 220, mobile: 170 } as const;
/** Where the Figma crops the scene: 42% of the cut-off height goes above the frame, the rest below. */
const SCENE_CROP_TOP = 0.42;
const CONTRIBUTION_WIDTH = 260;

/** The smallest whole scale that covers the frame in both directions; the scene is centered and cropped, never letterboxed. */
function sceneScale(width: number, frameHeight: number): number {
  return Math.min(6, Math.max(2, Math.ceil(width / RAID_SCENE_WIDTH), Math.ceil(frameHeight / RAID_SCENE_HEIGHT)));
}

/** Golpe mais recente, in a panel over the top-right corner of the scene (desktop only, as in the Figma). */
function LastHitPanel({ raid }: { raid: ActiveRaid }) {
  if (!raid.lastHit) return null;
  const { damage, detail, label } = formatRaidHit(raid.lastHit);
  return <View accessible accessibilityLabel={label} accessibilityLiveRegion="polite" style={styles.hit} testID="guild-raid-last-hit">
    <Text style={styles.hitLabel}>ÚLTIMO GOLPE</Text>
    <Text numberOfLines={1} style={styles.hitValue}>{damage} · {detail}</Text>
  </View>;
}

function RaidCardScene({ desktop, raid }: { desktop: boolean; raid: ActiveRaid }) {
  const [width, setWidth] = useState(0);
  const frame = desktop ? SCENE_FRAME_HEIGHT.desktop : SCENE_FRAME_HEIGHT.mobile;
  const scale = sceneScale(width, frame);
  const cut = RAID_SCENE_HEIGHT * scale - frame;
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.scene, { height: frame }]} testID="guild-raid-image">
      {width > 0
        ? <View style={{ marginTop: -cut * SCENE_CROP_TOP }}>
          <RaidScene art={raidSceneArt(raid.mission.slug)} framed={false} party={raidParty(raid.party)} scale={scale} showTags={false} viewportWidth={width} />
        </View>
        : null}
      {desktop ? <>
        <View style={styles.sceneTopLeft}><TimePill compact={false} raid={raid} testID="guild-raid-time-left" /></View>
        <View style={styles.sceneTopRight}><LastHitPanel raid={raid} /></View>
      </> : null}
    </View>
  );
}

function BossLife({ raid }: { raid: ActiveRaid }) {
  const { percent, label } = bossLifeView(raid);
  return <View style={styles.life}>
    <View style={styles.spread}>
      <Text style={styles.caption}>VIDA DO DRAGÃO</Text>
      <Text style={styles.lifePercent} testID="guild-raid-boss-life-percent">{percent}%</Text>
    </View>
    <ProgressBar accessibilityLabel={label} maximumValue={100} size="slim" testID="guild-raid-boss-life" tone="danger" value={percent} />
    <Text style={styles.lifeCaption} testID="guild-raid-focus-hours">
      {formatFocusHours(raid.healthXp)} de vida · {formatFocusHours(raid.progressXp)} de {formatFocusHours(raid.goalXp + raid.regeneratedXp)} de foco coletivo
    </Text>
    {raid.goalReachedAt
      ? <Text accessibilityLiveRegion="polite" style={styles.goalReached} testID="guild-raid-goal-reached">{RAID_GOAL_REACHED}</Text>
      : null}
  </View>;
}

function Contribution({ desktop, raid }: { desktop: boolean; raid: ActiveRaid }) {
  const { participating, contributionXp, position } = raid.me;
  const hours = formatFocusHours(contributionXp, { precise: true });
  const value = participating ? `${hours}${position === null ? '' : ` · ${formatPosition(position)} lugar`}` : 'Ainda não participa';
  return <View accessible accessibilityLabel={`Sua contribuição: ${value}`} style={[styles.contribution, desktop && styles.contributionDesktop]} testID="guild-raid-contribution">
    <Text style={styles.caption}>SUA CONTRIBUIÇÃO</Text>
    <Text style={styles.contributionValue} testID="guild-raid-my-contribution">{value}</Text>
    <Text style={styles.contributionNote}>Dia inteiro sem estudo devolve {raid.furyPercent}% da vida ao dragão.</Text>
  </View>;
}

function RaidActions({ desktop, guildId, raid }: { desktop: boolean; guildId: string; raid: ActiveRaid }) {
  const queryClient = useQueryClient();
  const join = useMutation({
    mutationFn: () => joinRaid(raid.id),
    onSuccess: () => {
      queryClient.setQueryData<ActiveRaid | null>(
        guildKeys.raid(guildId),
        (current) => (current ? { ...current, me: { ...current.me, participating: true } } : current),
      );
      // The new Participant enters the Ranking interno with 0 XP. The Raid itself is not refetched.
      void queryClient.invalidateQueries({ queryKey: guildKeys.raidRanking(guildId, raid.id) });
    },
    // The Raid ended (409) or is gone: show the Raid that is current now.
    onError: (error) => {
      if (isApiError(error) && (error.category === 'conflict' || error.status === 404)) {
        void queryClient.invalidateQueries({ queryKey: guildKeys.raid(guildId) });
      }
    },
  });

  const battle = (
    <Link asChild href="/guilda/raid">
      <WiseButton accessibilityLabel={`Ver a batalha da Raid ${raid.mission.name}`} label="Ver batalha" testID="guild-raid-battle" variant="secondary" />
    </Link>
  );
  const main = raid.me.participating
    ? <AttackButton raid={raid} testID="guild-raid-attack" />
    : raid.status === 'expired'
      ? null
      : <JoinRaidButton label="Participar da Raid" loading={join.isPending} onPress={() => { if (!join.isPending) { join.reset(); join.mutate(); } }} testID="guild-raid-join" />;
  const summary = <View style={styles.reward} testID="guild-raid-reward">
    <WiseIcon color="accentPrimary" name="sparkles" size="xsmall" />
    <Text style={styles.rewardText}>{formatRewardSummary(raid)}</Text>
  </View>;

  return <View accessibilityLiveRegion="polite" style={styles.actions}>
    {join.isError ? <FeedbackMessage message={joinRaidErrorMessage(join.error)} testID="guild-raid-join-error" title="Participação não confirmada" variant="error" /> : null}
    {desktop
      ? <View style={styles.actionsRow}>
        {summary}
        <View style={styles.buttonRow}>{battle}{main}</View>
      </View>
      : <>{summary}{main}{battle}</>}
  </View>;
}

function RaidBody({ desktop, guildId, raid }: { desktop: boolean; guildId: string; raid: ActiveRaid }) {
  return (
    <>
      <RaidCardScene desktop={desktop} raid={raid} />
      <View style={[styles.body, desktop && styles.bodyDesktop]}>
        <Text accessibilityRole="header" aria-level={3} style={[styles.title, desktop && styles.titleDesktop]} testID="guild-raid-mission-name">{raid.mission.name}</Text>
        {desktop ? <Text style={styles.description}>{raid.mission.description}</Text> : null}
        <BossLife raid={raid} />
        <View style={[styles.sequenceRow, desktop && styles.sequenceRowDesktop]}>
          <View style={styles.sequence}>
            <Text style={styles.caption}>SEQUÊNCIA DA GUILDA</Text>
            <WeekGrid raid={raid} />
            <Text style={styles.streak} testID="guild-raid-streak">{formatStreakDays(raid.streak)}</Text>
          </View>
          <Contribution desktop={desktop} raid={raid} />
        </View>
        <View style={styles.divider} />
        <RaidActions desktop={desktop} guildId={guildId} raid={raid} />
      </View>
    </>
  );
}

/** Desktop: when the week ends. Phone: the countdown, because the scene chip is hidden there. */
function RaidAside({ desktop, raid }: { desktop: boolean; raid: ActiveRaid }) {
  const left = useRaidTimeLeft(raid);
  if (desktop) return <Text style={styles.aside} testID="guild-raid-ends">{formatRaidEnds(raid.endsAt)}</Text>;
  return <Text style={styles.aside} testID="guild-raid-time-left">{formatBattleTimeLeft(left, { long: true })}</Text>;
}

export function RaidCard({ desktop, guildId }: { desktop: boolean; guildId: string }) {
  const raid = useQuery(activeRaidQueryOptions(guildId));

  const body = (() => {
    if (raid.isPending) return <View style={styles.message}><WiseText color="textSecondary" testID="guild-raid-loading" variant="body">Carregando a Raid da semana…</WiseText></View>;
    if (raid.isError && raid.data === undefined) {
      return <View style={styles.message} testID="guild-raid-error">
        <FeedbackMessage message="Não foi possível carregar a Raid da semana." title="Raid indisponível" variant="error" />
        <WiseButton label="Tentar novamente" loading={raid.isRefetching} onPress={() => void raid.refetch()} variant="secondary" />
      </View>;
    }
    if (!raid.data) {
      return <View style={styles.message}><WiseText color="textSecondary" testID="guild-raid-empty" variant="body">Sua guilda ainda não tem uma Raid nesta semana. Volte em breve.</WiseText></View>;
    }
    return <>
      {raid.isError
        ? <View style={styles.stale}><FeedbackMessage message="Não foi possível atualizar a Raid." testID="guild-raid-stale" title="Dados desatualizados" variant="error" /></View>
        : null}
      <RaidBody desktop={desktop} guildId={guildId} raid={raid.data} />
    </>;
  })();

  return (
    <View accessibilityLabel="Raid da semana" role="region" style={styles.block} testID="guild-raid">
      <SectionHeader aside={raid.data ? <RaidAside desktop={desktop} raid={raid.data} /> : undefined}>Raid da semana</SectionHeader>
      <View style={styles.card}>{body}</View>
    </View>
  );
}

const cinzel = 'Cinzel-Bold';
const mono = 'JetBrainsMono-Medium';
const glassBackground = 'rgba(7, 7, 12, 0.72)';

const styles = StyleSheet.create({
  block: { gap: theme.space.stackTight },
  card: { overflow: 'hidden', borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard },
  message: { gap: theme.space.stackDefault, padding: theme.space.cardInset },
  stale: { padding: theme.space.stackTight },
  aside: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: theme.color.textTertiary },

  scene: { overflow: 'hidden', backgroundColor: theme.color.surfaceInset },
  sceneTopLeft: { position: 'absolute', top: 16, left: 16 },
  sceneTopRight: { position: 'absolute', top: 16, right: 16, maxWidth: '45%' },
  hit: { gap: 2, paddingHorizontal: 13, paddingVertical: 9, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: glassBackground },
  hitLabel: { fontFamily: mono, fontSize: 9, lineHeight: 12, letterSpacing: 0.8, color: theme.color.textTertiary },
  hitValue: { fontFamily: mono, fontSize: 11, lineHeight: 15, color: theme.color.accentHighlight },

  body: { gap: 14, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16 },
  bodyDesktop: { gap: 16, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 22 },
  title: { fontFamily: cinzel, fontSize: 22, lineHeight: 27, color: theme.color.textPrimary },
  titleDesktop: { fontSize: 24, lineHeight: 32 },
  description: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 19, color: theme.color.textSecondary },

  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  caption: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: theme.color.textTertiary },
  life: { gap: 8 },
  lifePercent: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: theme.color.feedbackDanger },
  lifeCaption: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.textTertiary },
  goalReached: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 18, color: theme.color.accentPrimary },

  sequenceRow: { gap: 14 },
  sequenceRowDesktop: { flexDirection: 'row', gap: 24 },
  sequence: { flex: 1, gap: 8 },
  streak: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.feedbackSuccess },
  contribution: { gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset, alignSelf: 'stretch' },
  contributionDesktop: { width: CONTRIBUTION_WIDTH },
  contributionValue: { fontFamily: cinzel, fontSize: 18, lineHeight: 24, color: theme.color.accentHighlight },
  contributionNote: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 15, color: theme.color.textTertiary },

  divider: { height: 1, backgroundColor: theme.color.borderGhost },
  actions: { gap: 10 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  buttonRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  reward: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  rewardText: { flexShrink: 1, fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 17, color: theme.color.accentPrimary },
});
