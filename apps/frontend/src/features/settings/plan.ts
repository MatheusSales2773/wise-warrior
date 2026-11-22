/** "free" → "Free"; the plan name as the server sends it, capitalized. */
export function planName(planTier: string): string {
  return planTier.charAt(0).toUpperCase() + planTier.slice(1);
}

/** "Free · premium em breve" while billing is off (S5.2); just the plan name once it is on (S5.13). */
export function planLabel(planTier: string, available = false): string {
  return available ? planName(planTier) : `${planName(planTier)} · premium em breve`;
}

const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

/** "dd/mm" of an ISO instant, on the São Paulo calendar. */
export function dayMonth(iso: string): string {
  return DAY_MONTH.format(new Date(iso));
}

/** What the "Plano atual" card says for a plan and which Stripe page its button opens (#380 P2-P6). */
export type PlanCard = {
  name: 'Free' | 'Premium ✦';
  /** The line under the name, in JetBrains Mono. */
  situation: string;
  pill?: { text: string; tone: 'success' | 'danger' | 'muted' };
  body?: string;
  /** The in-card error of a failed charge (P4). */
  error?: string;
  action?: { label: string; kind: 'checkout' | 'portal'; primary: boolean };
};

export type PlanCardInput = { available: boolean; planTier: string; status: string | null; renewsAt: string | null; premiumUntil: string | null };

export const PREMIUM_PRICE = 'R$ 9,90';

export function planCard(view: PlanCardInput): PlanCard {
  if (!view.available) {
    return { name: 'Free', situation: 'PREMIUM EM BREVE', body: 'A assinatura premium ainda não está disponível. Seus itens e moedas continuam iguais.' };
  }
  if (view.planTier !== 'premium') {
    return {
      name: 'Free',
      situation: 'SEM ASSINATURA',
      body: `Você joga com tudo o que conquista no foco. O premium libera 3 Itens premium ✦ para o seu herói por ${PREMIUM_PRICE}/mês.`,
      action: { label: 'Assinar premium', kind: 'checkout', primary: true },
    };
  }
  const manage = { label: 'Gerenciar assinatura', kind: 'portal', primary: false } as const;
  if (view.status === 'past_due') {
    return {
      name: 'Premium ✦',
      situation: `${PREMIUM_PRICE}/MÊS · PAGAMENTO PENDENTE`,
      pill: { text: 'PENDENTE', tone: 'danger' },
      error: 'A última cobrança não passou. Atualize o cartão para manter o premium.',
      action: { label: 'Atualizar cartão', kind: 'portal', primary: true },
    };
  }
  if (view.premiumUntil) {
    const until = dayMonth(view.premiumUntil);
    return {
      name: 'Premium ✦',
      situation: 'NÃO RENOVA',
      pill: { text: `ATÉ ${until}`, tone: 'muted' },
      body: `O premium fica até ${until}. Depois o plano volta a Free e os Itens premium ✦ são desequipados.`,
      action: manage,
    };
  }
  return {
    name: 'Premium ✦',
    situation: view.renewsAt ? `${PREMIUM_PRICE}/MÊS · RENOVA EM ${dayMonth(view.renewsAt)}` : `${PREMIUM_PRICE}/MÊS`,
    pill: { text: 'ATIVO', tone: 'success' },
    body: 'Seus Itens premium ✦ estão liberados. Equipe no Personagem.',
    action: manage,
  };
}
