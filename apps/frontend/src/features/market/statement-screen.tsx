import { useInfiniteQuery, useQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, WiseIcon, WiseText, isDesktopLayout, theme, type WiseIconName } from '@/design-system';
import { useFocusRing } from '@/features/character/character-parts';
import type { CoinOriginType, CoinStatementItem, CoinStatementPage } from './api';
import { CoinMark } from './coin';
import {
  COINS_PER_FULL_FOCUS, RAID_WIN_COINS, coinsLabel, formatCoins, formatSignedCoins, groupStatement, purchaseNames,
  statementDetail, statementEntryLabel, statementTitle,
} from './formatters';
import { coinBalanceQueryOptions, coinStatementQueryOptions, shopItemsQueryOptions, shopMissionsQueryOptions } from './queries';

/* Extrato: cada Moeda que entrou e saiu da bolsa, com a origem e o saldo depois de cada lançamento (ADR-012). */

const DESKTOP_GUTTER = 48;
const MOBILE_GUTTER = 16;
const WELCOME_COINS = 90;

const ORIGIN_ICON: Record<CoinOriginType, WiseIconName> = {
  'study-session': 'hammer-outline',
  'raid-win': 'shield-outline',
  purchase: 'bag-handle-outline',
  signup: 'sparkles',
  migration: 'swap-horizontal-outline',
  objective: 'checkmark-circle',
};

export function StatementScreen() {
  const { width } = useWindowDimensions();
  const desktop = isDesktopLayout(Platform.OS, width);
  const balance = useQuery(coinBalanceQueryOptions());
  const statement = useInfiniteQuery(coinStatementQueryOptions());
  // Names the Compras from the Loja lists, which the Mercado usually already has in cache.
  const names = purchaseNames(useQuery(shopMissionsQueryOptions()).data, useQuery(shopItemsQueryOptions()).data);

  const header = <View style={styles.heading}>
    <BackLink />
    <Text accessibilityRole="header" aria-level={1} style={[styles.title, !desktop && styles.titleCompact]}>Extrato</Text>
    {desktop ? <Text style={styles.lede}>Cada Moeda que entrou e saiu da sua bolsa, com a origem.</Text> : null}
  </View>;

  const purse = <View accessibilityLabel={balance.data === undefined ? 'Carregando o saldo' : `${coinsLabel(balance.data)} na bolsa`} accessible role="status" style={[styles.purse, !desktop && styles.purseCompact]} testID="statement-purse">
    <Text style={styles.purseLabel}>Moedas na bolsa</Text>
    <View style={styles.purseRow}>
      <CoinMark scale={desktop ? 6 : 5} />
      <Text style={[styles.purseFigure, !desktop && styles.purseFigureCompact]} testID="statement-balance">{balance.data === undefined ? '…' : formatCoins(balance.data)}</Text>
    </View>
    {desktop ? <Text style={styles.purseNote}>Só suas: não vão para a Guilda e não podem ser transferidas.</Text> : null}
  </View>;

  const ledger = <Ledger desktop={desktop} names={names} statement={statement} />;

  return <View style={styles.root} testID="statement">
    <ScrollView contentContainerStyle={desktop ? styles.desktopContent : styles.mobileContent}>
      {header}
      {desktop
        ? <View style={styles.columns}>
          <View style={styles.aside}>{purse}<HowToEarn /></View>
          <View style={styles.main}>{ledger}</View>
        </View>
        : <View style={styles.stack}>{purse}{ledger}</View>}
    </ScrollView>
  </View>;
}

function BackLink() {
  const { focusProps, focusStyle } = useFocusRing();
  return <Link asChild href="/mercado">
    <Pressable {...focusProps} accessibilityLabel="Voltar para o Mercado" accessibilityRole="link" hitSlop={12} style={StyleSheet.flatten([styles.back, focusStyle])} testID="statement-back">
      <WiseIcon color="accentPrimary" name="chevron-back" size="xsmall" />
      <Text style={styles.backText}>Mercado</Text>
    </Pressable>
  </Link>;
}

function HowToEarn() {
  const router = useRouter();
  const rows: [WiseIconName, string, number][] = [
    ['hammer-outline', 'Foco completo de 25 min (1 Moeda a cada 2 min)', COINS_PER_FULL_FOCUS],
    ['shield-outline', 'Raid vencida com a sua Contribuição', RAID_WIN_COINS],
    ['sparkles', 'Boas-vindas, uma única vez', WELCOME_COINS],
  ];
  return <View style={styles.earn} testID="statement-how-to-earn">
    <Text accessibilityRole="header" aria-level={2} style={styles.earnTitle}>Como ganhar</Text>
    {rows.map(([icon, label, amount]) => <View key={label} style={styles.earnRow}>
      <WiseIcon color="accentPrimary" name={icon} size="regular" />
      <Text style={styles.earnLabel}>{label}</Text>
      <Text style={styles.earnAmount}>+{amount}</Text>
    </View>)}
    <WiseButton label="Ir para a Forja" onPress={() => router.push('/sessao')} testID="statement-forge" variant="secondary" />
  </View>;
}

