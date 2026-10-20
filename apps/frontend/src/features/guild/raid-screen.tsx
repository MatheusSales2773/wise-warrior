import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseIcon, WiseText, isDesktopLayout, theme } from '@/design-system';
import { useFocusRing } from '@/features/character/character-parts';
import type { ActiveRaid, MyGuild, RaidHit, RaidRankingEntry } from './api';
import { RAID_GOAL_REACHED, formatPosition } from './messages';
import { activeRaidQueryOptions, myGuildQueryOptions, raidRankingQueryOptions } from './queries';
import { formatFocusHours, formatRaidHit, formatStreak, raidParty, weeklyStrikes, type Strike } from './raid-battle';
import { HeroAvatar } from './hero-avatar';
import { AttackButton, BossLifePanel, BossLifeRow, RewardChips, RewardList, TimePill, WeekGrid } from './raid-shared';
import { raidSceneArt } from './raid-scene-art';
import { RaidScene, raidSceneScale } from './raid-scene';

/* Tela da Raid, Figma "06b · Guilda — Raid · O Devorador de Horas" (desktop e mobile). */

const DESKTOP_GUTTER = 56;
const DESKTOP_MAX_CONTENT = 1080;
const MOBILE_GUTTER = 24;
/** Rows of "Golpes da semana" per layout, as in the Figma frames. */
const STRIKE_ROWS = { desktop: 4, mobile: 3 } as const;

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

/**
 * O Golpe mais recente diante do chefe: o dano grande e, abaixo, autor e minutos. Anunciado ao chegar ao vivo
 * (`raid:hit`). Só no desktop: o Figma 06b não o mostra na cena estreita do celular.
 */
