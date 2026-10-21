import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WiseText, theme } from '@/design-system';
import { controlStyles } from '@/design-system/components/control-styles';

export type TabItem<Id extends string> = { id: Id; label: string };

/** `underline` is the 06c phone tabs; `segmented` is the Procurar | Fundar switch of the 06d. */
export type TabListVariant = 'underline' | 'segmented';

type TabListProps<Id extends string> = {
  accessibilityLabel: string;
  onSelect: (id: Id) => void;
  selected: Id;
  tabs: readonly TabItem<Id>[];
  /** `testID` of the list; each tab gets `${tabTestIDPrefix}${id}`. */
  testID: string;
  tabTestIDPrefix: string;
  variant: TabListVariant;
};

/** Figma 06d: the segmented tabs are 8 px tall inside and 3 px apart; the extra hit slop brings them closer to the 44 px target. */
const SEGMENT_GAP = 3;
const SEGMENT_HIT_SLOP = { top: 6, bottom: 6 } as const;

export function TabList<Id extends string>({ accessibilityLabel, onSelect, selected, tabs, tabTestIDPrefix, testID, variant }: TabListProps<Id>) {
  const [focused, setFocused] = useState<Id | null>(null);
  const segmented = variant === 'segmented';
  return (
    <View accessibilityLabel={accessibilityLabel} role="tablist" style={segmented ? styles.segments : styles.underlines} testID={testID}>
      {tabs.map((tab) => {
        const active = tab.id === selected;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            aria-selected={active}
            hitSlop={segmented ? SEGMENT_HIT_SLOP : undefined}
            key={tab.id}
            onBlur={() => setFocused(null)}
            onFocus={() => setFocused(tab.id)}
            onPress={() => onSelect(tab.id)}
            style={[
              segmented ? styles.segment : styles.underline,
              // Selected is marked by the underline or the filled frame and the brighter label, never by color alone.
              active && (segmented ? styles.segmentActive : styles.underlineActive),
              focused === tab.id && Platform.OS === 'web' && controlStyles.webFocus,
            ]}
            testID={`${tabTestIDPrefix}${tab.id}`}
          >
            {segmented
              ? <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{tab.label}</Text>
              : <WiseText color={active ? 'accentHighlight' : 'textSecondary'} variant="label">{tab.label}</WiseText>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  underlines: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.inlineTight, borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderSubtle },
  underline: { paddingVertical: theme.space.inlineTight, paddingHorizontal: theme.space.controlInset, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  underlineActive: { borderBottomColor: theme.color.accentPrimary },
  segments: { flexDirection: 'row', gap: SEGMENT_GAP, padding: theme.space.inlineHairline, borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset },
  segment: { flex: 1, alignItems: 'center', paddingVertical: theme.space.inlineTight, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: 'transparent' },
  segmentActive: { backgroundColor: theme.color.surfaceCard, borderColor: theme.color.accentMuted },
  segmentLabel: { fontFamily: theme.type.label.fontFamily, fontSize: 12, lineHeight: 16, color: theme.color.textTertiary },
  segmentLabelActive: { color: theme.color.accentHighlight },
});
