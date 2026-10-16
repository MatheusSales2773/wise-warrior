import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseIcon, WiseText, isDesktopLayout, theme } from '@/design-system';
import { cosmeticSprite } from '@/features/character/catalog';
import { PixelSprite } from '@/features/character/PixelSprite';
import { itemSprites } from '@/features/character/sprites';
import { useFocusRing } from '@/features/character/character-parts';
import type { ActiveRaid, MyGuild, RaidRankingEntry } from './api';
import { RAID_GOAL_REACHED, formatPosition } from './messages';
import { activeRaidQueryOptions, myGuildQueryOptions, raidRankingQueryOptions } from './queries';
import { assignHeroes, bossLifePercent, formatBattleTimeLeft, formatFocusHours, formatStreak, partyHeroSprites, raidParty, raidWeekGrid, weeklyStrikes, type PartyHero, type Strike, type WeekDay } from './raid-battle';
import { RaidScene, raidSceneScale } from './raid-scene';

/* Tela da Raid, Figma "06b · Guilda — Raid · O Devorador de Horas" (desktop e mobile). */

const DESKTOP_GUTTER = 56;
const DESKTOP_MAX_CONTENT = 1080;
const MOBILE_GUTTER = 24;
/** Rows of "Golpes da semana" per layout, as in the Figma frames. */
const STRIKE_ROWS = { desktop: 4, mobile: 3 } as const;
const REWARD_RULE_CAPTION = 'Para todos que contribuírem';

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function BackLink({ compact }: { compact: boolean }) {
  const { focusProps, focusStyle } = useFocusRing();
  return <Link asChild href="/guilda">
    <Pressable {...focusProps} accessibilityLabel="Voltar para a Guilda" accessibilityRole="link" hitSlop={12} style={StyleSheet.flatten([styles.back, focusStyle])} testID="raid-back">
      <WiseIcon color="accentPrimary" name="chevron-back" size="xsmall" />
      <Text style={[styles.backText, compact && styles.backTextCompact]}>Guilda</Text>
    </Pressable>
  </Link>;
}

function RaidHeading({ compact, guildName, raid }: { compact: boolean; guildName: string; raid: ActiveRaid }) {
  return <View style={styles.heading}>
    <Text style={[styles.eyebrow, compact && styles.eyebrowCompact]}>{compact ? 'Raid semanal' : `Raid semanal · ${guildName}`}</Text>
    <Text accessibilityRole="header" aria-level={1} style={[styles.title, compact && styles.titleCompact]} testID="raid-mission-name">{raid.mission.name}</Text>
    <Text style={[styles.description, compact && styles.descriptionCompact]}>{raid.mission.description}</Text>
  </View>;
}

function TimePill({ compact, raid }: { compact: boolean; raid: ActiveRaid }) {
  const now = useNow(30_000);
  const left = new Date(raid.endsAt).getTime() - now;
  return <View style={[styles.glass, styles.timePill, compact && styles.timePillCompact]}>
    <WiseIcon color="textPrimary" name="time-outline" size="xsmall" />
    <Text style={[styles.timeText, compact && styles.timeTextCompact]} testID="raid-time-left">{formatBattleTimeLeft(left, { long: !compact })}</Text>
  </View>;
}

function lifeLabel(raid: ActiveRaid): { percent: number; label: string } {
  const percent = bossLifePercent(raid.progressXp, raid.goalXp, raid.goalReachedAt !== null);
  return { percent, label: `Vida do dragão: ${percent}%. ${formatFocusHours(raid.progressXp)} de ${formatFocusHours(raid.goalXp)} de foco coletivo.` };
}

function LifeBar({ percent, label }: { percent: number; label: string }) {
  return <ProgressBar accessibilityLabel={label} maximumValue={100} size="slim" testID="raid-boss-life" tone="danger" value={percent} />;
}

