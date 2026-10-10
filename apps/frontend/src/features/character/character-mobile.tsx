import type { ReactElement, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type RefreshControlProps } from 'react-native';
import { WiseIcon, theme } from '@/design-system';
import type { SessionMetrics, UserProfile } from '@/features/dashboard/api';
import {
  equipmentCategories,
  heroCaption,
  heroes,
  heroStatus,
  isHeroAvailable,
  type EquipmentCategory,
  type EquipmentCategoryDefinition,
  type EquippedItems,
  type HeroDefinition,
  type HeroStatus,
} from './catalog';
import { GroundShadow, HeroGlow } from './character-art';
import { HeroPill, LevelProgress, PreviewMark, SectionHeader, SummaryRow, describeDevices, useFocusRing, type DevicesState } from './character-parts';
import { PixelSprite } from './PixelSprite';
import { companionSprites, heroSprites, itemSprites } from './sprites';

/* Mobile layout, from the Figma frame "Personagem — Mobile v2 · Visão geral" (390 wide). */

const STAGE_WIDTH = 390;

type MobileCharacterProps = {
  devices: DevicesState;
  equipped: EquippedItems;
  hero: HeroDefinition;
  metrics: SessionMetrics | undefined;
  notice: string | null;
  onEquipHero: () => void;
  onOpenDevices: () => void;
  onOpenEquipment: (category: EquipmentCategory) => void;
  onSwapHero: () => void;
  previewing: boolean;
  /** Pull-to-refresh on touch platforms; omitted on web. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Equipment and refresh errors, rendered above the identity. */
  status: ReactNode;
  user: UserProfile;
};

/* ---------- Topo · herói ---------- */

function HeroTop({ hero, onSwapHero }: { hero: HeroDefinition; onSwapHero: () => void }) {
  const { focusProps, focusStyle } = useFocusRing();
  return <View style={styles.top} testID="character-hero-panel">
    <View pointerEvents="none" style={styles.stage} testID="character-hero-stage">
      <HeroGlow height={340} opacity={0.26} style={styles.stageGlow} width={360} />
      <GroundShadow blur={3} height={20} style={styles.stageShadow} width={128} />
      <PixelSprite scale={9} sprite={heroSprites[hero.id]} style={styles.stageSprite} testID="character-hero-sprite" />
    </View>
    <Text accessibilityRole="header" aria-level={1} style={styles.screenTitle}>Personagem</Text>
    <Pressable
      {...focusProps}
      accessibilityLabel="Trocar herói"
      accessibilityRole="button"
      hitSlop={3}
      onPress={onSwapHero}
      style={[styles.swapButton, focusStyle]}
      testID="character-swap-hero"
    >
      <WiseIcon color="accentPrimary" name="swap-horizontal-outline" size="compact" />
    </Pressable>
  </View>;
}

/* ---------- Identidade ---------- */

function Identity({ hero, previewing, user }: { hero: HeroDefinition; previewing: boolean; user: UserProfile }) {
  return <View style={styles.identity} testID="character-identity">
    <Text style={styles.identityEyebrow}>✦ Nível {user.level} · {hero.name}</Text>
    <Text style={styles.identityTitle}>{user.title?.trim() || user.displayName}</Text>
    {previewing ? <PreviewMark /> : null}
    <LevelProgress compact user={user} />
  </View>;
}

/* ---------- Equipados ---------- */

