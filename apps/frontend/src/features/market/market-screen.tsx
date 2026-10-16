import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, WiseIcon, WiseText, isDesktopLayout, theme } from '@/design-system';
import { DEFAULT_HERO_ID, cosmeticSprite, equipmentCategoryById } from '@/features/character/catalog';
import { useFocusRing } from '@/features/character/character-parts';
import { PixelSprite } from '@/features/character/PixelSprite';
import { heroSprites, itemSprites } from '@/features/character/sprites';
import { RaidScene } from '@/features/guild/raid-scene';
import type { CosmeticCategory } from '@/features/profile/api';
import type { ShopItem, StoreMission } from './api';
import { CoinAmount, CoinMark } from './coin';
import { RAID_WIN_COINS, coinsLabel, formatCoins, missingHint, orderShopItems, presentCategories } from './formatters';
import { LedgerLines, PurchaseDialog, usePurchase, type Purchase } from './purchase';
import { coinBalanceQueryOptions, shopItemsQueryOptions, shopMissionsQueryOptions } from './queries';

/* Mercado: a bolsa de Moedas e a Loja, com as seções Missões e Itens (ADR-012). */

type Section = 'missoes' | 'itens';

const DESKTOP_GUTTER = 48;
const MOBILE_GUTTER = 16;
const CONTENT_MAX = 1144;
const SCENE_COLUMN = 300;
const SIDE_COLUMN = 236;

export function MarketScreen() {
  const { width } = useWindowDimensions();
  const desktop = isDesktopLayout(Platform.OS, width);
  const router = useRouter();
  const params = useLocalSearchParams<{ secao?: string }>();
  const section: Section = params.secao === 'itens' ? 'itens' : 'missoes';
  const balance = useQuery(coinBalanceQueryOptions());
  const missions = useQuery(shopMissionsQueryOptions());
  const items = useQuery(shopItemsQueryOptions());
  const purchase = usePurchase();

  const content = <>
    <Header balance={balance.data} balanceFailed={balance.isError && balance.data === undefined} desktop={desktop} />
    <Tabs
      counts={{ missoes: missions.data?.length, itens: items.data?.length }}
      onChange={(next) => router.setParams({ secao: next })}
      section={section}
    />
    {section === 'missoes'
      ? <MissionsSection desktop={desktop} purchase={purchase} query={missions} width={width} />
      : <ItemsSection desktop={desktop} purchase={purchase} query={items} />}
  </>;

  return <View style={styles.root} testID="market">
    <ScrollView contentContainerStyle={desktop ? styles.desktopContent : styles.mobileContent} testID={desktop ? 'market-layout-desktop' : 'market-layout-mobile'}>
      <View style={styles.column}>{content}</View>
    </ScrollView>
    <PurchaseDialog balance={balance.data ?? 0} desktop={desktop} purchase={purchase} />
  </View>;
}

function Header({ balance, balanceFailed, desktop }: { balance: number | undefined; balanceFailed: boolean; desktop: boolean }) {
  const figure = balance === undefined ? (balanceFailed ? '?' : '…') : formatCoins(balance);
  const label = balance === undefined ? (balanceFailed ? 'Saldo indisponível' : 'Carregando o saldo') : `${coinsLabel(balance)} na bolsa`;
  if (!desktop) {
    return <View style={styles.headerCompact}>
      <Text accessibilityRole="header" aria-level={1} style={styles.titleCompact}>Mercado</Text>
      <PurseChip figure={figure} label={label} />
    </View>;
  }
  return <View style={styles.header}>
    <View style={styles.headerCopy}>
      <Text accessibilityRole="header" aria-level={1} style={styles.title}>Mercado</Text>
      <Text style={styles.lede}>Troque as Moedas do seu foco por Missões para a sua Guilda e por itens para o seu herói.</Text>
    </View>
    <View style={styles.purse}>
      <View accessibilityLabel={label} accessible role="status" style={styles.purseFigures} testID="market-purse">
        <CoinMark scale={4} />
        <View>
          <Text style={styles.purseFigure} testID="market-balance">{figure}</Text>
          <Text style={styles.purseLabel}>Moedas na bolsa</Text>
        </View>
      </View>
      <View style={styles.purseRule} />
      <StatementLink />
    </View>
  </View>;
}

