import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, WiseButton, WiseIcon, isDesktopLayout, theme } from '@/design-system';
import { cosmeticSprite, equipmentCategoryById, equippedItems, type EquippedItems } from '@/features/character/catalog';
import { GroundShadow, HeroGlow } from '@/features/character/character-art';
import { LayeredHero } from '@/features/character/layered-hero';
import { PixelSprite } from '@/features/character/PixelSprite';
import { itemSprites } from '@/features/character/sprites';
import { profileQueryOptions } from '@/features/dashboard/queries';
import type { CatalogCosmeticItem } from '@/features/profile/api';
import { cosmeticsCatalogQueryOptions } from '@/features/profile/queries';
import { openBillingSession } from './api';
import { billingErrorMessage, openStripePage, subscriptionQueryOptions } from './billing';
import { PREMIUM_PRICE, planCard, type PlanCard } from './plan';
import { settingsStyles } from './settings-content';

const CONFIRM_WAIT_MS = 30_000;
const cinzel = 'Cinzel-Bold';
const mono = 'JetBrainsMono-Medium';

/** What the offer shows on the hero: the two items that change it most (P2). */
const OFFER_HERO: EquippedItems = {
  avatar: { itemId: '', name: 'Manto do Arquimago', sprite: 'mantoDoArquimago' },
  weapon: { itemId: '', name: 'Cajado Astral', sprite: 'cajadoAstral' },
  badge: null, title: null, accessory: null,
};

const CATEGORY_ORDER = ['avatar', 'weapon', 'title'];

/** The 3 Itens premium ✦ of the Assinatura: premium and open from level 1, unlike "Mestre da Aurora" (level 15). */
function premiumItems(catalog: readonly CatalogCosmeticItem[] | undefined): CatalogCosmeticItem[] {
  return (catalog ?? [])
    .filter((item) => item.requiresPremium && item.unlockCondition.type === 'level' && item.unlockCondition.level <= 1)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
    .slice(0, 3);
}

function CardHeader({ aside, title }: { aside?: string; title: string }) {
  return <View style={styles.cardHeader}>
    <Text style={styles.cardTitle}>{`◈ ${title.toUpperCase()}`}</Text>
    {aside ? <Text style={styles.aside}>{aside}</Text> : null}
  </View>;
}

function Pill({ text, tone }: { text: string; tone: 'success' | 'danger' | 'muted' | 'gold' }) {
  const color = { success: theme.color.feedbackSuccess, danger: theme.color.feedbackDanger, muted: theme.color.accentPrimary, gold: theme.color.accentPrimary }[tone];
  const border = { success: theme.color.feedbackSuccess, danger: theme.color.feedbackDanger, muted: theme.color.accentMuted, gold: theme.color.accentMuted }[tone];
  return <View style={[styles.pill, { borderColor: border }]}><Text style={[styles.pillText, { color }]}>{text}</Text></View>;
}

function ItemRow({ item, released }: { item: CatalogCosmeticItem; released: boolean }) {
  return <View style={[styles.item,]}>
    <View style={[styles.thumb, !released && styles.thumbPremium]}>
      <PixelSprite scale={4} sprite={itemSprites[cosmeticSprite(item)]} />
    </View>
    <View style={styles.itemText}>
      <Text numberOfLines={1} style={styles.itemName}>{item.name}</Text>
      <Text style={styles.itemCategory}>{equipmentCategoryById[item.category].label.toUpperCase()}</Text>
    </View>
    {released
      ? <View accessibilityLabel="Liberado" accessible style={styles.released}>
        <WiseIcon color="feedbackSuccess" name="checkmark" size="xsmall" />
        <Text style={styles.releasedText}>Liberado</Text>
      </View>
      : <Pill text="✦ PREMIUM" tone="gold" />}
  </View>;
}

function Stage({ badge, equipped, wide }: { badge: string; equipped: EquippedItems; wide?: boolean }) {
  return <View style={[styles.stage, wide ? styles.stageWide : null]}>
    <HeroGlow height={240} opacity={0.24} style={styles.stageGlow} width={300} />
    <GroundShadow height={14} style={styles.stageShadow} width={96} />
    <LayeredHero equipped={equipped} scale={6} style={styles.stageHero} />
    <View style={styles.stageBadge}><Pill text={badge} tone="gold" /></View>
  </View>;
}

type Opener = { open: (kind: 'checkout' | 'portal') => void; pending: boolean };