function EquipmentSlot({ category, equipped, onPress }: { category: EquipmentCategoryDefinition; equipped: EquippedItems; onPress: () => void }) {
  const item = equipped[category.id];
  const { focusProps, focusStyle } = useFocusRing();

  return <Pressable
    {...focusProps}
    accessibilityHint={`Abre a escolha de ${category.noun}`}
    accessibilityLabel={item ? `${category.label}: ${item.name}` : `${category.label}: vazio. Equipar ${category.noun}`}
    accessibilityRole="button"
    onPress={onPress}
    style={[styles.slot, focusStyle]}
    testID={`character-slot-${category.id}`}
  >
    <View style={[styles.slotTile, !item && styles.slotTileEmpty]}>
      {item
        ? <>
          <PixelSprite scale={5} sprite={itemSprites[item.sprite]} />
          <View style={styles.slotEquippedDot} testID={`character-slot-${category.id}-equipped`} />
        </>
        : <Text style={styles.slotPlus}>+</Text>}
    </View>
    <Text style={[styles.slotLabel, !item && styles.slotLabelEmpty]}>{category.slotLabel}</Text>
  </Pressable>;
}

function GearSection({ equipped, onOpen }: { equipped: EquippedItems; onOpen: (category: EquipmentCategory) => void }) {
  const { focusProps, focusStyle } = useFocusRing();
  return <View accessibilityLabel="Equipados" role="region" style={styles.gear} testID="character-equipment">
    <SectionHeader aside={<Pressable {...focusProps} accessibilityLabel="Gerenciar equipamento" accessibilityRole="button" hitSlop={12} onPress={() => onOpen('avatar')} style={focusStyle} testID="character-manage-equipment">
      <Text style={styles.sectionLink}>Gerenciar</Text>
    </Pressable>}>Equipados</SectionHeader>
    <View style={styles.slots}>
      {equipmentCategories.map((category) => <EquipmentSlot category={category} equipped={equipped} key={category.id} onPress={() => onOpen(category.id)} />)}
    </View>
  </View>;
}

/* ---------- Heróis (carrossel) ---------- */

function HeroCard({ hero, onEquip, status }: { hero: HeroDefinition; onEquip: () => void; status: HeroStatus }) {
  const available = isHeroAvailable(status);
  const caption = heroCaption(hero, status);
  const { focusProps, focusStyle } = useFocusRing();
  const cardStyle = [styles.heroCard, styles[`heroCard_${status === 'equipped' ? 'equipped' : status === 'unlocked' ? 'unlocked' : 'locked'}`]];
  const content = <>
    <View style={styles.heroStage}>
      {status === 'equipped' ? <HeroGlow height={110} opacity={0.3} style={styles.heroGlow} width={120} /> : null}
      <GroundShadow blur={3} height={8} style={styles.heroShadow} width={52} />
      <PixelSprite opacity={available ? 1 : 0.2} scale={4} sprite={heroSprites[hero.id]} style={styles.heroSprite} />
      {status === 'level-locked' ? <WiseIcon color="textSecondary" name="lock-closed" size="regular" style={styles.heroBadge} /> : null}
      {status === 'premium-locked' ? <WiseIcon color="accentPrimary" name="sparkles" size="regular" style={styles.heroBadge} /> : null}
    </View>
    <Text style={[styles.heroName, !available && styles.heroNameLocked]}>{hero.name}</Text>
    <HeroPill compact hero={hero} status={status} />
  </>;

  // The whole card is the touch target for a hero that can be equipped.
  return status === 'unlocked'
    ? <Pressable {...focusProps} accessibilityLabel={`Equipar ${hero.name}`} accessibilityRole="button" onPress={onEquip} style={[...cardStyle, focusStyle]} testID={`character-hero-${hero.id}`}>{content}</Pressable>
    : <View accessible accessibilityLabel={`${hero.name}, ${caption}${status === 'equipped' ? ', equipado' : ''}`} role="group" style={cardStyle} testID={`character-hero-${hero.id}`}>{content}</View>;
}

