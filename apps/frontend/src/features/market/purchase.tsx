import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseDialog, WiseIcon, theme } from '@/design-system';
import { cosmeticSprite, equipmentCategoryById } from '@/features/character/catalog';
import { PixelSprite } from '@/features/character/PixelSprite';
import { itemSprites } from '@/features/character/sprites';
import { dashboardKeys } from '@/features/dashboard/queries';
import { equipCosmeticItem } from '@/features/profile/api';
import { profileKeys } from '@/features/profile/queries';
import { purchaseShopItem, purchaseShopMission, type ShopItem, type ShopPurchase, type StoreMission } from './api';
import { coinsLabel, formatCoins, missingHint, purchaseFailure } from './formatters';
import { marketKeys } from './queries';

export type PurchaseTarget = { kind: 'mission'; mission: StoreMission } | { kind: 'item'; item: ShopItem };

function targetOf(target: PurchaseTarget): { id: string; name: string; price: number } {
  return target.kind === 'mission' ? target.mission : target.item;
}

/**
 * Compra com confirmação. O servidor é a fonte do saldo: a resposta da Compra atualiza a bolsa na hora e a Loja,
 * o Extrato e o Inventário são recarregados. Uma recusa (409, 422, 404) também recarrega a Loja, que traz o estado novo.
 */
export function usePurchase() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<PurchaseTarget | null>(null);

  const purchase = useMutation({
    mutationFn: (next: PurchaseTarget): Promise<ShopPurchase> => (next.kind === 'mission' ? purchaseShopMission(next.mission.id) : purchaseShopItem(next.item.id)),
    onSuccess: (result, next) => {
      queryClient.setQueryData(marketKeys.balance(), result.balance);
      if (next.kind === 'item') void queryClient.invalidateQueries({ queryKey: profileKeys.cosmeticsCatalog() });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: marketKeys.all }),
  });

  const equip = useMutation({
    mutationFn: (itemId: string) => equipCosmeticItem(itemId),
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.profile() }),
      queryClient.invalidateQueries({ queryKey: profileKeys.cosmeticsCatalog() }),
    ]),
  });

  const open = useCallback((next: PurchaseTarget) => {
    purchase.reset();
    equip.reset();
    setTarget(next);
  }, [equip, purchase]);

  const close = useCallback(() => {
    if (purchase.isPending) return;
    setTarget(null);
  }, [purchase.isPending]);

  return {
    target,
    open,
    close,
    confirm: () => { if (target && !purchase.isPending) purchase.mutate(target); },
    pending: purchase.isPending,
    result: purchase.data ?? null,
    failure: purchase.isError && target ? purchaseFailure(purchase.error, targetOf(target).name) : null,
    equip: () => { if (target?.kind === 'item') equip.mutate(target.item.id); },
    equipping: equip.isPending,
    equipped: equip.isSuccess,
    equipFailed: equip.isError,
  };
}

export type Purchase = ReturnType<typeof usePurchase>;

export function LedgerLines({ balance, price }: { balance: number; price: number }) {
  return <View style={styles.ledger} testID="purchase-ledger">
    <View style={styles.line}><Text style={styles.lineLabel}>Na bolsa</Text><Text style={styles.lineValue}>{formatCoins(balance)}</Text></View>
    <View style={styles.line}><Text style={styles.lineLabel}>Preço</Text><Text style={styles.lineValue}>−{formatCoins(price)}</Text></View>
    <View style={[styles.line, styles.total]}>
      <Text style={[styles.lineLabel, styles.totalLabel]}>Depois da compra</Text>
      <Text style={[styles.lineValue, styles.totalValue]} testID="purchase-balance-after">{formatCoins(balance - price)}</Text>
    </View>
  </View>;
}

function TargetArt({ target }: { target: PurchaseTarget }) {
  const sprite = target.kind === 'item' ? cosmeticSprite(target.item) : cosmeticSprite(target.mission.reward);
  return <View style={styles.art}><PixelSprite scale={8} sprite={itemSprites[sprite]} /></View>;
}

function subtitle(target: PurchaseTarget): string {
  if (target.kind === 'mission') return `Missão · ao derrotar, ${target.mission.reward.name} para cada Participante`;
  const category = equipmentCategoryById[target.item.category];
  return `${category.label} · ${category.description.charAt(0).toLowerCase()}${category.description.slice(1)}`;
}