/** Desktop: painel sobre a cena, no canto superior direito. */
function BossLifePanel({ raid }: { raid: ActiveRaid }) {
  const { percent, label } = lifeLabel(raid);
  return <View style={[styles.glass, styles.lifePanel]}>
    <View style={styles.spread}>
      <Text style={styles.lifeTitle}>Vida do dragão</Text>
      <Text style={styles.lifePercent} testID="raid-boss-life-percent">{percent}%</Text>
    </View>
    <LifeBar label={label} percent={percent} />
    <Text style={styles.lifeCaption} testID="raid-focus-hours">{formatFocusHours(raid.progressXp)} de {formatFocusHours(raid.goalXp)} de foco coletivo</Text>
  </View>;
}

/** Celular: linha sob a cena. */
function BossLifeRow({ raid }: { raid: ActiveRaid }) {
  const { percent, label } = lifeLabel(raid);
  return <View style={styles.lifeRow}>
    <View style={styles.spread}>
      <Text style={styles.lifeTitle}>Vida do dragão</Text>
      <Text style={styles.lifeMeta} testID="raid-boss-life-percent">{percent}% · {formatFocusHours(raid.progressXp)}/{formatFocusHours(raid.goalXp)}</Text>
    </View>
    <LifeBar label={label} percent={percent} />
  </View>;
}

function GoalReached({ raid }: { raid: ActiveRaid }) {
  if (!raid.goalReachedAt) return null;
  return <Text accessibilityLiveRegion="polite" style={styles.goalReached} testID="raid-goal-reached">{RAID_GOAL_REACHED}</Text>;
}

function Card({ children, label, testID }: PropsWithChildren<{ label: string; testID: string }>) {
  return <View accessibilityLabel={label} role="region" style={styles.card} testID={testID}>{children}</View>;
}

function CardHeader({ aside, children }: PropsWithChildren<{ aside?: string }>) {
  return <View style={styles.spreadCenter}>
    <View style={styles.cardTitle}>
      <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no" style={styles.cardTitleText}>◈</Text>
      <Text accessibilityRole="header" aria-level={2} style={[styles.cardTitleText, styles.cardTitleLabel]}>{children}</Text>
    </View>
    {aside ? <Text style={styles.cardAside}>{aside}</Text> : null}
  </View>;
}

function StrikeRow({ compact, hero, strike }: { compact: boolean; hero: PartyHero; strike: Strike }) {
  const { entry, fraction } = strike;
  const name = entry.isMe ? (compact ? `Você · ${formatPosition(entry.position)}` : 'Você') : entry.displayName;
  const hours = formatFocusHours(entry.contributionXp, { precise: true });
  return <View
    accessible
    accessibilityLabel={`${formatPosition(entry.position)}: ${entry.isMe ? 'você' : entry.displayName}, ${hours} de foco`}
    style={styles.strike}
    testID={`raid-strike-${entry.userId}`}
  >
    <View style={styles.avatar}>
      <PixelSprite scale={2} sprite={partyHeroSprites[hero]} style={styles.avatarSprite} />
    </View>
    <View style={styles.strikeMain}>
      <View style={styles.spread}>
        <Text numberOfLines={1} style={[styles.strikeName, entry.isMe && styles.strikeNameMe]}>{name}</Text>
        <Text style={styles.strikeHours}>{hours}</Text>
      </View>
      <ProgressBar accessibilityLabel={`Golpes de ${entry.isMe ? 'você' : entry.displayName}`} maximumValue={1} size="hairline" value={fraction} />
    </View>
  </View>;
}

function StrikesCard({ compact, entries, failed, heroes, loading }: { compact: boolean; entries: readonly RaidRankingEntry[]; failed: boolean; heroes: Map<string, PartyHero>; loading: boolean }) {
  const strikes = weeklyStrikes(entries, compact ? STRIKE_ROWS.mobile : STRIKE_ROWS.desktop);
  const body = (() => {
    if (loading) return <Text style={styles.cardNote}>Carregando os golpes…</Text>;
    if (failed && !entries.length) return <FeedbackMessage message="Não foi possível carregar o Ranking interno." testID="raid-strikes-error" title="Ranking indisponível" variant="error" />;
    if (!strikes.length) return <Text style={styles.cardNote} testID="raid-strikes-empty">Ninguém atacou ainda. Participe e conclua uma sessão de guilda na Forja.</Text>;
    return strikes.map((strike) => <StrikeRow compact={compact} hero={heroes.get(strike.entry.userId) ?? 'erudito'} key={strike.entry.userId} strike={strike} />);
  })();
  return <Card label="Golpes da semana" testID="raid-strikes">
    <CardHeader aside="Ranking">Golpes da semana</CardHeader>
    {body}
  </Card>;
}