function StatementLink() {
  const { focusProps, focusStyle } = useFocusRing();
  return <Link asChild href="/mercado/extrato">
    <Pressable {...focusProps} accessibilityRole="link" hitSlop={8} style={StyleSheet.flatten([styles.statementLink, focusStyle])} testID="market-statement-link">
      <Text style={styles.linkText}>Ver extrato</Text>
      <WiseIcon color="accentPrimary" name="arrow-forward" size="xsmall" />
    </Pressable>
  </Link>;
}

function PurseChip({ figure, label }: { figure: string; label: string }) {
  const { focusProps, focusStyle } = useFocusRing();
  return <Link asChild href="/mercado/extrato">
    <Pressable {...focusProps} accessibilityHint="Abre o Extrato" accessibilityLabel={label} accessibilityRole="link" style={StyleSheet.flatten([styles.chip, focusStyle])} testID="market-purse">
      <CoinMark scale={2} />
      <Text style={styles.chipFigure} testID="market-balance">{figure}</Text>
    </Pressable>
  </Link>;
}

function Tabs({ counts, onChange, section }: { counts: Record<Section, number | undefined>; onChange: (section: Section) => void; section: Section }) {
  return <View accessibilityRole="tablist" style={styles.tabs}>
    {(['missoes', 'itens'] as const).map((id) => <Tab active={section === id} count={counts[id]} id={id} key={id} onPress={() => onChange(id)} />)}
  </View>;
}

function Tab({ active, count, id, onPress }: { active: boolean; count: number | undefined; id: Section; onPress: () => void }) {
  const { focusProps, focusStyle } = useFocusRing();
  const label = id === 'missoes' ? 'Missões' : 'Itens';
  return <Pressable
    {...focusProps}
    accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={({ hovered, pressed }) => StyleSheet.flatten([styles.tab, (hovered || pressed) && !active && styles.tabInteracting, focusStyle])}
    testID={`market-tab-${id}`}
  >
    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    {count === undefined ? null : <Text style={styles.tabCount}>{count}</Text>}
    {active ? <View style={styles.tabBar} /> : null}
  </Pressable>;
}

type ListQuery<T> = { data: T[] | undefined; isPending: boolean; isError: boolean; isRefetching: boolean; refetch: () => unknown };

function ListStatus<T>({ empty, noun, query, testID }: { empty: ReactNode; noun: string; query: ListQuery<T>; testID: string }) {
  if (query.isPending) {
    return <View accessibilityLabel={`Carregando ${noun}`} accessibilityState={{ busy: true }} style={styles.status} testID={`${testID}-loading`}>
      <WiseText color="textSecondary" variant="body">Carregando {noun}…</WiseText>
      <ProgressBar accessibilityLabel={`Carregando ${noun}`} indeterminate />
    </View>;
  }
  if (query.isError && query.data === undefined) {
    return <View style={styles.status} testID={`${testID}-error`}>
      <FeedbackMessage message={`Não foi possível carregar ${noun}.`} title="Mercado indisponível" variant="error" />
      <View style={styles.statusAction}><WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void query.refetch()} variant="secondary" /></View>
    </View>;
  }
  if (query.data?.length === 0) return <View style={styles.status} testID={`${testID}-empty`}>{empty}</View>;
  return null;
}

/* ---------- Missões ---------- */

