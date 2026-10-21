import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useAuth } from '@/core/auth/auth-context';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseIcon, WiseText, isDesktopLayout, theme } from '@/design-system';
import type { SessionMetrics, UserProfile } from '@/features/dashboard/api';
import { profileQueryOptions, sessionMetricsQueryOptions } from '@/features/dashboard/queries';
import { profileWithEquipped } from '@/features/profile/equipment';
import { cosmeticsCatalogQueryOptions, deviceSessionsQueryOptions } from '@/features/profile/queries';
import { useCosmeticEquipment } from '@/features/profile/use-cosmetic-equipment';
import { equipmentCategories, equippedItems, type EquipmentCategory, type EquipmentCategoryDefinition, type EquippedItems } from './catalog';
import { GroundShadow, HeroGlow } from './character-art';
import { MobileCharacter } from './character-mobile';
import { LevelProgress, PreviewMark, describeHero, SectionHeader, SummaryRow, describeDevices, useFocusRing, type DevicesState } from './character-parts';
import { DevicesPanel } from './devices-panel';
import { EquipmentDrawer } from './equipment-drawer';
import { LayeredHero } from './layered-hero';
import { PixelSprite } from './PixelSprite';
import { companionSprites, itemSprites } from './sprites';

/* ---------- Painel do herói ---------- */

function HeroPanel({ desktop, equipped, metrics, previewing, user }: {
  desktop: boolean;
  equipped: EquippedItems;
  previewing: boolean;
  metrics: SessionMetrics | undefined;
  user: UserProfile;
}) {
  return <View style={[styles.heroPanel, desktop && styles.heroPanelDesktop]} testID="character-hero-panel">
    <LinearGradient colors={['rgba(18, 18, 28, 0.9)', 'rgba(7, 7, 12, 0.9)']} end={{ x: 0, y: 1 }} pointerEvents="none" start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
    <Text accessibilityRole="header" aria-level={1} style={styles.screenTitle}>Personagem</Text>
    <View style={styles.heroStage} testID="character-hero-stage">
      <HeroGlow height={480} opacity={0.24} style={styles.heroStageGlow} width={520} />
      <GroundShadow height={27} style={styles.heroStageShadow} width={168} />
      <LayeredHero equipped={equipped} scale={12} testID="character-hero-sprite" />
    </View>
    <View style={styles.identity} testID="character-identity">
      <Text style={styles.identityEyebrow}>{describeHero(user.level, equipped)}</Text>
      <Text style={styles.identityTitle}>{user.title?.trim() || user.displayName}</Text>
      {previewing ? <PreviewMark /> : null}
      <Text style={styles.identitySubtitle}>{user.title?.trim() ? user.displayName : user.email}</Text>
      <LevelProgress user={user} />
    </View>
    <View style={styles.summaryWrap}><SummaryRow metrics={metrics} user={user} /></View>
  </View>;
}

/* ---------- Equipados ---------- */

function EquipmentSlot({ category, equipped, onPress }: { category: EquipmentCategoryDefinition; equipped: EquippedItems; onPress: () => void }) {
  const item = equipped[category.id];
  const { focusProps, focusStyle } = useFocusRing();
  const name = item?.name ?? `Equipar ${category.noun}`;

  return <Pressable
    {...focusProps}
    accessibilityHint={`Abre a escolha de ${category.noun}`}
    accessibilityLabel={item ? `${category.label}: ${item.name}` : `${category.label}: vazio. Equipar ${category.noun}`}
    accessibilityRole="button"
    onPress={onPress}
    style={[styles.slot, !item && styles.slotEmpty, focusStyle]}
    testID={`character-slot-${category.id}`}
  >
    <View style={[styles.slotTile, !item && styles.slotTileEmpty]}>
      {item
        ? <>
          <PixelSprite scale={6} sprite={itemSprites[item.sprite]} />
          <View style={styles.slotEquippedDot} testID={`character-slot-${category.id}-equipped`} />
        </>
        : <Text style={styles.slotPlus}>+</Text>}
    </View>
    <View style={styles.slotCopy}>
      <Text style={styles.slotLabel}>{category.slotLabel}</Text>
      <Text style={[styles.slotName, !item && styles.slotNameEmpty]}>{name}</Text>
    </View>
  </Pressable>;
}

function GearSection({ equipped, onOpen }: { equipped: EquippedItems; onOpen: (category: EquipmentCategory) => void }) {
  const { focusProps, focusStyle } = useFocusRing();
  return <View accessibilityLabel="Equipados" role="region" style={styles.section} testID="character-equipment">
    <SectionHeader aside={<Pressable {...focusProps} accessibilityRole="button" hitSlop={12} onPress={() => onOpen('avatar')} style={focusStyle} testID="character-manage-equipment">
      <Text style={styles.sectionLink}>Gerenciar equipamento</Text>
    </Pressable>}>Equipados</SectionHeader>
    <View style={styles.row}>
      {equipmentCategories.map((category) => <EquipmentSlot category={category} equipped={equipped} key={category.id} onPress={() => onOpen(category.id)} />)}
    </View>
  </View>;
}

/* ---------- Mais ---------- */