type StatementQuery = UseInfiniteQueryResult<InfiniteData<CoinStatementPage>>;

function Ledger({ desktop, names, statement }: { desktop: boolean; names: ReadonlyMap<string, string>; statement: StatementQuery }) {
  if (statement.isPending) {
    return <View accessibilityLabel="Carregando o Extrato" accessibilityState={{ busy: true }} style={styles.status} testID="statement-loading">
      <WiseText color="textSecondary" variant="body">Carregando o Extrato…</WiseText>
      <ProgressBar accessibilityLabel="Carregando o Extrato" indeterminate />
    </View>;
  }
  if (statement.isError && statement.data === undefined) {
    return <View style={styles.status} testID="statement-error">
      <FeedbackMessage message="Não foi possível carregar o Extrato." title="Extrato indisponível" variant="error" />
      <View style={styles.statusAction}><WiseButton label="Tentar novamente" loading={statement.isRefetching} onPress={() => void statement.refetch()} variant="secondary" /></View>
    </View>;
  }
  const entries = statement.data?.pages.flatMap((page) => page.items) ?? [];
  if (entries.length === 0) {
    return <View style={styles.status} testID="statement-empty">
      <WiseText color="textSecondary" variant="body">Nenhuma movimentação ainda. Conclua uma Study Session na Forja para ganhar as primeiras Moedas.</WiseText>
    </View>;
  }

  return <View testID="statement-ledger">
    {desktop
      ? <View accessibilityElementsHidden aria-hidden importantForAccessibility="no-hide-descendants" style={styles.columnsHead}>
        <Text style={[styles.headCell, styles.headOrigin]}>Origem</Text>
        <Text style={[styles.headCell, styles.headAmount]}>Moedas</Text>
        <Text style={[styles.headCell, styles.headAmount]}>Saldo</Text>
      </View>
      : null}
    {groupStatement(entries).map((group) => <View key={group.key} role="list" accessibilityLabel={group.label} style={styles.group}>
      <View style={styles.dayRow}>
        <Text accessibilityRole="header" aria-level={2} style={styles.day}>{group.label}</Text>
        <Text style={styles.dayDate}>{group.date}</Text>
      </View>
      {group.entries.map((entry, index) => <Entry desktop={desktop} entry={entry} key={entry.id} names={names} striped={index % 2 === 1} />)}
    </View>)}
    {statement.isError ? <FeedbackMessage message="Não foi possível carregar mais lançamentos." testID="statement-more-error" variant="error" /> : null}
    {statement.hasNextPage
      ? <View style={styles.more}>
        <WiseButton label="Carregar mais" loading={statement.isFetchingNextPage} onPress={() => void statement.fetchNextPage()} testID="statement-more" variant="secondary" />
      </View>
      : null}
  </View>;
}

function Entry({ desktop, entry, names, striped }: { desktop: boolean; entry: CoinStatementItem; names: ReadonlyMap<string, string>; striped: boolean }) {
  const spend = entry.amount < 0;
  return <View
    accessibilityLabel={statementEntryLabel(entry, names)}
    accessible
    role="listitem"
    style={[styles.entry, striped && styles.entryStriped, !desktop && styles.entryCompact]}
    testID={`statement-entry-${entry.id}`}
  >
    <View style={[styles.entryIcon, !desktop && styles.entryIconCompact]}>
      <WiseIcon color={spend ? 'textSecondary' : 'accentPrimary'} name={ORIGIN_ICON[entry.origin.type]} size={desktop ? 'regular' : 'compact'} />
    </View>
    <View style={styles.entryCopy}>
      <Text numberOfLines={2} style={[styles.entryTitle, !desktop && styles.entryTitleCompact]}>{statementTitle(entry, names)}</Text>
      <Text style={styles.entryDetail}>
        {statementDetail(entry)}{desktop ? '' : ` · saldo ${formatCoins(entry.balanceAfter)}`}
      </Text>
    </View>
    <Text style={[styles.entryAmount, spend && styles.entryAmountSpend, !desktop && styles.entryAmountCompact]} testID={`statement-amount-${entry.id}`}>{formatSignedCoins(entry.amount)}</Text>
    {desktop ? <Text style={styles.entryAfter}>{formatCoins(entry.balanceAfter)}</Text> : null}
  </View>;
}

