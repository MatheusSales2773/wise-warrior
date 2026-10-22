import type { ReactElement, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type RefreshControlProps } from 'react-native';
import { theme } from '@/design-system';
import type { SessionMetrics, UserProfile } from '@/features/dashboard/api';
import { equipmentCategories, type EquipmentCategory, type EquipmentCategoryDefinition, type EquippedItems } from './catalog';
import { GroundShadow, HeroGlow } from './character-art';
import { LevelProgress, PreviewMark, SectionHeader, SummaryRow, describeHero, useFocusRing } from './character-parts';
import { LayeredHero } from './layered-hero';
import { PixelSprite } from './PixelSprite';
import { companionSprites, itemSprites } from './sprites';

/* Mobile layout, from the Figma frame "Personagem — Mobile v2 · Visão geral" (390 wide). */

const STAGE_WIDTH = 390;

type MobileCharacterProps = {
  equipped: EquippedItems;
  metrics: SessionMetrics | undefined;
  onOpenEquipment: (category: EquipmentCategory) => void;
  previewing: boolean;
  /** Pull-to-refresh on touch platforms; omitted on web. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Equipment and refresh errors, rendered above the identity. */
  status: ReactNode;
  user: UserProfile;
};

/* ---------- Topo · herói ---------- */

function HeroTop({ equipped }: { equipped: EquippedItems }) {
  return <View style={styles.top} testID="character-hero-panel">
    <View pointerEvents="none" style={styles.stage} testID="character-hero-stage">
      <HeroGlow height={340} opacity={0.26} style={styles.stageGlow} width={360} />
      <GroundShadow blur={3} height={20} style={styles.stageShadow} width={128} />
      <LayeredHero equipped={equipped} scale={9} style={styles.stageSprite} testID="character-hero-sprite" />
    </View>
    <Text accessibilityRole="header" aria-level={1} style={styles.screenTitle}>Personagem</Text>
  </View>;
}

/* ---------- Identidade ---------- */

function Identity({ equipped, previewing, user }: { equipped: EquippedItems; previewing: boolean; user: UserProfile }) {
  return <View style={styles.identity} testID="character-identity">
    <Text style={styles.identityEyebrow}>{describeHero(user.level, equipped)}</Text>
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

/* ---------- Mais ---------- */

function MoreSection() {
  const description = 'Coruja de estudo · em breve';
  return <View accessibilityLabel="Mais" role="region" style={styles.more} testID="character-more">
    <View style={styles.moreList}>
      <View accessible accessibilityLabel={`Companheiro. ${description}`} style={styles.moreRow} testID="character-companion">
        <View style={styles.moreIcon}><PixelSprite opacity={0.5} scale={3} sprite={companionSprites.coruja} /></View>
        <View style={styles.moreCopy}>
          <Text style={styles.moreTitle}>Companheiro</Text>
          <Text style={styles.moreDescription}>{description}</Text>
        </View>
      </View>
    </View>
  </View>;
}

/* ---------- Tela ---------- */

export function MobileCharacter({ equipped, metrics, onOpenEquipment, previewing, refreshControl, status, user }: MobileCharacterProps) {
  return <ScrollView refreshControl={refreshControl} showsVerticalScrollIndicator={false} testID="character-scroll">
    <View style={styles.column}>
      <HeroTop equipped={equipped} />
      <View style={styles.content} testID="character-content">
        {status}
        <Identity equipped={equipped} previewing={previewing} user={user} />
        <SummaryRow compact metrics={metrics} user={user} />
        <GearSection equipped={equipped} onOpen={onOpenEquipment} />
      </View>
      <MoreSection />
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

  content: { gap: 24, paddingHorizontal: GUTTER, paddingBottom: 28 },
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