function MoreRow({ children, description, onPress, testID, title }: { children: ReactNode; description: string; onPress?: () => void; testID: string; title: string }) {
  const { focusProps, focusStyle } = useFocusRing();
  const content = <>
    <View style={styles.moreIcon}>{children}</View>
    <View style={styles.moreCopy}>
      <Text style={styles.moreTitle}>{title}</Text>
      <Text style={styles.moreDescription}>{description}</Text>
    </View>
    <WiseIcon color="textTertiary" name="chevron-forward" size="xsmall" />
  </>;
  return onPress
    ? <Pressable {...focusProps} accessibilityHint="Abre a lista de dispositivos" accessibilityLabel={`${title}. ${description}`} accessibilityRole="button" onPress={onPress} style={[styles.moreRow, focusStyle]} testID={testID}>{content}</Pressable>
    : <View accessible accessibilityLabel={`${title}. ${description}`} style={styles.moreRow} testID={testID}>{content}</View>;
}

function MoreSection({ devices, onOpenDevices }: { devices: DevicesState; onOpenDevices: () => void }) {
  return <View accessibilityLabel="Mais" role="region" style={styles.section} testID="character-more">
    <SectionHeader>Mais</SectionHeader>
    <View style={styles.row}>
      <MoreRow description="Coruja de estudo · chega na Fase 2" testID="character-companion" title="Companheiro">
        <PixelSprite opacity={0.5} scale={3} sprite={companionSprites.coruja} />
      </MoreRow>
      <MoreRow description={describeDevices(devices, false)} onPress={onOpenDevices} testID="character-devices" title="Dispositivos conectados">
        <WiseIcon color="textSecondary" name="people-outline" size="regular" />
      </MoreRow>
    </View>
  </View>;
}

/* ---------- Tela ---------- */

/** Equipment failures and a stale profile above the content; absent when there is nothing to say, so it takes no gap. */
function StatusMessages({ messages }: { messages: { key: string; title: string; message: string }[] }) {
  if (!messages.length) return null;
  return <View style={styles.statusMessages} testID="character-status">
    {messages.map(({ key, message, title }) => <FeedbackMessage key={key} message={message} testID={`character-status-${key}`} title={title} variant="error" />)}
  </View>;
}