/** Centered dialog on desktop, bottom sheet on phones; both carry the same confirmation and outcome. */
export function PurchaseDialog({ balance, desktop, purchase }: { balance: number; desktop: boolean; purchase: Purchase }) {
  const { target, close } = purchase;

  useEffect(() => {
    if (!target || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, target]);

  if (!target) return null;
  const { name, price } = targetOf(target);
  const done = purchase.result !== null;
  // Phones open the sheet from any tile, so it also explains a price the balance does not cover yet.
  const short = done ? 0 : price - balance;

  const body = done
    ? <>
      <View style={styles.head}>
        <View style={styles.doneMark}><WiseIcon color="feedbackSuccess" name="checkmark" size="regular" /></View>
        <Text accessibilityRole="header" aria-level={2} style={styles.title} testID="purchase-done-title">{name} é {target.kind === 'mission' ? 'sua' : 'seu'}</Text>
      </View>
      <View style={styles.row}>
        <TargetArt target={target} />
        <Text style={styles.copy}>
          {target.kind === 'mission'
            ? 'A Missão fica com você para sempre. O Líder da sua Guilda pode escolhê-la para a próxima Raid.'
            : 'O item já está no seu Inventário.'}
          {` Restam ${coinsLabel(purchase.result!.balance)} na bolsa.`}
        </Text>
      </View>
      {purchase.equipFailed ? <FeedbackMessage message={`Não foi possível equipar ${name}. Ele continua no seu Inventário.`} variant="error" /> : null}
      <View style={[styles.actions, !desktop && styles.actionsStacked]}>
        <WiseButton label={target.kind === 'item' ? 'Continuar comprando' : 'Fechar'} onPress={close} testID="purchase-close" variant="secondary" />
        {target.kind === 'item'
          ? purchase.equipped
            ? <WiseButton label="Equipado" disabled testID="purchase-equipped" />
            : <WiseButton label="Equipar agora" loading={purchase.equipping} onPress={purchase.equip} testID="purchase-equip" />
          : null}
      </View>
    </>
    : <>
      <Text accessibilityRole="header" aria-level={2} style={styles.title}>Comprar {name}?</Text>
      <View style={styles.row}>
        <TargetArt target={target} />
        <View style={styles.rowCopy}>
          <Text style={styles.copy}>{subtitle(target)}</Text>
          <Text style={styles.note}>Moedas gastas não voltam para a bolsa.</Text>
        </View>
      </View>
      {short > 0
        ? <View style={styles.short} testID="purchase-short">
          <Text style={styles.shortTitle}>Faltam {coinsLabel(short)}</Text>
          <Text style={styles.note}>{missingHint(short)}</Text>
        </View>
        : <LedgerLines balance={balance} price={price} />}
      {purchase.failure ? <FeedbackMessage message={purchase.failure.message} testID="purchase-failure" title={purchase.failure.title} variant="error" /> : null}
      <View style={[styles.actions, !desktop && styles.actionsStacked]}>
        <WiseButton label="Cancelar" disabled={purchase.pending} onPress={close} testID="purchase-cancel" variant="secondary" />
        <WiseButton
          disabled={purchase.failure !== null || short > 0}
          label={`Comprar por ${formatCoins(price)}`}
          loading={purchase.pending}
          onPress={purchase.confirm}
          testID="purchase-confirm"
        />
      </View>
    </>;

  return <WiseDialog accessibilityLabel={done ? `Compra concluída: ${name}` : `Confirmar compra de ${name}`} desktop={desktop} onClose={close} testID="purchase-dialog">
    {body}
  </WiseDialog>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneMark: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: theme.color.surfaceInset },
  title: { flexShrink: 1, fontFamily: 'Cinzel-SemiBold', fontSize: 22, lineHeight: 28, color: theme.color.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rowCopy: { flex: 1, gap: 6 },
  art: {
    width: 84, height: 84, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset,
  },
  copy: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 21, color: theme.color.textSecondary },
  note: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: theme.color.textTertiary },
  ledger: { gap: 0 },
  short: { gap: 4, padding: 14, borderRadius: theme.radius.control, backgroundColor: theme.color.surfaceInset },
  shortTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 20, color: theme.color.textPrimary },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  lineLabel: { fontFamily: 'Inter-Medium', fontSize: 13, lineHeight: 18, color: theme.color.textSecondary },
  lineValue: { fontFamily: 'JetBrainsMono-SemiBold', fontSize: 14, lineHeight: 18, color: theme.color.textPrimary, fontVariant: ['tabular-nums'] },
  total: { marginTop: 4, paddingTop: 10, borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderSubtle },
  totalLabel: { fontFamily: 'Inter-SemiBold', color: theme.color.textPrimary },
  totalValue: { color: theme.color.accentHighlight },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' },
  actionsStacked: { flexDirection: 'column-reverse', alignItems: 'stretch', flexWrap: 'nowrap' },
});