function MissionsSection({ desktop, purchase, query, width }: { desktop: boolean; purchase: Purchase; query: ListQuery<StoreMission>; width: number }) {
  const status = <ListStatus
    empty={<WiseText color="textSecondary" variant="body">Nenhuma Missão à venda agora. As Missões do rodízio continuam valendo para a sua Guilda.</WiseText>}
    noun="as Missões"
    query={query}
    testID="market-missions"
  />;
  const contentWidth = desktop ? Math.min(CONTENT_MAX, width - theme.layout.sidebarWidth - DESKTOP_GUTTER * 2) : width - MOBILE_GUTTER * 2;
  return <View style={styles.section} testID="market-missions">
    <View style={styles.note}>
      <WiseIcon color="textTertiary" name="shield-outline" size="xsmall" />
      <Text style={styles.noteText}>As Missões do rodízio são gratuitas e já são de todos. Aqui ficam as que você compra e o Líder da sua Guilda pode escolher.</Text>
    </View>
    {status ?? null}
    {query.data && query.data.length > 0
      ? <View style={styles.contracts}>{query.data.map((mission) => <MissionContract contentWidth={contentWidth} desktop={desktop} key={mission.id} mission={mission} onBuy={() => purchase.open({ kind: 'mission', mission })} />)}</View>
      : null}
  </View>;
}

function MissionArt({ mission, viewportWidth }: { mission: StoreMission; viewportWidth: number }) {
  if (mission.imageUrl) {
    return <Image accessibilityIgnoresInvertColors resizeMode="cover" source={{ uri: mission.imageUrl }} style={[styles.missionImage, { width: viewportWidth }]} />;
  }
  // Until each Mission has its own art (#145), every contract shows the Raid scene.
  return <RaidScene party={[]} scale={2} showTags={false} viewportWidth={viewportWidth} />;
}

function MissionContract({ contentWidth, desktop, mission, onBuy }: { contentWidth: number; desktop: boolean; mission: StoreMission; onBuy: () => void }) {
  const owned = mission.state === 'owned';
  const reward = <View style={styles.loot}>
    <Text style={styles.lootKey}>Ao derrotar</Text>
    <View style={styles.lootItem}>
      <View style={styles.lootTile}><PixelSprite scale={3} sprite={itemSprites[cosmeticSprite(mission.reward)]} /></View>
      <Text style={styles.lootName}>{mission.reward.name}</Text>
    </View>
    <View accessibilityLabel={`mais ${RAID_WIN_COINS} Moedas`} accessible style={styles.lootCoins}>
      <CoinMark scale={2} />
      <Text style={styles.lootCoinsText}>+{RAID_WIN_COINS}</Text>
    </View>
  </View>;
  const side = <View style={desktop ? styles.contractSide : styles.contractFoot}>
    <CoinAmount dim={owned} scale={3} size={desktop ? 24 : 20} testID={`market-mission-price-${mission.id}`} value={mission.price} />
    <PurchaseState kind="Missão" onBuy={onBuy} price={mission.price} state={mission.state} missing={mission.missing} compact={!desktop} testID={`market-mission-${mission.id}`} />
  </View>;

  return <View
    accessibilityLabel={`${mission.name}. ${coinsLabel(mission.price)}. ${stateLabel(mission.state, mission.missing)}`}
    role="article"
    style={[styles.contract, desktop && styles.contractDesktop, owned && styles.contractOwned]}
    testID={`market-mission-${mission.id}`}
  >
    <View style={desktop ? styles.contractScene : styles.contractSceneCompact}>
      <MissionArt mission={mission} viewportWidth={desktop ? SCENE_COLUMN - 24 : contentWidth - 2} />
    </View>
    <View style={[styles.contractBody, !desktop && styles.contractBodyCompact]}>
      <Text accessibilityRole="header" aria-level={2} style={[styles.contractTitle, !desktop && styles.contractTitleCompact]}>{mission.name}</Text>
      <Text style={[styles.contractCopy, !desktop && styles.contractCopyCompact]}>{mission.description}</Text>
      {reward}
      {desktop ? null : side}
    </View>
    {desktop ? side : null}
  </View>;
}

