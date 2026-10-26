import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WiseCard, theme, type WiseCardProps } from '@/design-system';

export function SectionHeading({ children }: PropsWithChildren) {
  return <View style={styles.cardTitleLabel}>
    <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no" style={styles.cardTitleText}>◈</Text>
    <Text accessibilityRole="header" aria-level={2} style={styles.cardTitleText}>{children}</Text>
  </View>;
}

export function CardTitle({ children, ornament }: PropsWithChildren<{ ornament?: string }>) {
  return <View style={styles.cardTitle}>
    <SectionHeading>{children}</SectionHeading>
    {ornament ? <Text style={styles.ornament}>{ornament}</Text> : null}
  </View>;
}

/** Gold corner brackets from the prototype's framed cards. Purely decorative. */
function CardCorners() {
  return <>
    {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => <View
      accessibilityElementsHidden
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      key={corner}
      pointerEvents="none"
      style={[styles.corner, styles[`corner_${corner}`]]}
    >
      <View style={[styles.cornerTickH, corner.endsWith('r') ? { right: -1 } : { left: -1 }, corner.startsWith('t') ? { top: -1 } : { bottom: -1 }]} />
      <View style={[styles.cornerTickV, corner.endsWith('r') ? { right: -1 } : { left: -1 }, corner.startsWith('t') ? { top: -1 } : { bottom: -1 }]} />
    </View>)}
  </>;
}

export function FramedCard({ children, style, ...props }: PropsWithChildren<Omit<WiseCardProps, 'variant'>>) {
  return <WiseCard {...props} style={[styles.framedCard, style]}>
    <CardCorners />
    {children}
  </WiseCard>;
}

export function CardContent({ children, testID }: PropsWithChildren<{ testID?: string }>) {
  return <View style={styles.cardContent} testID={testID}>{children}</View>;
}

export const display = { fontFamily: 'Cinzel-SemiBold' } as const;
export const mono = { fontFamily: 'JetBrainsMono-Medium' } as const;
const cornerSize = 14;

/** Text styles that several cards share. */
export const cardText = StyleSheet.create({
  eyebrow: { fontFamily: 'Inter-Medium', fontSize: 10, lineHeight: 14, letterSpacing: 1.8, textTransform: 'uppercase', color: theme.color.textTertiary },
  cardDescription: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 19, color: theme.color.textSecondary },
  emptyState: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 19, color: theme.color.textTertiary, paddingVertical: theme.space.inlineTight },
});

const styles = StyleSheet.create({
  framedCard: { borderRadius: theme.radius.control, overflow: 'visible', borderColor: theme.color.borderSoft, borderWidth: theme.border.standard },
  corner: { position: 'absolute', width: cornerSize, height: cornerSize, borderColor: theme.color.borderEmphasis },
  corner_tl: { top: -1, left: -1, borderTopWidth: 1, borderLeftWidth: 1 },
  corner_tr: { top: -1, right: -1, borderTopWidth: 1, borderRightWidth: 1 },
  corner_bl: { bottom: -1, left: -1, borderBottomWidth: 1, borderLeftWidth: 1 },
  corner_br: { bottom: -1, right: -1, borderBottomWidth: 1, borderRightWidth: 1 },
  cornerTickH: { position: 'absolute', width: 5, height: 1, backgroundColor: theme.color.accentPrimary },
  cornerTickV: { position: 'absolute', width: 1, height: 5, backgroundColor: theme.color.accentPrimary },

  cardContent: { minWidth: 0, padding: 22 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.space.stackTight, marginBottom: 16 },
  cardTitleLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  cardTitleText: { ...display, fontSize: 11, lineHeight: 16, letterSpacing: 2.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  ornament: { ...mono, fontSize: 10, letterSpacing: 2, color: theme.color.accentMuted },
});