function LastHit({ hit }: { hit: RaidHit }) {
  const { damage, detail, label } = formatRaidHit(hit);
  return <View accessible accessibilityLabel={label} accessibilityLiveRegion="polite" style={styles.hit} testID="raid-last-hit">
    <Text style={styles.hitDamage}>{damage}</Text>
    <Text numberOfLines={1} style={styles.hitDetail}>{detail}</Text>
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

function StrikeRow({ compact, strike }: { compact: boolean; strike: Strike }) {
  const { entry, fraction } = strike;
  const name = entry.isMe ? (compact ? `Você · ${formatPosition(entry.position)}` : 'Você') : entry.displayName;
  const hours = formatFocusHours(entry.contributionXp, { precise: true });
  return <View
    accessible
    accessibilityLabel={`${formatPosition(entry.position)}: ${entry.isMe ? 'você' : entry.displayName}, ${hours} de foco`}
    style={styles.strike}
    testID={`raid-strike-${entry.userId}`}
  >
    <HeroAvatar entry={entry} />
    <View style={styles.strikeMain}>
      <View style={styles.spread}>
        <Text numberOfLines={1} style={[styles.strikeName, entry.isMe && styles.strikeNameMe]}>{name}</Text>
        <Text style={styles.strikeHours}>{hours}</Text>
      </View>
      <ProgressBar accessibilityLabel={`Golpes de ${entry.isMe ? 'você' : entry.displayName}`} maximumValue={1} size="hairline" value={fraction} />
    </View>
  </View>;
}

function StrikesCard({ compact, entries, failed, loading }: { compact: boolean; entries: readonly RaidRankingEntry[]; failed: boolean; loading: boolean }) {
  const strikes = weeklyStrikes(entries, compact ? STRIKE_ROWS.mobile : STRIKE_ROWS.desktop);
  const body = (() => {
    if (loading) return <Text style={styles.cardNote}>Carregando os golpes…</Text>;
    if (failed && !entries.length) return <FeedbackMessage message="Não foi possível carregar o Ranking interno." testID="raid-strikes-error" title="Ranking indisponível" variant="error" />;
    if (!strikes.length) return <Text style={styles.cardNote} testID="raid-strikes-empty">Ninguém atacou ainda. Participe e conclua uma sessão de guilda na Forja.</Text>;
    return strikes.map((strike) => <StrikeRow compact={compact} key={strike.entry.userId} strike={strike} />);
  })();
  return <Card label="Golpes da semana" testID="raid-strikes">
    <CardHeader aside="Ranking">Golpes da semana</CardHeader>
    {body}
  </Card>;
}

/** What one day without study gives back, in focus hours: the Figma 06b copy ("recupera 5h de vida"), from the server's percent of the goal. */
function furiaDailyHours(raid: ActiveRaid): string {
  return formatFocusHours(Math.floor((raid.goalXp * raid.furyPercent) / 100));
}

/** Desktop card copy; the phone strip says the same shorter. */
function furiaRule(raid: ActiveRaid, { compact = false }: { compact?: boolean } = {}): string {
  const hours = furiaDailyHours(raid);
  return compact ? `Dias sem estudo devolvem ${hours} de vida ao dragão.` : `Cada dia em que a guilda não estuda, o dragão recupera ${hours} de vida.`;
}

function furiaRegenerated(raid: ActiveRaid): string {
  return raid.regeneratedXp > 0 ? `Já recuperou ${formatFocusHours(raid.regeneratedXp)} de foco.` : 'Ainda não recuperou vida.';
}

function FuriaCard({ raid }: { raid: ActiveRaid }) {
  return <Card label="Fúria do dragão" testID="raid-furia">
    <CardHeader aside="Regra da raid">Fúria do dragão</CardHeader>
    <Text style={styles.furiaCopy}>
      <Text testID="raid-furia-rule">{furiaRule(raid)}</Text> Mantenham a chama acesa.
    </Text>
    <Text style={styles.furiaRegenerated} testID="raid-furia-regenerated">{furiaRegenerated(raid)}</Text>
    <WeekGrid raid={raid} />
    <Text style={styles.streak} testID="raid-streak">{formatStreak(raid.streak)}</Text>
  </Card>;
}

function FuriaStrip({ raid }: { raid: ActiveRaid }) {
  return <View accessibilityLabel="Fúria do dragão" role="region" style={styles.furiaStrip} testID="raid-furia">
    <WiseIcon color="feedbackDanger" name="flame" size="small" />
    <Text style={styles.furiaStripText}>
      <Text testID="raid-furia-rule">{furiaRule(raid, { compact: true })}</Text> <Text testID="raid-furia-regenerated">{furiaRegenerated(raid)}</Text> <Text testID="raid-streak">{formatStreak(raid.streak, { compact: true })}</Text>
    </Text>
  </View>;
}

function RewardsCard({ raid }: { raid: ActiveRaid }) {
  return <Card label="Ao derrotar" testID="raid-rewards">
    <CardHeader>Ao derrotar</CardHeader>
    <RewardList raid={raid} />
    <View style={styles.fill} />
    <AttackButton raid={raid} />
  </Card>;
}

function Battle({ desktop, mine, raid, viewport }: { desktop: boolean; mine: MyGuild; raid: ActiveRaid; viewport: number }) {
  const ranking = useInfiniteQuery(raidRankingQueryOptions(mine.guild.id, raid.id));
  const entries = ranking.data?.pages.flatMap((page) => page.items) ?? [];
  const party = raidParty(raid.party);
  const art = raidSceneArt(raid.mission.slug);
  const scale = raidSceneScale(viewport);
  const strikes = <StrikesCard compact={!desktop} entries={entries} failed={ranking.isError} loading={ranking.isPending} />;

  const scene = <RaidScene
    art={art}
    overlay={<>
      <View style={[styles.overlayTopLeft, !desktop && styles.overlayTopLeftCompact]}><TimePill compact={!desktop} raid={raid} /></View>
      {desktop ? <View style={styles.overlayTopRight}><BossLifePanel raid={raid} /></View> : null}
    </>}
    hit={desktop && raid.lastHit ? <LastHit hit={raid.lastHit} /> : null}
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

const hitShadow = { textShadowColor: 'rgba(0, 0, 0, 0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 } as const;

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

  overlayTopLeft: { position: 'absolute', top: 20, left: 20 },
  overlayTopLeftCompact: { top: 10, left: 10 },
  overlayTopRight: { position: 'absolute', top: 20, right: 20, width: 300 },
  // Figma 06b: texto solto sobre a cena, com sombra para ler sobre o céu.
  hit: { alignItems: 'center', maxWidth: '100%' },
  hitDamage: { fontFamily: cinzel, fontSize: 26, lineHeight: 35, color: theme.color.accentHighlight, ...hitShadow },
  hitDetail: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.textPrimary, ...hitShadow },

  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.space.inlineTight },
  spreadCenter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space.inlineTight },
  goalReached: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 18, color: theme.color.accentPrimary },

  detailsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 20 },
  detailsColumn: { flex: 1 },
  card: { flexGrow: 1, gap: 14, padding: 22, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitleText: { fontFamily: cinzel, fontSize: 11, lineHeight: 15, color: theme.color.accentPrimary },
  cardTitleLabel: { letterSpacing: 2.6, textTransform: 'uppercase' },
  cardAside: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 1, color: theme.color.textTertiary },
  cardNote: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: theme.color.textSecondary },

  furiaCopy: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 20, color: theme.color.textSecondary },
  furiaRegenerated: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.feedbackDanger },
  streak: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.feedbackSuccess },
  furiaStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  furiaStripText: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 17, color: theme.color.textSecondary },

  strike: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  strikeMain: { flex: 1, gap: 4 },
  strikeName: { flexShrink: 1, fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.textPrimary },
  strikeNameMe: { color: theme.color.accentHighlight },
  strikeHours: { fontFamily: mono, fontSize: 11, lineHeight: 15, color: theme.color.textSecondary },

  ctaBar: { paddingHorizontal: MOBILE_GUTTER, paddingVertical: 12, borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderGhost, backgroundColor: theme.color.backgroundRaised },
});