const FURIA_COPY = 'Cada dia em que a guilda não estuda, o dragão recupera 5% de vida. Mantenham a chama acesa.';

type DayLook = {
  label: string;
  glyph: string;
  cell?: 'weekDayStudied' | 'weekDayToday';
  initial?: 'weekDayInitialToday';
  glyphStyle?: 'weekDayMarkStudied' | 'weekDayMarkToday';
};

/** One entry per day state: spoken label, glyph and the style keys that draw it (Figma 06b, card "Fúria do dragão"). */
const DAY_LOOKS: Record<WeekDay['state'], DayLook> = {
  studied: { label: 'com estudo', glyph: '✓', cell: 'weekDayStudied', glyphStyle: 'weekDayMarkStudied' },
  today: { label: 'hoje, ainda sem estudo', glyph: '•', cell: 'weekDayToday', initial: 'weekDayInitialToday', glyphStyle: 'weekDayMarkToday' },
  missed: { label: 'sem estudo', glyph: '·' },
  upcoming: { label: 'ainda não chegou', glyph: '·' },
};

function WeekGrid({ raid }: { raid: ActiveRaid }) {
  return <View style={styles.weekGrid} testID="raid-week-grid">
    {raidWeekGrid(raid).map((day) => {
      const look = DAY_LOOKS[day.state];
      return <View
        accessible
        accessibilityLabel={`${day.name}: ${look.label}`}
        key={day.key}
        style={[styles.weekDay, look.cell && styles[look.cell]]}
        testID={`raid-week-day-${day.state}`}
      >
        <Text style={[styles.weekDayInitial, look.initial && styles[look.initial]]}>{day.initial}</Text>
        <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no" style={[styles.weekDayMark, look.glyphStyle && styles[look.glyphStyle]]}>{look.glyph}</Text>
      </View>;
    })}
  </View>;
}

function FuriaCard({ raid }: { raid: ActiveRaid }) {
  return <Card label="Fúria do dragão" testID="raid-furia">
    <CardHeader aside="Regra da raid">Fúria do dragão</CardHeader>
    <Text style={styles.cardNote}>{FURIA_COPY}</Text>
    <WeekGrid raid={raid} />
    <Text style={styles.streak} testID="raid-streak">{formatStreak(raid.streak)}</Text>
  </Card>;
}

function FuriaStrip({ raid }: { raid: ActiveRaid }) {
  return <View accessibilityLabel="Fúria do dragão" role="region" style={styles.furiaStrip} testID="raid-furia">
    <WiseIcon color="feedbackDanger" name="flame" size="xsmall" />
    <View style={styles.furiaStripCopy}>
      <Text style={styles.furiaStripText}>Dias sem estudo devolvem 5% de vida ao dragão.</Text>
      <Text style={styles.furiaStripText} testID="raid-streak">{formatStreak(raid.streak, { compact: true })}</Text>
    </View>
  </View>;
}

function rewardName(raid: ActiveRaid): string {
  return raid.reward.category === 'title' ? `Título “${raid.reward.name}”` : raid.reward.name;
}

function AttackButton({ raid }: { raid: ActiveRaid }) {
  const now = useNow(30_000);
  const over = raid.status !== 'active' || new Date(raid.endsAt).getTime() <= now;
  return <Link asChild href="/sessao?modo=guilda">
    <WiseButton
      accessibilityLabel={`Atacar com foco: abrir a Forja com uma sessão de guilda para a Raid ${raid.mission.name}`}
      disabled={over}
      label="Atacar com foco"
      leading={<WiseIcon color={over ? 'textSecondary' : 'backgroundCanvas'} name="play" size="xsmall" />}
      testID="raid-attack"
    />
  </Link>;
}