const mono = 'JetBrainsMono-SemiBold';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.backgroundCanvas },
  desktopContent: { paddingHorizontal: DESKTOP_GUTTER, paddingTop: 40, paddingBottom: 48, maxWidth: 1144 + DESKTOP_GUTTER * 2 },
  mobileContent: { paddingHorizontal: MOBILE_GUTTER, paddingTop: 16, paddingBottom: 24 },

  heading: { gap: 8 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 24 },
  backText: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.accentPrimary },
  title: { fontFamily: 'Cinzel-SemiBold', fontSize: 32, lineHeight: 40, letterSpacing: 1, color: theme.color.textPrimary },
  titleCompact: { fontSize: 24, lineHeight: 32 },
  lede: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22, color: theme.color.textSecondary },

  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 40, marginTop: 32 },
  aside: { width: 340, gap: 0 },
  main: { flex: 1, minWidth: 0 },
  stack: { gap: 12, marginTop: 14 },

  purse: {
    gap: 6, padding: 28, paddingBottom: 0,
    borderTopLeftRadius: theme.radius.panel, borderTopRightRadius: theme.radius.panel,
    borderWidth: theme.border.standard, borderBottomWidth: 0, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard,
  },
  purseCompact: { padding: 18, paddingBottom: 18, borderRadius: theme.radius.panel, borderBottomWidth: theme.border.standard },
  purseLabel: { fontFamily: 'Inter-Medium', fontSize: 13, lineHeight: 18, color: theme.color.textSecondary },
  purseRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 4 },
  purseFigure: { fontFamily: mono, fontSize: 64, lineHeight: 70, color: theme.color.accentHighlight, fontVariant: ['tabular-nums'] },
  purseFigureCompact: { fontSize: 44, lineHeight: 50 },
  purseNote: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: theme.color.textTertiary },

  earn: {
    gap: 14, padding: 28, paddingTop: 22,
    borderBottomLeftRadius: theme.radius.panel, borderBottomRightRadius: theme.radius.panel,
    borderWidth: theme.border.standard, borderTopWidth: 0, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard,
  },
  earnTitle: { paddingTop: 20, borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderSubtle, fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 20, color: theme.color.textPrimary },
  earnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  earnLabel: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: theme.color.textSecondary },
  earnAmount: { fontFamily: mono, fontSize: 13, lineHeight: 18, color: theme.color.textPrimary },

  status: { gap: theme.space.stackDefault, paddingVertical: 8 },
  statusAction: { alignSelf: 'flex-start' },

  columnsHead: { flexDirection: 'row', gap: 14, paddingLeft: 68, paddingRight: 14, paddingBottom: 10, marginBottom: 6, borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderSubtle },
  headCell: { fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 16, color: theme.color.textTertiary },
  headOrigin: { flex: 1 },
  headAmount: { width: 96, textAlign: 'right' },
  group: { paddingTop: 12 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 8 },
  day: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 18, color: theme.color.textSecondary },
  dayDate: { fontFamily: 'JetBrainsMono-Medium', fontSize: 12, lineHeight: 16, color: theme.color.textTertiary },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 8, paddingHorizontal: 14, borderRadius: theme.radius.control },
  entryCompact: { gap: 10, paddingHorizontal: 6, minHeight: 56 },
  entryStriped: { backgroundColor: theme.color.backgroundRaised },
  entryIcon: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: theme.radius.control, backgroundColor: theme.color.surfaceInset,
  },
  entryIconCompact: { width: 36, height: 36 },
  entryCopy: { flex: 1, minWidth: 0, gap: 2 },
  entryTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 19, color: theme.color.textPrimary },
  entryTitleCompact: { fontSize: 13, lineHeight: 18 },
  entryDetail: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 17, color: theme.color.textSecondary },
  entryAmount: { width: 96, textAlign: 'right', fontFamily: mono, fontSize: 16, lineHeight: 20, color: theme.color.feedbackSuccess, fontVariant: ['tabular-nums'] },
  entryAmountSpend: { color: theme.color.textPrimary },
  entryAmountCompact: { width: 'auto', fontSize: 15 },
  entryAfter: { width: 96, textAlign: 'right', fontFamily: 'JetBrainsMono-Medium', fontSize: 13, lineHeight: 18, color: theme.color.textTertiary, fontVariant: ['tabular-nums'] },
  more: { alignItems: 'flex-start', marginTop: 16 },
});
