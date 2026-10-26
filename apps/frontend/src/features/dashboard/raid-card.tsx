import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, WiseIcon, theme } from '@/design-system';
import type { ActiveRaid, MyGuild } from '@/features/guild/api';
import { WEEK_DAY_STATE_LABEL } from '@/features/guild/raid-battle';
import { RaidSceneCrop } from '@/features/guild/raid-scene-crop';
import { useRaidTimeLeft } from '@/features/guild/use-raid-clock';
import { CardContent, FramedCard, SectionHeading, cardText, display, mono } from './card-chrome';
import { BLOCK_MIN_HEIGHT } from './next-milestone-card';
import {
  furyDays,
  furyRule,
  furyShortRule,
  lastHitText,
  raidBarMaximum,
  raidHours,
  raidHoursCompact,
  studyDaysSummary,
  timeAndPosition,
  type FuryDay,
} from './raid-card-model';

/** What the card needs of a query: its result and whether it is being fetched again. */
type QueryState<T> = { data: T | undefined; isError: boolean; isPending: boolean; isRefetching: boolean };

export type RaidCardProps = {
  desktop: boolean;
  guild: QueryState<MyGuild | null>;
  /** The active Raid of the user's Guild; it stays pending while there is no Guild to ask about. */
  raid: QueryState<ActiveRaid | null>;
  onRetryGuild: () => void;
  onRetryRaid: () => void;
};

/* Card da Raid, Figma "03 · Acampamento — v2": "Card/Guilda" no desktop e "Card/Raid da guilda" no celular. */

const STAGE_HEIGHT = 132;
const THUMBNAIL_HEIGHT = 64;

const region = { accessibilityLabel: 'Raid da guilda', role: 'region' } as const;

/** Desktop: a framed card. Mobile: a block of the 2-column grid, as tall as the Próximo Marco beside it. */
function Shell({ children, desktop, testID }: { children: ReactNode; desktop: boolean; testID: string }) {
  if (desktop) return <FramedCard {...region} testID={testID}>{children}</FramedCard>;
  return <View {...region} style={styles.mobileCard} testID={testID}>{children}</View>;
}

/** The card without a Raid to show: a heading and a message (and a link), in the same shell as the Raid. */
function StatusCard({ children, desktop, testID }: { children: ReactNode; desktop: boolean; testID: string }) {
  return <Shell desktop={desktop} testID={testID}>
    {desktop
      ? <CardContent><View style={styles.statusHeading}><SectionHeading>Guilda</SectionHeading></View>{children}</CardContent>
      : <>
        <Text style={styles.eyebrow}>Guilda</Text>
        {children}
      </>}
  </Shell>;
}

function GuildLink({ href, label, small }: { href: '/guilda' | '/guilda/raid'; label: string; small?: boolean }) {
  return <Link asChild href={href}>
    <Pressable accessibilityLabel={label} accessibilityRole="link" style={styles.linkRow}>
      <Text style={[styles.link, small && styles.linkSmall]}>{label}</Text>
      {small ? <Text style={[styles.link, styles.linkSmall]}>›</Text> : <WiseIcon color="accentPrimary" name="chevron-forward" size="xsmall" />}
    </Pressable>
  </Link>;
}

const dayAccessibilityLabel = (day: FuryDay) => `${day.name}: ${WEEK_DAY_STATE_LABEL[day.state]}`;

const dayBarStyle = (state: FuryDay['state']) => ({
  studied: styles.dayStudied,
  missed: styles.dayMissed,
  today: styles.dayToday,
  upcoming: styles.dayUpcoming,
})[state];

/** The seven days of the Fúria do dragão, each with its three-letter name (desktop). */
function FuryDays({ days }: { days: FuryDay[] }) {
  return <View style={styles.days} testID="dashboard-raid-days">
    {days.map((day) => <View accessible accessibilityLabel={dayAccessibilityLabel(day)} key={day.key} style={styles.day} testID={`dashboard-raid-day-${day.state}`}>
      <View style={[styles.dayBar, dayBarStyle(day.state)]} />
      <Text style={[styles.dayName, day.state === 'today' && styles.dayNameToday]}>{day.abbreviation}</Text>
    </View>)}
  </View>;
}

/** The same seven days as thin segments, without names (phone). */
function FurySegments({ days }: { days: FuryDay[] }) {
  return <View style={styles.segments} testID="dashboard-raid-days">
    {days.map((day) => <View accessible accessibilityLabel={dayAccessibilityLabel(day)} key={day.key} style={[styles.segment, dayBarStyle(day.state)]} testID={`dashboard-raid-day-${day.state}`} />)}
  </View>;
}

/** "3d 14h restantes · você: 4º", caught up with the clock like the Raid screen's countdown. */
function TimeLeft({ desktop, raid }: { desktop: boolean; raid: ActiveRaid }) {
  const left = useRaidTimeLeft(raid);
  return <Text style={desktop ? styles.footnote : styles.mobileFootnote} testID="dashboard-raid-time-left">{timeAndPosition(left, raid.me.position, { long: desktop })}</Text>;
}

