import type { UseQueryResult } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseIcon, WiseText, theme, type WiseTextColor } from '@/design-system';
import type { CatalogCosmeticItem, CosmeticCategory } from './api';
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

function CosmeticTile({ item }: { item: CatalogCosmeticItem }) {
  const locked = !item.unlocked;
  const presentation = STATE_PRESENTATION[cosmeticItemState(item)];
  const premium = item.requiresPremium ? ', item premium' : '';
  return (
    <View
      accessible
      accessibilityLabel={`${item.name}${premium}, ${presentation.spoken(item)}`}
      style={[styles.tile, item.unlocked && styles.tileUnlocked, item.equipped && styles.tileEquipped]}
      testID={`profile-cosmetic-item-${item.id}`}
    >
      {item.requiresPremium ? <WiseText color="accentPrimary" style={styles.premium} variant="label">✦</WiseText> : null}
      {locked ? <View testID="profile-cosmetic-lock"><WiseIcon color="textTertiary" name="lock-closed" size="small" /></View> : null}
      <WiseText color={locked ? 'textTertiary' : 'textPrimary'} style={styles.centered} variant="label">{item.name}</WiseText>
      <WiseText color={presentation.color} style={styles.centered} variant="caption">{presentation.status(item)}</WiseText>
    </View>
  );
}

function CategorySection({ items, label, level, id }: { items: CatalogCosmeticItem[]; label: string; level: number; id: CosmeticCategory }) {
  return (
    <View style={styles.stack} testID={`profile-cosmetics-${id}`}>
      <WiseText accessibilityRole="header" aria-level={3} color="accentPrimary" variant="caption">{label}</WiseText>
      {items.some((item) => item.unlocked)
        ? null
        : <WiseText color="textSecondary" testID="profile-cosmetics-next" variant="body">{describeNextUnlock(items, level)}</WiseText>}
      <View style={styles.grid}>
        {orderCategoryItems(items).map((item) => <CosmeticTile item={item} key={item.id} />)}
      </View>
    </View>
  );
}

/** Catálogo inteiro por categoria, só para leitura. Equipar chega com a Prévia (#108). */
export function CosmeticsCatalog({ level, query }: { level: number; query: UseQueryResult<CatalogCosmeticItem[]> }) {
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

  return (
    <View style={styles.sections} testID="profile-cosmetics">
      {query.isError
        ? <FeedbackMessage message="Não foi possível atualizar o Catálogo." testID="profile-cosmetics-stale" title="Dados desatualizados" variant="error" />
        : null}
      {CATEGORIES.map((category) => {
        const items = catalog.filter((item) => item.category === category.id);
        return items.length
          ? <CategorySection id={category.id} items={items} key={category.id} label={category.label} level={level} />
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
  tileEquipped: { borderColor: theme.color.accentPrimary, borderWidth: theme.border.focus },
  premium: { position: 'absolute', top: theme.space.inlineHairline, right: theme.space.inlineTight },
  centered: { textAlign: 'center' },
});
