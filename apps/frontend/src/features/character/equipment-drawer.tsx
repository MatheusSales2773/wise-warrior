import { useContext, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { FeedbackMessage, WiseButton, WiseIcon, theme } from '@/design-system';
import { useRuntimeMotionDuration } from '@/design-system/components/motion-runtime';
import { controlStyles } from '@/design-system/components/control-styles';
import { RadioMark } from './character-art';
import { equipmentCategories, equipmentCategoryById, optionsFor, type CosmeticOption, type EquipmentCategory, type EquippedItems } from './catalog';
import { PixelSprite } from './PixelSprite';
import { itemSprites } from './sprites';

/** `drawer` slides in from the right on desktop; `sheet` rises from the bottom on mobile (Figma "Trocar título" frames). */
export type EquipmentPanelVariant = 'drawer' | 'sheet';

type EquipmentDrawerProps = {
  category: EquipmentCategory | null;
  equipped: EquippedItems;
  isPremium: boolean;
  onCategoryChange: (category: EquipmentCategory) => void;
  onClose: () => void;
  variant: EquipmentPanelVariant;
};

function isSelectable(option: CosmeticOption, isPremium: boolean) {
  return option.availability.kind === 'owned' || (option.availability.kind === 'premium' && isPremium);
}

function optionCaption(option: CosmeticOption, equipped: boolean) {
  if (equipped) return 'Equipado agora';
  return option.availability.kind === 'premium' ? 'Plano premium' : option.availability.caption;
}

function OptionRow({ equipped, isPremium, onSelect, option, selected, sheet }: {
  equipped: boolean;
  isPremium: boolean;
  onSelect: () => void;
  option: CosmeticOption;
  selected: boolean;
  sheet: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const selectable = isSelectable(option, isPremium);
  const dimmed = !selectable;
  const caption = optionCaption(option, equipped);
  const status = selectable ? '' : option.availability.kind === 'premium' ? ', exclusivo do plano premium' : ', bloqueado';

  return <Pressable
    accessibilityLabel={`${option.name}, ${caption}${status}`}
    accessibilityRole="radio"
    accessibilityState={{ checked: selected, disabled: !selectable }}
    aria-checked={selected}
    aria-disabled={!selectable}
    disabled={!selectable}
    onBlur={() => setFocused(false)}
    onFocus={() => setFocused(true)}
    onPress={onSelect}
    style={[styles.option, selected && styles.optionSelected, focused && Platform.OS === 'web' && controlStyles.webFocus]}
    testID={`equipment-option-${option.id}`}
  >
    <View style={[styles.optionArt, sheet && styles.optionArtSheet]}>
      <PixelSprite opacity={dimmed ? 0.4 : 1} scale={sheet ? 4 : 5} sprite={itemSprites[option.sprite]} />
    </View>
    <View style={styles.optionCopy}>
      <Text numberOfLines={1} style={[styles.optionName, sheet && styles.optionNameSheet, dimmed && styles.optionNameDimmed]}>{option.name}</Text>
      <Text numberOfLines={1} style={[styles.optionCaption, equipped && styles.optionCaptionEquipped]}>{caption}</Text>
    </View>
    {selectable
      ? <RadioMark selected={selected} />
      : option.availability.kind === 'premium'
        ? <WiseIcon color="accentPrimary" name="sparkles" size="small" />
        : <WiseIcon color="textTertiary" name="lock-closed" size="small" />}
  </Pressable>;
}

function CategoryTab({ active, label, onPress, sheet }: { active: boolean; label: string; onPress: () => void; sheet: boolean }) {
  const [focused, setFocused] = useState(false);
  return <Pressable
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
    aria-selected={active}
    onBlur={() => setFocused(false)}
    onFocus={() => setFocused(true)}
    onPress={onPress}
    style={[styles.segment, sheet && styles.segmentSheet, active && styles.segmentActive, focused && Platform.OS === 'web' && controlStyles.webFocus]}
  >
    <Text style={[styles.segmentLabel, sheet && styles.segmentLabelSheet, active && styles.segmentLabelActive]}>{label}</Text>
  </Pressable>;
}

function PanelBody({ category, equipped, isPremium, onCategoryChange, onClose, variant }: EquipmentDrawerProps & { category: EquipmentCategory }) {
  const sheet = variant === 'sheet';
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const definition = equipmentCategoryById[category];
  const current = equipped[category];
  const options = optionsFor(category, current);
  const [selectedId, setSelectedId] = useState(current?.id ?? null);
  const [unavailable, setUnavailable] = useState(false);
  const [closeFocused, setCloseFocused] = useState(false);
  const selected = options.find((option) => option.id === selectedId) ?? null;
  const keepsCurrent = selected !== null && selected.id === current?.id;

  const confirm = () => {
    if (!selected || keepsCurrent) {
      onClose();
      return;
    }
    // Equipping needs the cosmetic inventory API; until then the current item stays equipped.
    setUnavailable(true);
  };

  const tabs = <View accessibilityRole="tablist" style={styles.segmented}>
    {equipmentCategories.map((item) => <CategoryTab active={item.id === category} key={item.id} label={item.label} onPress={() => onCategoryChange(item.id)} sheet={sheet} />)}
  </View>;
  const optionRows = options.map((option) => <OptionRow
    equipped={option.id === current?.id}
    isPremium={isPremium}
    key={option.id}
    onSelect={() => { setSelectedId(option.id); setUnavailable(false); }}
    option={option}
    selected={option.id === selectedId}
    sheet={sheet}
  />);
  const feedback = unavailable
    ? <FeedbackMessage message={`A troca de ${definition.noun} ainda não está disponível. ${current ? `${current.name} continua equipado.` : ''}`.trim()} testID="equipment-unavailable" variant="info" />
    : null;

  if (sheet) {
    return <View
      accessibilityLabel={`Escolher ${definition.noun}`}
      aria-modal
      accessibilityViewIsModal
      role="dialog"
      style={[styles.sheet, { paddingBottom: 24 + bottomInset }]}
      testID="equipment-drawer"
    >
      <Pressable accessibilityLabel="Fechar" accessibilityRole="button" hitSlop={{ top: 13, bottom: 13, left: 60, right: 60 }} onPress={onClose} style={styles.handle} testID="equipment-handle" />
      <View style={styles.sheetTop}>
        <Text accessibilityRole="header" aria-level={2} style={styles.sheetTitle}>Escolher {definition.noun}</Text>
        <Text style={styles.sheetDescription}>{definition.description}</Text>
      </View>
      {tabs}
      <ScrollView accessibilityLabel={`Opções de ${definition.noun}`} accessibilityRole="radiogroup" contentContainerStyle={styles.optionsSheet} style={styles.sheetOptions}>{optionRows}</ScrollView>
      {feedback}
      <WiseButton disabled={!selected} label={keepsCurrent ? `Manter este ${definition.noun}` : `Equipar ${definition.noun}`} onPress={confirm} />
    </View>;
  }

  return <View
    accessibilityLabel={`Escolher ${definition.noun}`}
    aria-modal
    accessibilityViewIsModal
    role="dialog"
    style={styles.drawer}
    testID="equipment-drawer"
  >
    <View style={styles.top}>
      <View style={styles.topCopy}>
        <Text accessibilityRole="header" aria-level={2} style={styles.title}>Escolher {definition.noun}</Text>
        <Text style={styles.description}>{definition.description}</Text>
      </View>
      <Pressable
        accessibilityLabel="Fechar"
        accessibilityRole="button"
        hitSlop={8}
        onBlur={() => setCloseFocused(false)}
        onFocus={() => setCloseFocused(true)}
        onPress={onClose}
        style={[styles.close, closeFocused && Platform.OS === 'web' && controlStyles.webFocus]}
      >
        <Text style={styles.closeGlyph}>✕</Text>
      </Pressable>
    </View>
    {tabs}
    <View accessibilityLabel={`Opções de ${definition.noun}`} accessibilityRole="radiogroup" style={styles.options}>{optionRows}</View>
    <View style={styles.spacer} />
    {feedback}
    <View style={styles.footer}>
      <View style={styles.footerAction}><WiseButton label="Cancelar" onPress={onClose} variant="secondary" /></View>
      <View style={styles.footerAction}><WiseButton disabled={!selected} label={`Equipar ${definition.noun}`} onPress={confirm} /></View>
    </View>
  </View>;
}

export function EquipmentDrawer(props: EquipmentDrawerProps) {
  const { category, onClose, variant } = props;
  const motionDuration = useRuntimeMotionDuration();
  const sheet = variant === 'sheet';

  useEffect(() => {
    if (!category || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [category, onClose]);

  if (!category) return null;

  return <Modal
    animationType={motionDuration === theme.motion.none ? 'none' : sheet ? 'slide' : 'fade'}
    onRequestClose={onClose}
    presentationStyle="overFullScreen"
    testID="equipment-modal"
    transparent
    visible
  >
    <View style={[styles.overlay, sheet ? styles.overlaySheet : styles.overlayDrawer]}>
      <Pressable
        accessibilityElementsHidden
        accessible={false}
        focusable={false}
        importantForAccessibility="no-hide-descendants"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
        testID="equipment-backdrop"
      />
      {/* Remount per category so the selection starts at that category's equipped item. */}
      <PanelBody {...props} category={category} key={category} />
    </View>
  </Modal>;
}

const inter = { regular: 'Inter-Regular', semiBold: 'Inter-SemiBold' } as const;

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  overlayDrawer: { flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'rgba(7, 7, 12, 0.7)' },
  overlaySheet: { justifyContent: 'flex-end', backgroundColor: 'rgba(7, 7, 12, 0.72)' },

  drawer: {
    width: 480,
    maxWidth: '100%',
    height: '100%',
    gap: 20,
    padding: 32,
    backgroundColor: theme.color.surfaceElevated,
    borderLeftWidth: theme.border.standard,
    borderLeftColor: theme.color.borderEmphasis,
    boxShadow: '-12px 0px 32px 0px rgba(0, 0, 0, 0.5)',
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.space.stackTight },
  topCopy: { flexShrink: 1, gap: 6 },
  title: { fontFamily: 'Cinzel-Bold', fontSize: 22, lineHeight: 30, color: theme.color.textPrimary },
  description: { fontFamily: inter.regular, fontSize: 13, lineHeight: 16, color: theme.color.textSecondary },
  close: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis },
  closeGlyph: { fontFamily: inter.regular, fontSize: 14, lineHeight: 17, color: theme.color.textSecondary },
  spacer: { flex: 1 },
  footer: { flexDirection: 'row', gap: theme.space.stackTight },
  footerAction: { flex: 1 },

  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    alignSelf: 'center',
    gap: 16,
    paddingTop: 13,
    paddingHorizontal: 24,
    backgroundColor: theme.color.surfaceElevated,
    borderTopWidth: theme.border.standard,
    borderLeftWidth: theme.border.standard,
    borderRightWidth: theme.border.standard,
    borderColor: theme.color.borderEmphasis,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    boxShadow: '0px -8px 24px 0px rgba(0, 0, 0, 0.5)',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.color.borderFocus },
  sheetTop: { alignItems: 'center', gap: theme.space.inlineHairline },
  sheetTitle: { fontFamily: 'Cinzel-Bold', fontSize: 18, lineHeight: 24, textAlign: 'center', color: theme.color.textPrimary },
  sheetDescription: { fontFamily: inter.regular, fontSize: 13, lineHeight: 16, textAlign: 'center', color: theme.color.textSecondary },
  sheetOptions: { flexShrink: 1 },

  segmented: { flexDirection: 'row', gap: theme.space.inlineHairline, padding: theme.space.inlineHairline, borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset },
  segment: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 9, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: 'transparent' },
  segmentSheet: { paddingVertical: 8 },
  segmentActive: { backgroundColor: theme.color.surfaceCard, borderColor: theme.color.accentMuted },
  segmentLabel: { fontFamily: inter.semiBold, fontSize: 13, lineHeight: 16, color: theme.color.textTertiary },
  segmentLabelSheet: { fontSize: 12, lineHeight: 15 },
  segmentLabelActive: { color: theme.color.accentHighlight },

  options: { gap: 10 },
  optionsSheet: { gap: theme.space.inlineTight },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: theme.radius.control,
    borderWidth: theme.border.standard,
    borderColor: theme.color.borderGhost,
    backgroundColor: theme.color.surfaceInset,
  },
  optionSelected: { borderColor: theme.color.accentPrimary, backgroundColor: theme.color.surfaceCard },
  optionArt: { padding: theme.space.inlineTight, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.backgroundCanvas },
  optionArtSheet: { padding: 6 },
  optionCopy: { flex: 1, minWidth: 0, gap: 2 },
  optionName: { fontFamily: inter.semiBold, fontSize: 15, lineHeight: 18, color: theme.color.textPrimary },
  optionNameSheet: { fontSize: 14, lineHeight: 17 },
  optionNameDimmed: { color: theme.color.textSecondary },
  optionCaption: { fontFamily: inter.regular, fontSize: 12, lineHeight: 15, color: theme.color.textTertiary },
  optionCaptionEquipped: { color: theme.color.accentPrimary },
});