function RaidSeal({ style }: { style?: object }) {
  return <View style={[styles.seal, style]}><Text style={styles.sealText}>RAID</Text></View>;
}

function DesktopRaid({ guildName, raid }: { guildName: string; raid: ActiveRaid }) {
  const days = furyDays(raid);
  return <>
    <View style={styles.stage}>
      <RaidSceneCrop height={STAGE_HEIGHT} raid={raid} testID="dashboard-raid-scene">
        <View style={styles.guildTag}><Text numberOfLines={1} style={styles.guildTagText} testID="dashboard-raid-guild">{guildName}</Text></View>
        <RaidSeal style={styles.sealOverStage} />
      </RaidSceneCrop>
    </View>
    <View style={styles.body}>
      <View style={styles.titleLine}>
        <Text accessibilityRole="header" aria-level={2} numberOfLines={1} style={styles.title} testID="dashboard-raid-mission">{raid.mission.name}</Text>
        <Text style={styles.hours} testID="dashboard-raid-hours">{raidHours(raid)}</Text>
      </View>
      <ProgressBar accessibilityLabel={`Progresso da Raid: ${raidHours(raid)}`} maximumValue={raidBarMaximum(raid)} size="tall" testID="dashboard-raid-bar" tone="danger" value={Math.min(raid.progressXp, raidBarMaximum(raid))} />
      <View style={styles.fury} testID="dashboard-raid-fury">
        <View style={styles.furyHeader}>
          <Text style={styles.furyTitle}>Fúria do dragão</Text>
          <Text style={styles.furyCount}>{studyDaysSummary(days)}</Text>
        </View>
        <FuryDays days={days} />
        <Text style={styles.rule}>{furyRule(raid.furyPercent)}</Text>
        {raid.lastHit
          ? <View style={styles.lastHit} testID="dashboard-raid-last-hit">
            <Text aria-hidden style={styles.lastHitIcon}>⚔</Text>
            <Text numberOfLines={1} style={styles.lastHitText}>{lastHitText(raid.lastHit)}</Text>
          </View>
          : null}
      </View>
      <View style={styles.footer}>
        <TimeLeft desktop raid={raid} />
        <GuildLink href="/guilda/raid" label="Ver guilda" />
      </View>
    </View>
  </>;
}

function MobileRaid({ raid }: { raid: ActiveRaid }) {
  const days = furyDays(raid);
  return <>
    <View style={styles.thumbnail}>
      <RaidSceneCrop height={THUMBNAIL_HEIGHT} raid={raid} testID="dashboard-raid-scene" thumbnail />
      <RaidSeal style={styles.sealOverThumbnail} />
    </View>
    <Text accessibilityRole="header" aria-level={2} style={styles.mobileName} testID="dashboard-raid-mission">{raid.mission.name}</Text>
    <View style={styles.mobileTopLine}>
      <Text style={styles.eyebrow}>Raid</Text>
      <Text style={styles.mobileHours} testID="dashboard-raid-hours">{raidHoursCompact(raid)}</Text>
    </View>
    <ProgressBar accessibilityLabel={`Progresso da Raid: ${raidHours(raid)}`} maximumValue={raidBarMaximum(raid)} size="slim" testID="dashboard-raid-bar" tone="danger" value={Math.min(raid.progressXp, raidBarMaximum(raid))} />
    <FurySegments days={days} />
    <Text style={styles.mobileFury} testID="dashboard-raid-fury">{furyShortRule(raid.furyPercent)}</Text>
    <TimeLeft desktop={false} raid={raid} />
    <View style={styles.action}><GuildLink href="/guilda/raid" label="Ver guilda" small /></View>
  </>;
}

/**
 * The Raid of the user's Guild on the Acampamento: the Missão's scene, the progress in focus hours, the Fúria do dragão,
 * the last Golpe, the time left and the user's place. Without a Raid, or without a Guild, an honest card that leads to the Guilda.
 * The card fills the top of the side column on desktop and the left block of the 2-column grid on the phone.
 */
export function RaidCard({ desktop, guild, raid, onRetryGuild, onRetryRaid }: RaidCardProps) {
  const myGuild = guild.data;
  if (myGuild === undefined) {
    return guild.isPending
      ? <LoadingCard desktop={desktop} />
      : <ErrorCard desktop={desktop} loading={guild.isRefetching} onRetry={onRetryGuild} />;
  }
  if (myGuild === null) {
    return <StatusCard desktop={desktop} testID="dashboard-raid-no-guild">
      <Text style={cardText.cardDescription}>Entre numa Guild para enfrentar a Raid da semana junto com outros estudantes.</Text>
      <GuildLink href="/guilda" label="Procurar ou criar uma Guild" small={!desktop} />
    </StatusCard>;
  }
  if (raid.data === undefined) {
    return raid.isPending
      ? <LoadingCard desktop={desktop} />
      : <ErrorCard desktop={desktop} loading={raid.isRefetching} onRetry={onRetryRaid} />;
  }
  if (raid.data === null) {
    return <StatusCard desktop={desktop} testID="dashboard-raid-empty">
      <Text style={cardText.cardDescription}>{myGuild.guild.name} ainda não tem uma Raid nesta semana.</Text>
      <GuildLink href="/guilda" label="Ver guilda" small={!desktop} />
    </StatusCard>;
  }
  return <Shell desktop={desktop} testID="dashboard-raid">
    {desktop ? <DesktopRaid guildName={myGuild.guild.name} raid={raid.data} /> : <MobileRaid raid={raid.data} />}
  </Shell>;
}