function RewardsCard({ raid }: { raid: ActiveRaid }) {
  return <Card label="Ao derrotar" testID="raid-rewards">
    <CardHeader>Ao derrotar</CardHeader>
    <View accessible accessibilityLabel={`${rewardName(raid)}. ${REWARD_RULE_CAPTION}.`} style={styles.reward} testID="raid-reward">
      <View style={styles.rewardIcon}><PixelSprite scale={4} sprite={itemSprites[cosmeticSprite(raid.reward)]} /></View>
      <View style={styles.rewardCopy}>
        <Text style={styles.rewardName}>{rewardName(raid)}</Text>
        <Text style={styles.rewardCaption}>{REWARD_RULE_CAPTION}</Text>
      </View>
    </View>
    <View style={styles.fill} />
    <AttackButton raid={raid} />
  </Card>;
}

function RewardChips({ raid }: { raid: ActiveRaid }) {
  return <View accessible accessibilityLabel={`Ao derrotar: ${rewardName(raid)}. ${REWARD_RULE_CAPTION}.`} style={styles.chips} testID="raid-reward">
    <Text style={styles.chipsLabel}>AO DERROTAR</Text>
    <View style={styles.chip}>
      <PixelSprite scale={3} sprite={itemSprites[cosmeticSprite(raid.reward)]} />
      <Text numberOfLines={1} style={styles.chipText}>{raid.reward.name}</Text>
    </View>
  </View>;
}

function Battle({ desktop, mine, raid, viewport }: { desktop: boolean; mine: MyGuild; raid: ActiveRaid; viewport: number }) {
  const ranking = useInfiniteQuery(raidRankingQueryOptions(mine.guild.id, raid.id));
  const entries = ranking.data?.pages.flatMap((page) => page.items) ?? [];
  const heroes = assignHeroes(entries);
  const party = raidParty(entries, heroes);
  const scale = raidSceneScale(viewport);
  const strikes = <StrikesCard compact={!desktop} entries={entries} failed={ranking.isError} heroes={heroes} loading={ranking.isPending} />;

  const scene = <RaidScene
    overlay={<>
      <View style={[styles.overlayTopLeft, !desktop && styles.overlayTopLeftCompact]}><TimePill compact={!desktop} raid={raid} /></View>
      {desktop ? <View style={styles.overlayTopRight}><BossLifePanel raid={raid} /></View> : null}
    </>}
    party={party}
    scale={scale}
    showTags={desktop}
    viewportWidth={viewport}
  />;

  if (desktop) {
    return <View style={styles.sections}>
      <View style={styles.sceneBlock}>{scene}<GoalReached raid={raid} /></View>
      <View style={styles.detailsRow} testID="raid-details">
        <View style={styles.detailsColumn}>{strikes}</View>
        <View style={styles.detailsColumn}><FuriaCard raid={raid} /></View>
        <View style={styles.detailsColumn}><RewardsCard raid={raid} /></View>
      </View>
    </View>;
  }
  return <View style={styles.sectionsCompact}>
    {scene}
    <BossLifeRow raid={raid} />
    <GoalReached raid={raid} />
    <FuriaStrip raid={raid} />
    {strikes}
    <RewardChips raid={raid} />
  </View>;
}

function Message({ action, children, testID }: PropsWithChildren<{ action?: ReactNode; testID: string }>) {
  return <Screen safeAreaEdges={[]} testID="raid" title="Raid">
    <View style={styles.message} testID={testID}>
      <BackLink compact />
      {children}
      {action}
    </View>
  </Screen>;
}