function stateLabel(state: ShopItem['state'], missing: number): string {
  if (state === 'owned') return 'Já é sua.';
  if (state === 'insufficient') return `Faltam ${coinsLabel(missing)}.`;
  return 'Disponível para comprar.';
}

/** Buy button, "Faltam N" progress or the owned mark, shared by Missions and the item preview. */
function PurchaseState({ compact, kind, missing, onBuy, price, state, testID }: {
  compact: boolean; kind: 'Missão' | 'Item'; missing: number; onBuy: () => void; price: number; state: ShopItem['state']; testID: string;
}) {
  if (state === 'owned') {
    return <View style={styles.ownedBlock} testID={`${testID}-owned`}>
      <View style={styles.ownedRow}><WiseIcon color="feedbackSuccess" name="checkmark" size="small" /><Text style={styles.ownedText}>{kind === 'Missão' ? 'Na sua coleção' : 'No seu Inventário'}</Text></View>
      {compact ? null : <Text style={styles.hint}>{kind === 'Missão' ? 'O Líder pode escolhê-la para a próxima Raid.' : 'Equipe na tela do Personagem.'}</Text>}
    </View>;
  }
  if (state === 'insufficient') {
    const have = Math.max(0, price - missing);
    return <View style={[styles.needBlock, compact && styles.needBlockCompact]} testID={`${testID}-missing`}>
      <View style={styles.needRow}><Text style={styles.needLabel}>Faltam</Text><Text style={styles.needValue}>{formatCoins(missing)}</Text></View>
      <ProgressBar accessibilityLabel={`Você tem ${formatCoins(have)} de ${coinsLabel(price)}`} maximumValue={price} size="hairline" value={have} />
      {compact ? null : <Text style={styles.hint}>{missingHint(missing)}</Text>}
    </View>;
  }
  return <WiseButton accessibilityLabel={`Comprar por ${coinsLabel(price)}`} label="Comprar" onPress={onBuy} testID={`${testID}-buy`} />;
}

/* ---------- Itens ---------- */

type Filter = 'todos' | CosmeticCategory;

function ItemsSection({ desktop, purchase, query }: { desktop: boolean; purchase: Purchase; query: ListQuery<ShopItem> }) {
  const [filter, setFilter] = useState<Filter>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ordered = orderShopItems(query.data ?? []);
  const visible = filter === 'todos' ? ordered : ordered.filter((item) => item.category === filter);
  const selected = ordered.find((item) => item.id === selectedId) ?? visible.find((item) => item.state !== 'owned') ?? visible[0] ?? null;
  const status = <ListStatus
    empty={<WiseText color="textSecondary" variant="body">Nenhum item à venda agora. Novos itens chegam com a arte do catálogo.</WiseText>}
    noun="os itens"
    query={query}
    testID="market-items"
  />;
  const categories = presentCategories(ordered);
  const columns = desktop ? 4 : 2;

  const grid = <View style={styles.itemsMain}>
    {categories.length > 1
      ? <View accessibilityLabel="Filtrar por categoria" style={styles.filters}>
        {(['todos', ...categories] as Filter[]).map((id) => <FilterChip active={filter === id} id={id} key={id} onPress={() => setFilter(id)} />)}
      </View>
      : null}
    <View style={styles.grid}>
      {visible.map((item) => <View key={item.id} style={{ width: `${100 / columns}%`, padding: 6 }}>
        <ItemTile
          item={item}
          onPress={() => {
            setSelectedId(item.id);
            if (!desktop && item.state !== 'owned') purchase.open({ kind: 'item', item });
          }}
          selected={desktop && selected?.id === item.id}
        />
      </View>)}
    </View>
    <View style={styles.note}>
      <WiseIcon color="textTertiary" name="sparkles" size="xsmall" />
      <Text style={styles.noteText}>Itens de nível, de Raid e premium não são vendidos aqui. Eles são conquistados.</Text>
    </View>
  </View>;

  return <View style={styles.section} testID="market-items">
    {status ?? null}
    {query.data && query.data.length > 0
      ? <View style={desktop ? styles.itemsDesktop : undefined}>
        {grid}
        {desktop && selected ? <ItemPreview item={selected} onBuy={() => { setSelectedId(selected.id); purchase.open({ kind: 'item', item: selected }); }} /> : null}
      </View>
      : null}
  </View>;
}

