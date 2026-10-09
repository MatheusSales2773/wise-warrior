import type { UseQueryResult } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseIcon, WiseText, theme, type WiseTextColor } from '@/design-system';
import type { CatalogCosmeticItem, CosmeticCategory } from './api';
import type { CosmeticEquipment } from './use-cosmetic-equipment';
import { cosmeticItemState, describeNextUnlock, describeUnlockCondition, orderCategoryItems, type CosmeticItemState } from './formatters';

const CATEGORIES: { id: CosmeticCategory; label: string }[] = [
  { id: 'avatar', label: 'Avatares' },
  { id: 'badge', label: 'Badges' },
  { id: 'title', label: 'Títulos' },
  { id: 'accessory', label: 'Acessórios' },
];

type StatePresentation = { status: (item: CatalogCosmeticItem) => string; spoken: (item: CatalogCosmeticItem) => string; color: WiseTextColor };

const lockedPresentation: StatePresentation = {
  status: (item) => describeUnlockCondition(item.unlockCondition),
  spoken: (item) => `bloqueado. ${describeUnlockCondition(item.unlockCondition)}`,
  color: 'textTertiary',
};

const STATE_PRESENTATION: Record<CosmeticItemState, StatePresentation> = {
  equipped: { status: () => 'EQUIPADO', spoken: () => 'equipado', color: 'accentPrimary' },
  unlocked: { status: () => 'DESBLOQUEADO', spoken: () => 'desbloqueado', color: 'textSecondary' },
  lockedByLevel: lockedPresentation,
  lockedByRaid: lockedPresentation,
};

function CosmeticTile({ item, onPress, previewing }: { item: CatalogCosmeticItem; onPress: () => void; previewing: boolean }) {
  const locked = !item.unlocked;
  const presentation = STATE_PRESENTATION[cosmeticItemState(item)];
  const premium = item.requiresPremium ? ', item premium' : '';
  const label = `${item.name}${premium}, ${presentation.spoken(item)}`;
  const style = [styles.tile, item.unlocked && styles.tileUnlocked, item.equipped && styles.tileEquipped, previewing && styles.tilePreviewing];
  const content = (
    <>
      {item.requiresPremium ? <WiseText color="accentPrimary" style={styles.premium} variant="label">✦</WiseText> : null}
      {locked ? <View testID="profile-cosmetic-lock"><WiseIcon color="textTertiary" name="lock-closed" size="small" /></View> : null}
      <WiseText color={locked ? 'textTertiary' : 'textPrimary'} style={styles.centered} variant="label">{item.name}</WiseText>
      <WiseText color={presentation.color} style={styles.centered} variant="caption">{presentation.status(item)}</WiseText>
    </>
  );
  // Item bloqueado não abre Prévia nem pode ser equipado: continua só informativo.
  if (locked) {
    return <View accessible accessibilityLabel={label} style={style} testID={`profile-cosmetic-item-${item.id}`}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: previewing }}
      aria-pressed={previewing}
      onPress={onPress}
      style={style}
      testID={`profile-cosmetic-item-${item.id}`}
    >
      {content}
    </Pressable>
  );
}

function CategorySection({ equipment, items, label, level, id }: {
  equipment: CosmeticEquipment;
  items: CatalogCosmeticItem[];
  label: string;
  level: number;
  id: CosmeticCategory;
}) {
  return (
    <View style={styles.stack} testID={`profile-cosmetics-${id}`}>
      <WiseText accessibilityRole="header" aria-level={3} color="accentPrimary" variant="caption">{label}</WiseText>
      {items.some((item) => item.unlocked)
        ? null
        : <WiseText color="textSecondary" testID="profile-cosmetics-next" variant="body">{describeNextUnlock(items, level)}</WiseText>}
      <View style={styles.grid}>
        {orderCategoryItems(items).map((item) => (
          <CosmeticTile item={item} key={item.id} onPress={() => equipment.preview(item)} previewing={item.id === equipment.selectedId} />
        ))}
      </View>
    </View>
  );
}

