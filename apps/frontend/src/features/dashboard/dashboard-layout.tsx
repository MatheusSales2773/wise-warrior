import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '@/design-system';

export type DashboardLayoutProps = {
  desktop: boolean;
  header: ReactNode;
  summary: ReactNode;
  /** Objetivos de hoje: a card in the main column on desktop, a horizontal carousel on mobile. Empty until it has content. */
  objectives?: ReactNode;
  /** Raid and Próximo Marco: the top of the side column on desktop, a 2-column grid before Cadência on mobile. Empty until it has content. */
  highlights?: ReactNode;
  cadence: ReactNode;
  activity: ReactNode;
  actions: ReactNode;
};

/**
 * The two columns of the Acampamento v2 on desktop and its single-column order on mobile (header, summary, Objetivos,
 * Raid and Próximo Marco, Cadência, Atividade recente, actions). A slot left undefined renders nothing, not even a gap.
 */
export function DashboardLayout({ desktop, header, summary, objectives, highlights, cadence, activity, actions }: DashboardLayoutProps) {
  return <View testID="dashboard-grid" style={[styles.grid, desktop && styles.desktopGrid]}>
    <View testID="dashboard-main-column" style={styles.mainColumn}>
      {header}
      {summary}
      {objectives}
      {desktop ? null : highlights}
      {cadence}
    </View>
    <View style={[styles.sideColumn, desktop && styles.desktopSideColumn]} testID="dashboard-side-column">
      {desktop ? highlights : null}
      {activity}
      {actions}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  grid: { width: '100%', flexDirection: 'column', gap: 22 },
  desktopGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { flex: 1, minWidth: 0, gap: 18 },
  sideColumn: { minWidth: 0, gap: 18 },
  desktopSideColumn: { width: theme.layout.sidePanelWidth, flexShrink: 0 },
});