function FilterChip({ active, id, onPress }: { active: boolean; id: Filter; onPress: () => void }) {
  const { focusProps, focusStyle } = useFocusRing();
  const label = id === 'todos' ? 'Todos' : equipmentCategoryById[id].label;
  return <Pressable
    {...focusProps}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    hitSlop={4}
    onPress={onPress}
    style={({ hovered, pressed }) => StyleSheet.flatten([styles.filter, active && styles.filterActive, (hovered || pressed) && !active && styles.filterInteracting, focusStyle])}
    testID={`market-filter-${id}`}
  >
    <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
  </Pressable>;
}

function ItemTile({ item, onPress, selected }: { item: ShopItem; onPress: () => void; selected: boolean }) {
  const { focusProps, focusStyle } = useFocusRing();
  const owned = item.state === 'owned';
  const category = equipmentCategoryById[item.category].label;
  return <Pressable
    {...focusProps}
    accessibilityLabel={`${item.name}, ${category}. ${coinsLabel(item.price)}. ${owned ? 'No seu Inventário.' : stateLabel(item.state, item.missing)}`}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    onPress={onPress}
    style={({ hovered, pressed }) => StyleSheet.flatten([styles.tile, (hovered || pressed) && !selected && styles.tileInteracting, selected && styles.tileSelected, focusStyle])}
    testID={`market-item-${item.id}`}
  >
    <View style={[styles.tileArt, owned && styles.tileArtOwned]}>
      <PixelSprite scale={8} sprite={itemSprites[cosmeticSprite(item)]} />
      <Text style={styles.tileCategory}>{category}</Text>
    </View>
    <Text numberOfLines={2} style={styles.tileName}>{item.name}</Text>
    <View style={styles.tileFoot}>
      {owned
        ? <View style={styles.ownedRow}><WiseIcon color="feedbackSuccess" name="checkmark" size="xsmall" /><Text style={styles.tileOwned}>No inventário</Text></View>
        : <>
          <CoinAmount size={13} value={item.price} />
          {item.state === 'insufficient' ? <Text style={styles.tileMissing}>Faltam {formatCoins(item.missing)}</Text> : null}
        </>}
    </View>
  </Pressable>;
}

function ItemPreview({ item, onBuy }: { item: ShopItem; onBuy: () => void }) {
  const category = equipmentCategoryById[item.category];
  return <View role="region" accessibilityLabel={`Prévia de ${item.name}`} style={styles.preview} testID="market-item-preview">
    <View style={styles.stage}>
      <Text style={styles.stageBadge}>Prévia no seu herói</Text>
      <View style={styles.stageFigures}>
        <PixelSprite scale={7} sprite={heroSprites[DEFAULT_HERO_ID]} />
        <View style={styles.stageItem}><PixelSprite scale={7} sprite={itemSprites[cosmeticSprite(item)]} /></View>
      </View>
    </View>
    <View style={styles.previewCopy}>
      <Text accessibilityRole="header" aria-level={2} style={styles.previewTitle}>{item.name}</Text>
      <Text style={styles.previewText}>{category.label} · {category.description.charAt(0).toLowerCase()}{category.description.slice(1)}.</Text>
    </View>
    {item.state === 'purchasable'
      ? <>
        <PreviewLedger price={item.price} />
        <WiseButton label={`Comprar por ${formatCoins(item.price)}`} onPress={onBuy} testID="market-item-preview-buy" />
      </>
      : <PurchaseState compact={false} kind="Item" missing={item.missing} onBuy={onBuy} price={item.price} state={item.state} testID="market-item-preview" />}
  </View>;
}