export function CharacterScreen() {
  const profile = useQuery(profileQueryOptions());
  const metrics = useQuery(sessionMetricsQueryOptions());
  const deviceSessions = useQuery(deviceSessionsQueryOptions());
  const catalog = useQuery(cosmeticsCatalogQueryOptions());
  const equipment = useCosmeticEquipment();
  const { sessionId } = useAuth();
  const { width } = useWindowDimensions();
  const [drawerCategory, setDrawerCategory] = useState<EquipmentCategory | null>(null);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { cancel } = equipment;
  const closeDrawer = useCallback(() => {
    cancel();
    setDrawerCategory(null);
  }, [cancel]);
  const closeDevices = useCallback(() => setDevicesOpen(false), []);
  const openDevices = useCallback(() => setDevicesOpen(true), []);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([profile.refetch(), catalog.refetch(), deviceSessions.refetch(), metrics.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (profile.isPending && !profile.data) {
    return <Screen safeAreaEdges={[]} testID="character" title="Personagem">
      <View accessibilityLabel="Carregando seu personagem" accessibilityLiveRegion="polite" accessibilityState={{ busy: true }} aria-busy aria-live="polite" style={styles.loading} testID="character-loading">
        <WiseText variant="body">Carregando seu personagem…</WiseText>
        <ProgressBar indeterminate accessibilityLabel="Carregando seu personagem" />
      </View>
    </Screen>;
  }
  if (profile.isError && !profile.data) {
    return <Screen safeAreaEdges={[]} testID="character" title="Personagem">
      <View style={styles.loading} testID="character-error">
        <FeedbackMessage message="Não foi possível carregar seu personagem." title="Personagem indisponível" variant="error" />
        <WiseButton label="Tentar novamente" loading={profile.isRefetching} onPress={() => void profile.refetch()} />
      </View>
    </Screen>;
  }
  const user = profile.data;
  if (!user) return null;

  // The Prévia only changes what the panel shows; the cached profile and the server stay untouched.
  const previewed = catalog.data?.find((item) => item.id === equipment.selectedId && item.unlocked && !item.equipped);
  const shown: UserProfile = previewed ? profileWithEquipped(user, previewed) : user;
  const desktop = isDesktopLayout(Platform.OS, width);
  const variant = desktop ? 'drawer' : 'sheet';
  const equipped = equippedItems(user);
  const shownEquipped = equippedItems(shown);
  const devices: DevicesState = { count: deviceSessions.data?.length ?? null, failed: deviceSessions.isError };
  const statusMessages = [
    ...(equipment.notice ? [{ key: 'equipment', ...equipment.notice }] : []),
    ...(profile.isError ? [{ key: 'profile', title: 'Dados desatualizados', message: 'Não foi possível atualizar seu personagem.' }] : []),
  ];
  // Touch platforms refresh by pulling down; web relies on the queries refetching on their own.
  const refreshControl = Platform.OS === 'web' ? undefined
    : <RefreshControl colors={[theme.color.accentPrimary]} onRefresh={() => { void refresh(); }} progressBackgroundColor={theme.color.surfaceCard} refreshing={refreshing} tintColor={theme.color.accentPrimary} />;
  const panel = <HeroPanel desktop={desktop} equipped={shownEquipped} metrics={metrics.data} previewing={Boolean(previewed)} user={shown} />;
  const content = <View style={[styles.content, desktop && styles.contentDesktop]} testID="character-content">
    <StatusMessages messages={statusMessages} />
    <GearSection equipped={shownEquipped} onOpen={setDrawerCategory} />
    <MoreSection devices={devices} onOpenDevices={openDevices} />
  </View>;

  return <View style={styles.root} testID="character">
    <LinearGradient colors={[theme.color.backgroundCanvas, theme.color.backgroundRaised, theme.color.backgroundOverlay]} end={{ x: 1, y: 1 }} locations={[0, 0.6, 1]} pointerEvents="none" start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
    {desktop
      ? <View style={styles.desktopLayout} testID="character-desktop">
        <ScrollView contentContainerStyle={styles.panelScrollContent} style={styles.panelScroll}>{panel}</ScrollView>
        <ScrollView style={styles.contentScroll} testID="character-content-scroll">{content}</ScrollView>
      </View>
      : <MobileCharacter
        devices={devices}
        equipped={shownEquipped}
        metrics={metrics.data}
        onOpenDevices={openDevices}
        onOpenEquipment={setDrawerCategory}
        previewing={Boolean(previewed)}
        refreshControl={refreshControl}
        status={<StatusMessages messages={statusMessages} />}
        user={shown}
      />}
    <EquipmentDrawer catalog={catalog} category={drawerCategory} equipment={equipment} equipped={equipped} level={user.level} onCategoryChange={(next) => { cancel(); setDrawerCategory(next); }} onClose={closeDrawer} planTier={user.planTier} variant={variant} />
    {devicesOpen ? <DevicesPanel currentSessionId={sessionId} onClose={closeDevices} query={deviceSessions} variant={variant} /> : null}
  </View>;
}

const cinzel = 'Cinzel-Bold';
const mono = 'JetBrainsMono-Medium';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.backgroundCanvas },
  statusMessages: { gap: theme.space.stackTight },
  loading: { gap: theme.space.stackDefault, padding: theme.space.cardInset },
  desktopLayout: { flex: 1, flexDirection: 'row' },
  panelScroll: { width: 460, flexGrow: 0, flexShrink: 0 },
  panelScrollContent: { flexGrow: 1 },
  contentScroll: { flex: 1 },

  heroPanel: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 40, paddingBottom: 40, overflow: 'hidden', borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderSubtle },
  heroPanelDesktop: { flexGrow: 1, borderBottomWidth: 0, borderRightWidth: theme.border.standard, borderRightColor: theme.color.borderSubtle },
  screenTitle: { alignSelf: 'stretch', fontFamily: cinzel, fontSize: 22, lineHeight: 30, color: theme.color.textPrimary },
  heroStage: { width: 192, height: 288, marginTop: 38, alignItems: 'center' },
  heroStageGlow: { position: 'absolute', top: -88, left: -164 },
  heroStageShadow: { position: 'absolute', top: 280, left: 12 },
  identity: { width: '100%', maxWidth: 380, marginTop: 40, alignItems: 'center', gap: 10 },
  identityEyebrow: { fontFamily: cinzel, fontSize: 10, lineHeight: 13, letterSpacing: 2.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  identityTitle: { fontFamily: cinzel, fontSize: 26, lineHeight: 34, textAlign: 'center', color: theme.color.textPrimary },
  identitySubtitle: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 16, textAlign: 'center', color: theme.color.textSecondary },
  summaryWrap: { width: '100%', maxWidth: 380, marginTop: 42 },

  content: { gap: 36, padding: theme.space.cardInset },
  contentDesktop: { padding: 48 },
  section: { gap: 14 },
  sectionLink: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.accentPrimary },
  sectionMeta: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.textTertiary },
  row: { flexDirection: 'row', gap: 14 },

  slot: { flex: 1, minWidth: 0, gap: 10, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 14, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  slotEmpty: { borderStyle: 'dashed', borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceInset },
  slotTile: { height: 96, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceElevated },
  slotTileEmpty: { borderColor: theme.color.borderGhost, backgroundColor: theme.color.backgroundCanvas },
  slotEquippedDot: { position: 'absolute', top: 7, right: 6.5, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.accentHighlight },
  slotPlus: { fontFamily: 'Inter-Regular', fontSize: 30, lineHeight: 36, color: theme.color.accentMuted },
  slotCopy: { gap: 2 },
  slotLabel: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 1, color: theme.color.textTertiary },
  slotName: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.textPrimary },
  slotNameEmpty: { color: theme.color.accentPrimary },

  moreRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  moreIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset },
  moreCopy: { flex: 1, minWidth: 0, gap: 2 },
  moreTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 17, color: theme.color.textPrimary },
  moreDescription: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 15, color: theme.color.textSecondary },
});
