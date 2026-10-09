import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WiseCard, WiseText, theme } from '@/design-system';

export type ProfileTabId = 'cosmeticos' | 'companheiro' | 'dispositivos';
export type ProfileTab = { id: ProfileTabId; label: string; content: ReactNode };

export function ProfileTabs({ onTabChange, tabs }: { onTabChange?: () => void; tabs: [ProfileTab, ...ProfileTab[]] }) {
  const [selectedId, setSelectedId] = useState<ProfileTabId>(tabs[0].id);
  const active = tabs.find((tab) => tab.id === selectedId) ?? tabs[0];

  return (
    <WiseCard testID="profile-tabs">
      <View accessibilityRole="tablist" style={styles.tablist} testID="profile-tablist">
        {tabs.map((tab) => {
          const selected = tab.id === active.id;
          return (
            <Pressable
              accessibilityLabel={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              aria-selected={selected}
              key={tab.id}
              onPress={() => {
                setSelectedId(tab.id);
                onTabChange?.();
              }}
              style={[styles.tab, selected && styles.tabSelected]}
              testID={`profile-tab-${tab.id}`}
            >
              <WiseText color={selected ? 'accentPrimary' : 'textSecondary'} variant="label">{tab.label}</WiseText>
            </Pressable>
          );
        })}
      </View>
      <View accessibilityLabel={active.label} role="tabpanel" style={styles.panel} testID={`profile-tabpanel-${active.id}`}>
        {active.content}
      </View>
    </WiseCard>
  );
}

const styles = StyleSheet.create({
  tablist: { flexDirection: 'row' },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.layout.touchTarget,
    minWidth: theme.layout.touchTarget,
    borderBottomWidth: theme.border.focus,
    borderBottomColor: theme.color.borderSoft,
  },
  tabSelected: { borderBottomColor: theme.color.accentPrimary },
  panel: { padding: theme.space.cardInset, gap: theme.space.stackTight },
});