function PreviewLedger({ price }: { price: number }) {
  const balance = useQuery(coinBalanceQueryOptions()).data;
  return balance === undefined ? null : <LedgerLines balance={balance} price={price} />;
}

const cinzel = 'Cinzel-SemiBold';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.backgroundCanvas },
  desktopContent: { paddingHorizontal: DESKTOP_GUTTER, paddingTop: 44, paddingBottom: 48 },
  mobileContent: { paddingHorizontal: MOBILE_GUTTER, paddingTop: 16, paddingBottom: 24 },
  column: { width: '100%', maxWidth: CONTENT_MAX },

  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 24 },
  headerCopy: { flex: 1, gap: 6 },
  headerCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: cinzel, fontSize: 32, lineHeight: 40, letterSpacing: 1, color: theme.color.textPrimary },
  titleCompact: { fontFamily: cinzel, fontSize: 24, lineHeight: 32, color: theme.color.textPrimary },
  lede: { maxWidth: 460, fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22, color: theme.color.textSecondary },
  purse: {
    flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard,
  },
  purseFigure: { fontFamily: 'JetBrainsMono-SemiBold', fontSize: 36, lineHeight: 40, color: theme.color.accentHighlight, fontVariant: ['tabular-nums'] },
  purseLabel: { fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 16, color: theme.color.textSecondary },
  purseFigures: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  purseRule: { width: theme.border.standard, alignSelf: 'stretch', backgroundColor: theme.color.borderSubtle },
  statementLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: theme.layout.touchTarget, paddingHorizontal: 4 },
  linkText: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.accentPrimary },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: theme.layout.touchTarget, paddingHorizontal: 14,
    borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard,
  },
  chipFigure: { fontFamily: 'JetBrainsMono-SemiBold', fontSize: 15, lineHeight: 20, color: theme.color.accentHighlight, fontVariant: ['tabular-nums'] },

  tabs: { flexDirection: 'row', gap: 28, marginTop: 28, borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderSubtle },
  tab: { flexDirection: 'row', alignItems: 'baseline', gap: 8, minHeight: theme.layout.touchTarget, paddingTop: 12, paddingBottom: 12, paddingHorizontal: 2 },
  tabText: { fontFamily: 'Inter-SemiBold', fontSize: 15, lineHeight: 20, color: theme.color.textSecondary },
  tabTextActive: { color: theme.color.textPrimary },
  tabCount: { fontFamily: 'JetBrainsMono-Medium', fontSize: 12, lineHeight: 16, color: theme.color.textTertiary },
  tabInteracting: { opacity: 0.85 },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, backgroundColor: theme.color.accentPrimary },

  section: { gap: 16, marginTop: 20 },
  status: { gap: theme.space.stackDefault, paddingVertical: 8 },
  statusAction: { alignSelf: 'flex-start' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteText: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: theme.color.textTertiary },

  contracts: { gap: 14 },
  contract: { overflow: 'hidden', borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  contractDesktop: { flexDirection: 'row', minHeight: 184 },
  contractOwned: { backgroundColor: theme.color.backgroundRaised },
  contractScene: { width: SCENE_COLUMN, padding: 12, justifyContent: 'center', borderRightWidth: theme.border.standard, borderRightColor: theme.color.borderGhost },
  contractSceneCompact: { borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderGhost },
  missionImage: { height: 160, borderRadius: theme.radius.card },
  contractBody: { flex: 1, minWidth: 0, gap: 8, paddingVertical: 20, paddingHorizontal: 24 },
  contractBodyCompact: { paddingVertical: 14, paddingHorizontal: 14, gap: 10 },
  contractTitle: { fontFamily: cinzel, fontSize: 20, lineHeight: 26, color: theme.color.textPrimary },
  contractTitleCompact: { fontSize: 17, lineHeight: 22 },
  contractCopy: { maxWidth: 560, fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 21, color: theme.color.textSecondary },
  contractCopyCompact: { fontSize: 13, lineHeight: 19 },
  contractSide: { width: SIDE_COLUMN, justifyContent: 'center', gap: 12, paddingVertical: 20, paddingHorizontal: 22, borderLeftWidth: theme.border.standard, borderLeftColor: theme.color.borderGhost },
  contractFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },

  loot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 8, marginTop: 'auto', paddingTop: 6 },
  lootKey: { fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 16, color: theme.color.textTertiary },
  lootItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lootTile: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset,
  },
  lootName: { fontFamily: 'Inter-Medium', fontSize: 13, lineHeight: 18, color: theme.color.textPrimary },
  lootCoins: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lootCoinsText: { fontFamily: 'JetBrainsMono-SemiBold', fontSize: 13, lineHeight: 18, color: theme.color.accentHighlight },

  ownedBlock: { gap: 6 },
  ownedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ownedText: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 18, color: theme.color.feedbackSuccess },
  hint: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 17, color: theme.color.textTertiary },
  needBlock: { gap: 8 },
  needBlockCompact: { flex: 1, maxWidth: 160 },
  needRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  needLabel: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 18, color: theme.color.textSecondary },
  needValue: { fontFamily: 'JetBrainsMono-SemiBold', fontSize: 13, lineHeight: 18, color: theme.color.textPrimary },

  itemsDesktop: { flexDirection: 'row', alignItems: 'flex-start', gap: 32 },
  itemsMain: { flex: 1, minWidth: 0, gap: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  filter: {
    minHeight: 36, justifyContent: 'center', paddingHorizontal: 14,
    borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle,
  },
  filterInteracting: { borderColor: theme.color.borderEmphasis },
  filterActive: { backgroundColor: theme.color.surfaceElevated, borderColor: theme.color.borderEmphasis },
  filterText: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 18, color: theme.color.textSecondary },
  filterTextActive: { color: theme.color.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  tile: {
    gap: 10, padding: 10, paddingBottom: 12,
    borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard,
  },
  tileInteracting: { borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCardActive },
  tileSelected: { borderColor: theme.color.accentPrimary, backgroundColor: theme.color.surfaceElevated },
  tileArt: { height: 112, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.control, backgroundColor: theme.color.surfaceInset },
  tileArtOwned: { opacity: 0.55 },
  tileCategory: {
    position: 'absolute', top: 6, left: 6, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden',
    borderRadius: theme.radius.detail, backgroundColor: 'rgba(7, 7, 12, 0.85)', fontFamily: 'Inter-Medium', fontSize: 11, lineHeight: 14, color: theme.color.textSecondary,
  },
  tileName: { minHeight: 36, fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 18, color: theme.color.textPrimary },
  tileFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 20 },
  tileOwned: { fontFamily: 'Inter-SemiBold', fontSize: 12, lineHeight: 16, color: theme.color.feedbackSuccess },
  tileMissing: { fontFamily: 'Inter-Medium', fontSize: 11, lineHeight: 14, color: theme.color.textTertiary },

  preview: {
    width: 392, gap: 18, padding: 24,
    borderRadius: theme.radius.panel, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.backgroundRaised,
  },
  stage: { height: 250, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 26, borderRadius: theme.radius.card, backgroundColor: theme.color.surfaceInset },
  stageBadge: {
    position: 'absolute', top: 12, left: 12, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden',
    borderRadius: theme.radius.detail, backgroundColor: theme.color.surfaceCard, fontFamily: 'Inter-Medium', fontSize: 11, lineHeight: 14, color: theme.color.textSecondary,
  },
  stageFigures: { flexDirection: 'row', alignItems: 'flex-end', gap: 22 },
  stageItem: { marginBottom: 60 },
  previewCopy: { gap: 4 },
  previewTitle: { fontFamily: cinzel, fontSize: 22, lineHeight: 28, color: theme.color.textPrimary },
  previewText: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 21, color: theme.color.textSecondary },
});
