import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { isDesktopLayout, theme } from '@/design-system';
import { TabList } from '@/features/guild/guild-tabs';
import { saoPauloDay } from '@/features/dashboard/queries';
import { Diary } from './diary-list';
import { Objectives } from './objectives';
import { WeekCards } from './week-cards';
import { weekRangeLabel } from './diary';

/* Crônicas: Objetivos e Diário (ADR-014). Os Objetivos semanais e os Marcos chegam em fatias próprias. */

type Section = 'objetivos' | 'diario';

const SECTIONS = [{ id: 'objetivos', label: 'Objetivos' }, { id: 'diario', label: 'Diário' }] as const;
const DESKTOP_GUTTER = 48;
const MOBILE_GUTTER = 16;
const CONTENT_MAX = 1144;
const DIARY_MAX = 704;
/** How close to the end of the list, in pixels, the next page starts loading. */
const LOAD_MORE_DISTANCE = 480;
const cinzel = 'Cinzel-Bold';

export function ChroniclesScreen() {
  const { width } = useWindowDimensions();
  const desktop = isDesktopLayout(Platform.OS, width);
  const [section, setSection] = useState<Section>('diario');
  const [nearEnd, setNearEnd] = useState(false);

  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const distance = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y;
    const near = distance < LOAD_MORE_DISTANCE;
    setNearEnd((current) => (current === near ? current : near));
  };

  return <View style={styles.root} testID="chronicles">
    <ScrollView
      contentContainerStyle={desktop ? styles.desktopContent : styles.mobileContent}
      onScroll={onScroll}
      scrollEventThrottle={100}
      testID={desktop ? 'chronicles-layout-desktop' : 'chronicles-layout-mobile'}
    >
      <View style={styles.column}>
        <View style={[styles.header, desktop && styles.headerDesktop]}>
          <View style={styles.headerCopy}>
            <Text style={styles.week} testID="chronicles-week">◈ Semana de {weekRangeLabel(saoPauloDay())}</Text>
            <Text accessibilityRole="header" aria-level={1} style={desktop ? styles.title : styles.titleCompact}>Crônicas</Text>
          </View>
          <View style={desktop ? styles.segmentedDesktop : undefined}>
            <TabList
              accessibilityLabel="Seções de Crônicas"
              onSelect={setSection}
              selected={section}
              tabs={SECTIONS}
              tabTestIDPrefix="chronicles-tab-"
              testID="chronicles-tabs"
              variant="segmented"
            />
          </View>
        </View>
        {section === 'diario'
          ? <View style={[styles.diaryLayout, desktop && styles.diaryLayoutDesktop]}>
            <View style={desktop ? styles.diaryDesktop : undefined}><Diary desktop={desktop} loadMore={nearEnd} /></View>
            <WeekCards desktop={desktop} />
          </View>
          : <View style={desktop ? styles.diaryDesktop : undefined}><Objectives /></View>}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  desktopContent: { paddingHorizontal: DESKTOP_GUTTER, paddingTop: 44, paddingBottom: 48 },
  mobileContent: { paddingHorizontal: MOBILE_GUTTER, paddingTop: 16, paddingBottom: 24 },
  column: { width: '100%', maxWidth: CONTENT_MAX, gap: 20 },
  header: { gap: 16 },
  headerDesktop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerCopy: { gap: 4 },
  segmentedDesktop: { width: 260 },
  week: { fontFamily: 'JetBrainsMono-Medium', fontSize: 10, lineHeight: 14, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  title: { fontFamily: cinzel, fontSize: 32, lineHeight: 40, letterSpacing: 1, color: theme.color.textPrimary },
  titleCompact: { fontFamily: cinzel, fontSize: 24, lineHeight: 32, color: theme.color.textPrimary },
  diaryLayout: { gap: 20 },
  diaryLayoutDesktop: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  diaryDesktop: { flex: 1, maxWidth: DIARY_MAX },
});