export function RaidBattleScreen() {
  const { width } = useWindowDimensions();
  const mine = useQuery(myGuildQueryOptions());
  const guildId = mine.data?.guild.id;
  const raid = useQuery({ ...activeRaidQueryOptions(guildId ?? ''), enabled: guildId !== undefined });

  if (mine.isPending || (guildId !== undefined && raid.isPending)) {
    return <Screen safeAreaEdges={[]} testID="raid" title="Raid">
      <View accessibilityLabel="Carregando a Raid" accessibilityState={{ busy: true }} aria-busy style={styles.message} testID="raid-loading">
        <WiseText variant="body">Carregando a Raid da semana…</WiseText>
        <ProgressBar indeterminate accessibilityLabel="Carregando a Raid" />
      </View>
    </Screen>;
  }
  if ((mine.isError && mine.data === undefined) || (raid.isError && raid.data === undefined)) {
    const retry = () => { void (mine.isError ? mine.refetch() : raid.refetch()); };
    return <Message
      action={<WiseButton label="Tentar novamente" loading={mine.isRefetching || raid.isRefetching} onPress={retry} />}
      testID="raid-error"
    >
      <FeedbackMessage message="Não foi possível carregar a Raid da semana." title="Raid indisponível" variant="error" />
    </Message>;
  }
  if (!mine.data) {
    return <Message testID="raid-no-guild"><WiseText variant="body">Você ainda não participa de uma guilda. Entre em uma para enfrentar a Raid da semana.</WiseText></Message>;
  }
  if (!raid.data) {
    return <Message testID="raid-empty"><WiseText variant="body">Sua guilda ainda não tem uma Raid nesta semana. Volte em breve.</WiseText></Message>;
  }

  const desktop = isDesktopLayout(Platform.OS, width);
  const viewport = desktop
    ? Math.min(DESKTOP_MAX_CONTENT, width - theme.layout.sidebarWidth - DESKTOP_GUTTER * 2)
    : width - MOBILE_GUTTER * 2;
  const stale = raid.isError
    ? <FeedbackMessage message="Não foi possível atualizar a Raid." testID="raid-stale" title="Dados desatualizados" variant="error" />
    : null;
  const content = <>
    <BackLink compact={!desktop} />
    {stale}
    <RaidHeading compact={!desktop} guildName={mine.data.guild.name} raid={raid.data} />
    <Battle desktop={desktop} mine={mine.data} raid={raid.data} viewport={viewport} />
  </>;

  return <View style={styles.root} testID="raid">
    <LinearGradient colors={[theme.color.backgroundCanvas, theme.color.backgroundRaised]} end={{ x: 1, y: 1 }} pointerEvents="none" start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
    {desktop
      ? <ScrollView contentContainerStyle={styles.desktopContent} testID="raid-layout-desktop">
        <View style={styles.desktopColumn}>{content}</View>
      </ScrollView>
      : <>
        <ScrollView contentContainerStyle={styles.mobileContent} style={styles.fill} testID="raid-layout-mobile">{content}</ScrollView>
        <View style={styles.ctaBar}><AttackButton raid={raid.data} /></View>
      </>}
  </View>;
}

