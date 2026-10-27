import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, theme } from '@/design-system';
import { PixelSprite } from '@/features/character/PixelSprite';
import type { Milestone, Milestones } from '@/features/chronicles/api';
import { spriteOf } from '@/features/chronicles/milestone-sprite';
import { milestoneDescription, nextMilestone } from '@/features/chronicles/milestones';
import { BLOCK_MIN_HEIGHT, CardContent, FramedCard, SectionHeading, cardText, display, mono } from './card-chrome';

export type NextMilestoneCardProps = {
  desktop: boolean;
  milestones: Milestones | undefined;
  isPending: boolean;
  isRefetching: boolean;
  onRetry: () => void;
};

const GRID_GAP = 10;

const region = { accessibilityLabel: 'Próximo Marco', role: 'region' } as const;

function SeeMilestones({ small }: { small?: boolean }) {
  return <Link asChild href="/cronicas">
    <Pressable accessibilityLabel="Ver marcos" accessibilityRole="link">
      <Text style={[styles.link, small && styles.linkSmall]}>Ver marcos ›</Text>
    </Pressable>
  </Link>;
}

/** The unearned Marco closest to done (see `nextMilestone`): a row card on desktop, a block of the 2-column grid on mobile. */
export function NextMilestoneCard({ desktop, milestones, isPending, isRefetching, onRetry }: NextMilestoneCardProps) {
  if (!milestones) {
    return <Shell desktop={desktop} testID={isPending ? 'dashboard-milestone-loading' : 'dashboard-milestone-error'}>
      {isPending
        ? <Text style={cardText.emptyState}>Carregando o Marco…</Text>
        : <>
          <FeedbackMessage message="Não foi possível carregar os Marcos." title="Marcos indisponíveis" variant="error" />
          <WiseButton label="Tentar novamente" loading={isRefetching} onPress={onRetry} variant="secondary" />
        </>}
    </Shell>;
  }

  const next = nextMilestone(milestones.items);
  if (!next) {
    const all = milestones.items.length;
    return <Shell desktop={desktop} showLink={all > 0} testID="dashboard-milestone-done">
      <Text style={cardText.emptyState}>{all === 0 ? 'Nenhum Marco disponível.' : `${all} de ${all} conquistados`}</Text>
      {desktop || all === 0 ? null : <SeeMilestones small />}
    </Shell>;
  }
  return <Shell block desktop={desktop} showLink testID="dashboard-milestone">
    {desktop ? <DesktopMilestone milestone={next} /> : <MobileMilestone milestone={next} />}
  </Shell>;
}

/** Desktop: a framed card with its header and "Ver marcos". Mobile: a plain block; only the Marco block has the grid's fixed height. */
function Shell({ block, children, desktop, showLink, testID }: { block?: boolean; children: React.ReactNode; desktop: boolean; showLink?: boolean; testID: string }) {
  if (!desktop) return <View {...region} style={[styles.mobileCard, block && styles.mobileBlock]} testID={testID}>{children}</View>;
  return <FramedCard {...region} testID={testID}>
    <CardContent>
      <View style={styles.header}>
        <SectionHeading>Próximo Marco</SectionHeading>
        {showLink ? <SeeMilestones /> : null}
      </View>
      {children}
    </CardContent>
  </FramedCard>;
}

const percent = ({ progress, target }: Milestone) => Math.floor((progress / target) * 100);

function MilestoneBadge({ milestone }: { milestone: Milestone }) {
  return <View style={styles.badge}><PixelSprite opacity={0.9} scale={4} sprite={spriteOf(milestone)} /></View>;
}

function MilestoneBar({ milestone, size }: { milestone: Milestone; size: 'tall' | 'hairline' }) {
  return <ProgressBar maximumValue={milestone.target} size={size} testID="dashboard-milestone-bar" value={milestone.progress} />;
}

function DesktopMilestone({ milestone }: { milestone: Milestone }) {
  return <View accessible accessibilityLabel={`${milestone.name}. ${milestoneDescription(milestone)}.`} style={styles.row}>
    <MilestoneBadge milestone={milestone} />
    <View style={styles.main}>
      <View style={styles.titleLine}>
        <Text style={styles.name}>{milestone.name}</Text>
        <Text style={styles.percent}>{percent(milestone)}%</Text>
      </View>
      <MilestoneBar milestone={milestone} size="tall" />
      <Text style={styles.description}>{milestoneDescription(milestone)}</Text>
    </View>
  </View>;
}

function MobileMilestone({ milestone }: { milestone: Milestone }) {
  return <>
    <View style={styles.thumb}><MilestoneBadge milestone={milestone} /></View>
    <Text style={styles.mobileName}>{milestone.name}</Text>
    <View style={styles.titleLine}>
      <Text style={styles.eyebrow}>Próximo Marco</Text>
      <Text style={styles.progressCount}>{milestone.progress}/{milestone.target}</Text>
    </View>
    <MilestoneBar milestone={milestone} size="hairline" />
    <Text style={styles.mobileDescription}>{milestoneDescription(milestone)}</Text>
    <View style={styles.action}><SeeMilestones small /></View>
  </>;
}

export const milestoneGridGap = GRID_GAP;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.stackTight, marginBottom: 16 },
  link: { fontFamily: 'Inter-SemiBold', fontSize: 12, lineHeight: 16, color: theme.color.accentHighlight },
  linkSmall: { fontSize: 11, lineHeight: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  badge: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceInset },
  main: { flex: 1, minWidth: 0, gap: 6 },
  titleLine: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  name: { ...display, fontSize: 13, lineHeight: 18, letterSpacing: 0.6, color: theme.color.textPrimary },
  percent: { ...mono, fontSize: 11, lineHeight: 15, color: theme.color.accentHighlight },
  description: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 14, color: theme.color.textTertiary },
  mobileCard: { flex: 1, minWidth: 0, gap: 8, padding: 12, borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  mobileBlock: { minHeight: BLOCK_MIN_HEIGHT },
  thumb: { height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: theme.color.surfaceInset },
  mobileName: { ...display, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, color: theme.color.textPrimary },
  eyebrow: { fontFamily: 'Inter-Medium', fontSize: 9, lineHeight: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.color.textTertiary },
  progressCount: { fontFamily: 'JetBrainsMono-Bold', fontSize: 11, lineHeight: 15, color: theme.color.accentHighlight },
  mobileDescription: { fontFamily: 'Inter-Regular', fontSize: 10, lineHeight: 14, color: theme.color.textTertiary },
  action: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end' },
});