function Summary({ card, opener }: { card: PlanCard; opener: Opener }) {
  const premium = card.name !== 'Free';
  const { action } = card;
  return <View style={[styles.card, premium && styles.cardPremium]} testID="settings-plan-card">
    <CardHeader aside="Cobrança pelo Stripe" title="Plano atual" />
    <View style={styles.planRow}>
      <View style={styles.seal}><WiseIcon color="accentPrimary" name="diamond-outline" size="medium" /></View>
      <View style={styles.planText}>
        <Text style={[styles.planName, premium && styles.planNamePremium]}>{card.name}</Text>
        <Text style={[styles.situation, card.pill?.tone === 'danger' && styles.situationDanger]}>{card.situation}</Text>
      </View>
      {card.pill ? <Pill text={card.pill.text} tone={card.pill.tone} /> : null}
    </View>
    {card.body ? <Text style={styles.body}>{card.body}</Text> : null}
    {card.error ? <FeedbackMessage message={card.error} variant="error" /> : null}
    {action ? <View style={styles.action}>
      <WiseButton
        label={action.label}
        leading={action.kind === 'checkout' ? <WiseIcon color="backgroundCanvas" name="diamond-outline" size="xsmall" /> : undefined}
        loading={opener.pending}
        onPress={() => opener.open(action.kind)}
        variant={action.primary ? 'primary' : 'secondary'}
      />
    </View> : null}
  </View>;
}

function Offer({ items, opener }: { items: CatalogCosmeticItem[]; opener: Opener }) {
  return <View style={styles.offer} testID="settings-plan-offer">
    <Stage badge="PRÉVIA NO SEU HERÓI" equipped={OFFER_HERO} />
    <View style={styles.offerHead}>
      <Text style={styles.aside}>ASSINATURA MENSAL · CANCELE QUANDO QUISER</Text>
      <View style={styles.offerTitle}>
        <Text style={[styles.planName, styles.planNamePremium, styles.offerName]}>Premium ✦</Text>
        <Text style={styles.price}>{PREMIUM_PRICE}<Text style={styles.perMonth}>/mês</Text></Text>
      </View>
    </View>
    <View style={styles.items}>{items.map((item) => <ItemRow item={item} key={item.id} released={false} />)}</View>
    <WiseButton
      label="Assinar premium"
      leading={<WiseIcon color="backgroundCanvas" name="diamond-outline" size="xsmall" />}
      loading={opener.pending}
      onPress={() => opener.open('checkout')}
    />
    <Text style={styles.note}>O pagamento abre na página segura do Stripe. Cancele no Portal do cliente: o premium fica até o fim do período pago.</Text>
  </View>;
}

const HOW_IT_WORKS = [
  'Você assina na página segura do Stripe e volta para cá. O plano muda assim que o pagamento é confirmado.',
  'A cobrança é mensal no cartão. Troque o cartão ou cancele no Portal do cliente, em Gerenciar assinatura.',
  'Cancelou? O premium fica até o fim do período pago. Depois o plano volta a Free e os Itens premium ✦ saem do herói.',
];

function HowItWorks() {
  return <View style={styles.card} testID="settings-plan-how">
    <CardHeader title="Como funciona" />
    {HOW_IT_WORKS.map((step, index) => <View key={step} style={styles.step}>
      <Text style={styles.stepNumber}>{`0${index + 1}`}</Text>
      <Text style={styles.stepText}>{step}</Text>
    </View>)}
  </View>;
}

function OwnedItems({ equipped, items, desktop }: { equipped: EquippedItems; items: CatalogCosmeticItem[]; desktop: boolean }) {
  return <View style={styles.card} testID="settings-plan-items">
    <CardHeader aside="Equipe no Personagem" title="Seus Itens premium ✦" />
    <View style={[styles.ownedBody, desktop && styles.ownedBodyDesktop]}>
      <Stage badge="SEU HERÓI PREMIUM" equipped={equipped} wide={desktop} />
      <View style={styles.ownedItems}>
        {items.map((item) => <ItemRow item={item} key={item.id} released />)}
        <Text style={styles.note}>Se a assinatura terminar, estes itens são desequipados e voltam a ficar bloqueados. Nada some do Inventário.</Text>
      </View>
    </View>
  </View>;
}

function Column({ children, desktop }: { children: ReactNode; desktop: boolean }) {
  return <View style={desktop ? styles.columnDesktop : styles.column}>{children}</View>;
}