const cinzel = 'Cinzel-Bold';
const mono = 'JetBrainsMono-Medium';
const glassBackground = 'rgba(7, 7, 12, 0.72)';
// The Figma panels blur the scene behind them. React Native Web supports it; native keeps the translucent fill.
const webGlassBlur = (Platform.OS === 'web' ? { backdropFilter: 'blur(3px)' } : {}) as ViewStyle;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.backgroundCanvas },
  fill: { flex: 1 },
  message: { gap: theme.space.stackDefault },
  desktopContent: { paddingHorizontal: DESKTOP_GUTTER, paddingTop: 32, paddingBottom: 32 },
  desktopColumn: { width: '100%', maxWidth: DESKTOP_MAX_CONTENT, gap: 16 },
  mobileContent: { paddingHorizontal: MOBILE_GUTTER, paddingTop: MOBILE_GUTTER, paddingBottom: MOBILE_GUTTER, gap: 16 },

  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 16 },
  backText: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.accentPrimary },
  backTextCompact: { fontSize: 13 },

  heading: { gap: 8 },
  eyebrow: { fontFamily: cinzel, fontSize: 13, lineHeight: 18, letterSpacing: 3, textTransform: 'uppercase', color: theme.color.accentMuted },
  eyebrowCompact: { fontSize: 10, lineHeight: 13, letterSpacing: 2.6 },
  title: { fontFamily: cinzel, fontSize: 44, lineHeight: 54, color: theme.color.accentHighlight },
  titleCompact: { fontSize: 28, lineHeight: 34 },
  description: { fontFamily: 'Inter-Regular', fontSize: 18, lineHeight: 26, color: theme.color.textSecondary },
  descriptionCompact: { fontSize: 14, lineHeight: 21 },

  sections: { gap: 24, marginTop: 8 },
  sectionsCompact: { gap: 16 },
  sceneBlock: { gap: theme.space.stackTight },

  glass: { borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: glassBackground, ...webGlassBlur },
  overlayTopLeft: { position: 'absolute', top: 20, left: 20 },
  overlayTopLeftCompact: { top: 10, left: 10 },
  overlayTopRight: { position: 'absolute', top: 20, right: 20, width: 300 },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.pill },
  timePillCompact: { gap: 6, paddingHorizontal: 9, paddingVertical: 4 },
  timeText: { fontFamily: mono, fontSize: 11, lineHeight: 15, letterSpacing: 0.4, color: theme.color.textPrimary },
  timeTextCompact: { fontSize: 10, lineHeight: 13 },

  lifePanel: { gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: theme.radius.card },
  lifeRow: { gap: 8 },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.space.inlineTight },
  spreadCenter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space.inlineTight },
  lifeTitle: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.textPrimary },
  lifePercent: { fontFamily: mono, fontSize: 13, lineHeight: 17, color: theme.color.feedbackDanger },
  lifeMeta: { fontFamily: mono, fontSize: 11, lineHeight: 15, color: theme.color.feedbackDanger },
  lifeCaption: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.textSecondary },
  goalReached: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 18, color: theme.color.accentPrimary },

  detailsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 20 },
  detailsColumn: { flex: 1 },
  card: { flexGrow: 1, gap: 14, padding: 22, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitleText: { fontFamily: cinzel, fontSize: 11, lineHeight: 15, color: theme.color.accentPrimary },
  cardTitleLabel: { letterSpacing: 2.6, textTransform: 'uppercase' },
  cardAside: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 1, color: theme.color.textTertiary },
  cardNote: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: theme.color.textSecondary },

  weekGrid: { flexDirection: 'row', gap: 8 },
  weekDay: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 10, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: 'transparent', backgroundColor: theme.color.backgroundCanvas },
  weekDayStudied: { borderColor: theme.color.feedbackSuccess, backgroundColor: theme.color.surfaceInset },
  weekDayToday: { borderColor: theme.color.accentMuted },
  weekDayInitial: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.textTertiary },
  weekDayInitialToday: { color: theme.color.accentHighlight },
  weekDayMark: { fontFamily: mono, fontSize: 12, lineHeight: 16, color: theme.color.textTertiary },
  weekDayMarkStudied: { color: theme.color.feedbackSuccess },
  weekDayMarkToday: { color: theme.color.accentHighlight },
  streak: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.feedbackSuccess },
  furiaStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  furiaStripCopy: { flex: 1 },
  furiaStripText: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 17, color: theme.color.textSecondary },

  strike: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, overflow: 'hidden', borderRadius: 4, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset },
  avatarSprite: { position: 'absolute', left: -1, top: 0 },
  strikeMain: { flex: 1, gap: 4 },
  strikeName: { flexShrink: 1, fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.textPrimary },
  strikeNameMe: { color: theme.color.accentHighlight },
  strikeHours: { fontFamily: mono, fontSize: 11, lineHeight: 15, color: theme.color.textSecondary },

  reward: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rewardIcon: { padding: 6, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset },
  rewardCopy: { flex: 1, gap: 2 },
  rewardName: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.textPrimary },
  rewardCaption: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 13, color: theme.color.textTertiary },

  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  chipsLabel: { fontFamily: mono, fontSize: 9, lineHeight: 12, letterSpacing: 1, color: theme.color.textTertiary },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 5, paddingRight: 9, paddingVertical: 3, maxWidth: '100%',
    borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard,
  },
  chipText: { flexShrink: 1, fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 15, color: theme.color.textPrimary },

  ctaBar: { paddingHorizontal: MOBILE_GUTTER, paddingVertical: 12, borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderGhost, backgroundColor: theme.color.backgroundRaised },
});