function HeroesSection({ equippedHeroId, onEquip, user }: { equippedHeroId: HeroDefinition['id']; onEquip: () => void; user: UserProfile }) {
  const statuses = heroes.map((hero) => ({ hero, status: heroStatus(hero, user, equippedHeroId) }));
  const unlocked = statuses.filter(({ status }) => isHeroAvailable(status)).length;
  return <View accessibilityLabel="Heróis" role="region" style={styles.heroes} testID="character-heroes">
    <View style={styles.heroesHeader}>
      <SectionHeader aside={<Text accessibilityLabel={`${unlocked} de ${heroes.length} heróis desbloqueados`} style={styles.sectionMeta}>{unlocked} de {heroes.length}</Text>}>Heróis</SectionHeader>
    </View>
    <ScrollView contentContainerStyle={styles.carousel} horizontal showsHorizontalScrollIndicator={false} testID="character-hero-carousel">
      {statuses.map(({ hero, status }) => <HeroCard hero={hero} key={hero.id} onEquip={onEquip} status={status} />)}
    </ScrollView>
  </View>;
}

/* ---------- Mais ---------- */

function MoreRow({ badge, children, description, first = false, onPress, testID, title }: {
  badge?: string;
  children: ReactNode;
  description: string;
  first?: boolean;
  onPress?: () => void;
  testID: string;
  title: string;
}) {
  const { focusProps, focusStyle } = useFocusRing();
  const style = [styles.moreRow, !first && styles.moreRowDivided];
  const content = <>
    <View style={styles.moreIcon}>{children}</View>
    <View style={styles.moreCopy}>
      <Text style={styles.moreTitle}>{title}</Text>
      <Text style={styles.moreDescription}>{description}</Text>
    </View>
    {badge ? <Text style={styles.moreBadge}>{badge}</Text> : null}
    <WiseIcon color="textTertiary" name="chevron-forward" size="xsmall" />
  </>;
  return onPress
    ? <Pressable {...focusProps} accessibilityHint="Abre a lista de dispositivos" accessibilityLabel={`${title}. ${description}`} accessibilityRole="button" onPress={onPress} style={[...style, focusStyle]} testID={testID}>{content}</Pressable>
    : <View accessible accessibilityLabel={`${title}. ${description}`} style={style} testID={testID}>{content}</View>;
}

function MoreSection({ devices, onOpenDevices }: { devices: DevicesState; onOpenDevices: () => void }) {
  return <View accessibilityLabel="Mais" role="region" style={styles.more} testID="character-more">
    <View style={styles.moreList}>
      <MoreRow description="Coruja de estudo · em breve" first testID="character-companion" title="Companheiro">
        <PixelSprite opacity={0.5} scale={3} sprite={companionSprites.coruja} />
      </MoreRow>
      <MoreRow badge={devices.count !== null ? String(devices.count) : undefined} description={describeDevices(devices, true)} onPress={onOpenDevices} testID="character-devices" title="Dispositivos conectados">
        <WiseIcon color="textSecondary" name="people-outline" size="compact" />
      </MoreRow>
    </View>
  </View>;
}

/* ---------- Tela ---------- */