/** Confirma ou descarta a Prévia do item selecionado; um item equipado só oferece desequipar. */
function PreviewActions({ equipment, item }: { equipment: CosmeticEquipment; item: CatalogCosmeticItem }) {
  return (
    <View style={styles.preview} testID="profile-cosmetics-preview">
      {item.equipped ? (
        <>
          <WiseText variant="label">{`${item.name} está equipado.`}</WiseText>
          <View style={styles.actions}>
            <WiseButton accessibilityLabel={`Desequipar ${item.name}`} label="Desequipar" onPress={() => equipment.unequip(item)} testID="profile-cosmetics-unequip" variant="secondary" />
            <WiseButton accessibilityLabel={`Fechar ${item.name}`} label="Fechar" onPress={equipment.cancel} testID="profile-cosmetics-cancel" variant="ghost" />
          </View>
        </>
      ) : (
        <>
          <WiseText variant="label">{`Prévia: ${item.name}`}</WiseText>
          <WiseText color="textSecondary" variant="body">Veja no painel do personagem. Nada foi salvo ainda.</WiseText>
          <View style={styles.actions}>
            <WiseButton accessibilityLabel={`Equipar ${item.name}`} label="Equipar" onPress={() => equipment.equip(item)} testID="profile-cosmetics-equip" />
            <WiseButton accessibilityLabel={`Cancelar a prévia de ${item.name}`} label="Cancelar" onPress={equipment.cancel} testID="profile-cosmetics-cancel" variant="ghost" />
          </View>
        </>
      )}
    </View>
  );
}

/** Catálogo inteiro por categoria, com Prévia, Equipar e desequipar dos itens desbloqueados. */
export function CosmeticsCatalog({ equipment, level, query }: { equipment: CosmeticEquipment; level: number; query: UseQueryResult<CatalogCosmeticItem[]> }) {
  if (query.isPending && !query.data) {
    return <WiseText color="textSecondary" testID="profile-cosmetics-loading" variant="body">Carregando o Catálogo…</WiseText>;
  }
  const catalog = query.data;
  if (!catalog) {
    return (
      <View style={styles.stack} testID="profile-cosmetics-error">
        <FeedbackMessage message="Não foi possível carregar o Catálogo." title="Catálogo indisponível" variant="error" />
        <WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void query.refetch()} variant="secondary" />
      </View>
    );
  }

  const selected = catalog.find((item) => item.id === equipment.selectedId && item.unlocked);
  return (
    <View style={styles.sections} testID="profile-cosmetics">
      {equipment.notice
        ? <FeedbackMessage message={equipment.notice.message} testID="profile-cosmetics-notice" title={equipment.notice.title} variant="error" />
        : null}
      {selected ? <PreviewActions equipment={equipment} item={selected} /> : null}
      {query.isError
        ? <FeedbackMessage message="Não foi possível atualizar o Catálogo." testID="profile-cosmetics-stale" title="Dados desatualizados" variant="error" />
        : null}
      {CATEGORIES.map((category) => {
        const items = catalog.filter((item) => item.category === category.id);
        return items.length
          ? <CategorySection equipment={equipment} id={category.id} items={items} key={category.id} label={category.label} level={level} />
          : null;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: theme.space.sectionGap },
  stack: { gap: theme.space.stackTight },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.stackTight },
  tile: {
    width: 136,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.inlineTight,
    padding: theme.space.stackTight,
    backgroundColor: theme.color.surfaceInset,
    borderColor: theme.color.borderGhost,
    borderRadius: theme.radius.control,
    borderWidth: theme.border.standard,
  },
  tileUnlocked: { borderColor: theme.color.borderEmphasis },
  tilePreviewing: { borderColor: theme.color.accentPrimary, borderStyle: 'dashed' },
  tileEquipped: { borderColor: theme.color.accentPrimary, borderWidth: theme.border.focus },
  preview: {
    gap: theme.space.inlineTight,
    padding: theme.space.controlInset,
    backgroundColor: theme.color.surfaceInset,
    borderLeftWidth: theme.border.focus,
    borderLeftColor: theme.color.accentPrimary,
    borderRadius: theme.radius.detail,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.inlineTight },
  premium: { position: 'absolute', top: theme.space.inlineHairline, right: theme.space.inlineTight },
  centered: { textAlign: 'center' },
});