/** The Plano section, from `GET /billing/subscription`, the profile and the Catálogo (S5 behaviour, #380 layout). */
export function PlanContent() {
  const subscription = useQuery(subscriptionQueryOptions());
  const profile = useQuery(profileQueryOptions());
  const catalog = useQuery(cosmeticsCatalogQueryOptions());
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const { width } = useWindowDimensions();
  const desktop = isDesktopLayout(Platform.OS, width);
  const [late, setLate] = useState(false);
  const open = useMutation({
    mutationFn: openBillingSession,
    onSuccess: (url) => openStripePage(url),
  });
  const confirming = checkout === 'success' && subscription.data?.planTier === 'free';
  useEffect(() => {
    if (!confirming) return undefined;
    // Back from Checkout before the webhook: `user:planChanged` refetches; after 30 s the wait gets a calmer line.
    const timer = setTimeout(() => setLate(true), CONFIRM_WAIT_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  if (!subscription.data) {
    if (subscription.isError) {
      return <View style={settingsStyles.stateBlock} testID="settings-plan-error">
        <FeedbackMessage message="Não foi possível carregar seu plano." title="Plano indisponível" variant="error" />
        <WiseButton label="Tentar novamente" loading={subscription.isRefetching} onPress={() => void subscription.refetch()} variant="ghost" />
      </View>;
    }
    return <View accessibilityLabel="Carregando seu plano" accessibilityState={{ busy: true }} aria-busy style={settingsStyles.stateBlock}>
      <ProgressBar indeterminate accessibilityLabel="Carregando seu plano" />
    </View>;
  }

  const view = subscription.data;
  const card = planCard(view);
  const opener: Opener = { open: (kind) => open.mutate(kind), pending: open.isPending };
  const items = premiumItems(catalog.data);
  const free = card.action?.kind === 'checkout';
  const premium = view.available && view.planTier === 'premium';
  const equipped = equippedItems(profile.data ?? { equipped: [] });

  return <View style={styles.root}>
    {confirming
      ? <FeedbackMessage message={late ? 'Pagamento recebido. O plano atualiza em instantes.' : 'Confirmando sua assinatura…'} testID="settings-plan-confirming" variant="info" />
      : null}
    {open.isError ? <FeedbackMessage message={billingErrorMessage(open.error)} testID="settings-plan-failure" variant="error" /> : null}
    <View style={desktop ? styles.desktopRow : styles.column}>
      <Column desktop={desktop}>
        <Summary card={card} opener={opener} />
        {free && desktop ? <HowItWorks /> : null}
        {premium ? <OwnedItems desktop={desktop} equipped={equipped} items={items} /> : null}
      </Column>
      {free ? <Offer items={items} opener={opener} /> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  desktopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  column: { gap: 20 },
  columnDesktop: { flex: 1, minWidth: 0, gap: 20 },

  card: { gap: 16, padding: 22, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  cardPremium: { borderColor: theme.color.accentMuted },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontFamily: cinzel, fontSize: 11, lineHeight: 14, letterSpacing: 2.6, color: theme.color.accentPrimary },
  aside: { flexShrink: 1, fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: theme.color.textTertiary },

  planRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  seal: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceInset },
  planText: { flex: 1, minWidth: 0, gap: 4 },
  planName: { fontFamily: cinzel, fontSize: 24, lineHeight: 30, color: theme.color.textPrimary },
  planNamePremium: { color: theme.color.accentHighlight },
  situation: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: theme.color.textTertiary },
  situationDanger: { color: theme.color.feedbackDanger },
  body: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 20, color: theme.color.textSecondary },
  action: { alignSelf: 'flex-start' },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, borderWidth: theme.border.standard, backgroundColor: theme.color.surfaceInset },
  pillText: { fontFamily: mono, fontSize: 9, lineHeight: 12, letterSpacing: 0.8 },

  offer: { gap: 16, paddingHorizontal: 22, paddingVertical: 20, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceCard, width: '100%', maxWidth: 392 },
  offerHead: { gap: 4 },
  offerTitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  offerName: { fontSize: 22 },
  price: { fontFamily: 'JetBrainsMono-Bold', fontSize: 20, lineHeight: 26, color: theme.color.textPrimary },
  perMonth: { fontFamily: mono, fontSize: 11, color: theme.color.textTertiary },
  items: { gap: 8 },
  note: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 16, color: theme.color.textTertiary },

  stage: { height: 220, overflow: 'hidden', alignItems: 'center', borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset },
  stageWide: { width: 346, height: 260 },
  stageGlow: { position: 'absolute', top: -11 },
  stageShadow: { position: 'absolute', top: 188 },
  stageHero: { position: 'absolute', top: 51 },
  stageBadge: { position: 'absolute', top: 11, left: 11 },

  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12, paddingRight: 14, paddingVertical: 10, borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset },
  thumb: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.backgroundCanvas },
  thumbPremium: { borderColor: theme.color.accentMuted },
  itemText: { flex: 1, minWidth: 0, gap: 3 },
  itemName: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 17, color: theme.color.textPrimary },
  itemCategory: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: theme.color.textTertiary },
  released: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  releasedText: { fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 15, color: theme.color.feedbackSuccess },

  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: { fontFamily: 'JetBrainsMono-Bold', fontSize: 11, lineHeight: 20, color: theme.color.accentPrimary },
  stepText: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 20, color: theme.color.textSecondary },

  ownedBody: { gap: 20 },
  ownedBodyDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  ownedItems: { flex: 1, gap: 8 },
});