function LoadingCard({ desktop }: { desktop: boolean }) {
  return <StatusCard desktop={desktop} testID="dashboard-raid-loading">
    <Text style={cardText.emptyState}>Carregando a Raid…</Text>
  </StatusCard>;
}

function ErrorCard({ desktop, loading, onRetry }: { desktop: boolean; loading: boolean; onRetry: () => void }) {
  return <StatusCard desktop={desktop} testID="dashboard-raid-error">
    <FeedbackMessage message="Não foi possível carregar a Raid." title="Raid indisponível" variant="error" />
    <WiseButton label="Tentar novamente" loading={loading} onPress={onRetry} variant="secondary" />
  </StatusCard>;
}

const dayRadius = 2;

const styles = StyleSheet.create({
  mobileCard: { flex: 1, minWidth: 0, minHeight: BLOCK_MIN_HEIGHT, gap: 8, padding: 12, borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  statusHeading: { marginBottom: 12 },
  eyebrow: { fontFamily: 'Inter-Medium', fontSize: 9, lineHeight: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.color.textTertiary },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingTop: 12 },
  link: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.accentPrimary },
  linkSmall: { fontSize: 11, lineHeight: 14, color: theme.color.accentHighlight },
  action: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end' },

  seal: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.feedbackDanger, backgroundColor: theme.color.surfaceInset },
  sealText: { ...mono, fontSize: 8, lineHeight: 11, letterSpacing: 0.8, color: theme.color.feedbackDanger },

  stage: { overflow: 'hidden', borderTopLeftRadius: theme.radius.control, borderTopRightRadius: theme.radius.control },
  guildTag: { position: 'absolute', top: 14, left: 14, maxWidth: '60%', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.backgroundCanvas },
  guildTagText: { ...mono, fontSize: 9, lineHeight: 12, letterSpacing: 1, textTransform: 'uppercase', color: theme.color.accentPrimary },
  sealOverStage: { position: 'absolute', top: 14, right: 14 },
  body: { gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, fontFamily: 'Cinzel-Bold', fontSize: 15, lineHeight: 20, color: theme.color.textPrimary },
  hours: { ...mono, fontSize: 13, lineHeight: 17, color: theme.color.feedbackDanger },
  fury: { gap: 8, paddingTop: 12, paddingBottom: 4, borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderGhost },
  furyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  furyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 9, lineHeight: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.color.feedbackDanger },
  furyCount: { ...mono, fontSize: 10, lineHeight: 13, color: theme.color.textTertiary },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, maxWidth: 36, gap: 4, alignItems: 'center' },
  dayBar: { alignSelf: 'stretch', height: 8, borderRadius: dayRadius, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost },
  dayStudied: { backgroundColor: theme.color.accentPrimary },
  dayMissed: { backgroundColor: theme.color.feedbackDanger },
  dayToday: { backgroundColor: theme.color.surfaceInset, borderColor: theme.color.accentHighlight },
  dayUpcoming: { backgroundColor: theme.color.surfaceInset },
  dayName: { ...mono, fontSize: 9, lineHeight: 12, color: theme.color.textTertiary },
  dayNameToday: { color: theme.color.accentHighlight },
  rule: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 16, color: theme.color.textSecondary },
  lastHit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lastHitIcon: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 14, color: theme.color.accentPrimary },
  lastHitText: { flexShrink: 1, ...mono, fontSize: 10, lineHeight: 13, color: theme.color.textSecondary },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 },
  footnote: { flexShrink: 1, ...mono, fontSize: 11, lineHeight: 15, color: theme.color.textTertiary },

  thumbnail: { height: THUMBNAIL_HEIGHT, overflow: 'hidden', borderRadius: 4, backgroundColor: theme.color.surfaceInset },
  sealOverThumbnail: { position: 'absolute', top: 6, left: 6 },
  mobileName: { ...display, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, color: theme.color.textPrimary },
  mobileTopLine: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  mobileHours: { fontFamily: 'JetBrainsMono-Bold', fontSize: 11, lineHeight: 15, color: theme.color.feedbackDanger },
  segments: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 6, borderRadius: dayRadius, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost },
  mobileFury: { ...mono, fontSize: 9, lineHeight: 12, color: theme.color.feedbackDanger },
  mobileFootnote: { ...mono, fontSize: 9, lineHeight: 12, color: theme.color.textTertiary },
});