export function MobileCharacter({ devices, equipped, hero, metrics, notice, onEquipHero, onOpenDevices, onOpenEquipment, onSwapHero, previewing, refreshControl, status, user }: MobileCharacterProps) {
  return <ScrollView refreshControl={refreshControl} showsVerticalScrollIndicator={false} testID="character-scroll">
    <View style={styles.column}>
      <HeroTop hero={hero} onSwapHero={onSwapHero} />
      {/* Outside the content gap flow so an empty live region takes no space. */}
      <View accessibilityLiveRegion="polite" aria-live="polite" testID="character-notice">
        {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
      </View>
      <View style={styles.content} testID="character-content">
        {status}
        <Identity hero={hero} previewing={previewing} user={user} />
        <SummaryRow compact metrics={metrics} user={user} />
        <GearSection equipped={equipped} onOpen={onOpenEquipment} />
      </View>
      <HeroesSection equippedHeroId={hero.id} onEquip={onEquipHero} user={user} />
      <MoreSection devices={devices} onOpenDevices={onOpenDevices} />
    </View>
  </ScrollView>;
}

const cinzel = 'Cinzel-Bold';
const mono = 'JetBrainsMono-Medium';
const GUTTER = 24;

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 520, alignSelf: 'center' },

  top: { height: 352 },
  stage: { position: 'absolute', top: 0, left: '50%', marginLeft: -STAGE_WIDTH / 2, width: STAGE_WIDTH, height: 352 },
  stageGlow: { position: 'absolute', top: 40, left: 15 },
  stageShadow: { position: 'absolute', top: 316, left: 131 },
  stageSprite: { position: 'absolute', top: 104, left: 123 },
  screenTitle: { position: 'absolute', top: 40, left: 0, right: 0, fontFamily: cinzel, fontSize: 20, lineHeight: 27, textAlign: 'center', color: theme.color.textPrimary },
  swapButton: { position: 'absolute', top: 34, right: 22, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard },

  content: { gap: 24, paddingHorizontal: GUTTER, paddingBottom: 28 },
  noticeText: { paddingHorizontal: GUTTER, paddingBottom: 24, fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, textAlign: 'center', color: theme.color.textSecondary },
  identity: { alignItems: 'center', gap: theme.space.inlineTight },
  identityEyebrow: { fontFamily: cinzel, fontSize: 10, lineHeight: 13, letterSpacing: 2.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  identityTitle: { fontFamily: cinzel, fontSize: 22, lineHeight: 30, textAlign: 'center', color: theme.color.textPrimary },

  sectionLink: { fontFamily: 'Inter-SemiBold', fontSize: 12, lineHeight: 15, color: theme.color.accentPrimary },
  sectionMeta: { fontFamily: 'Inter-SemiBold', fontSize: 12, lineHeight: 15, color: theme.color.textTertiary },

  gear: { gap: 12 },
  slots: { flexDirection: 'row', gap: theme.space.inlineTight },
  slot: { flex: 1, minWidth: 0, gap: 6 },
  slotTile: { height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceElevated },
  slotTileEmpty: { borderStyle: 'dashed', borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceInset },
  slotEquippedDot: { position: 'absolute', top: 6, right: 5.5, width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.color.accentHighlight },
  slotPlus: { fontFamily: 'Inter-Regular', fontSize: 24, lineHeight: 29, color: theme.color.accentMuted },
  slotLabel: { fontFamily: mono, fontSize: 9, lineHeight: 12, letterSpacing: 1, textAlign: 'center', color: theme.color.textSecondary },
  slotLabelEmpty: { color: theme.color.textTertiary },

  heroes: { gap: 12, paddingBottom: 28 },
  heroesHeader: { paddingHorizontal: GUTTER },
  carousel: { gap: 12, paddingHorizontal: GUTTER },
  heroCard: { width: 128, height: 184, alignItems: 'center', gap: theme.space.inlineTight, paddingVertical: 14, paddingHorizontal: 12, borderRadius: theme.radius.card, borderWidth: theme.border.standard },
  heroCard_equipped: { borderColor: theme.color.accentPrimary, backgroundColor: theme.color.surfaceElevated },
  heroCard_unlocked: { borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard },
  heroCard_locked: { borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceCard },
  heroStage: { width: 80, height: 100, overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: -4, left: -20 },
  heroShadow: { position: 'absolute', top: 92, left: 14 },
  heroSprite: { position: 'absolute', top: 0, left: 8 },
  heroBadge: { position: 'absolute', top: 38, left: 30 },
  heroName: { fontFamily: cinzel, fontSize: 13, lineHeight: 18, color: theme.color.textPrimary },
  heroNameLocked: { color: theme.color.textTertiary },

  more: { paddingHorizontal: GUTTER, paddingBottom: 28 },
  moreList: { overflow: 'hidden', borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingRight: 14, paddingLeft: 16 },
  moreRowDivided: { borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderGhost },
  moreIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset },
  moreCopy: { flex: 1, minWidth: 0, gap: 2 },
  moreTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 17, color: theme.color.textPrimary },
  moreDescription: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 15, color: theme.color.textSecondary },
  moreBadge: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 1, color: theme.color.textTertiary },
});
