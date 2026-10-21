import { isApiError } from '@/core/api/api-error';
import type { RaidRewardCategory } from './api';
import type { ChatAckError } from './guild-chat';
import { formatFocusHours } from './focus-hours';

/** The UI owns the public text; the backend `detail` never reaches the screen. */
export function createGuildErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.category === 'conflict') return 'Já existe uma guilda com esse nome, ou você já participa de uma. Tente outro nome.';
    if (error.category === 'validation') return 'O nome da guilda precisa ter entre 3 e 60 caracteres.';
    if (error.category === 'network') return 'Não foi possível criar a guilda. Verifique sua conexão e tente novamente.';
  }
  return 'Não foi possível criar a guilda agora. Tente novamente.';
}

export function joinGuildErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.category === 'conflict') return 'Você já participa de uma guilda.';
    if (error.status === 404) return 'Essa guilda não existe mais. Atualize a busca.';
    if (error.category === 'network') return 'Não foi possível entrar na guilda. Verifique sua conexão e tente novamente.';
  }
  return 'Não foi possível entrar na guilda agora. Tente novamente.';
}

export function formatMemberCount(count: number): string {
  return `${count} ${count === 1 ? 'membro' : 'membros'}`;
}

export function formatGuildRole(role: 'leader' | 'member'): string {
  return role === 'leader' ? 'Líder' : 'Membro';
}

export function formatGuildRoleSeal(role: 'leader' | 'member'): string {
  return role === 'leader' ? 'VOCÊ É LÍDER' : 'MEMBRO';
}

/** Raids won = Guild Level − 1: the Level starts at 1 and goes up with every Meta batida. */
function wonRaids(level: number): number {
  return level - 1;
}

/** The Header line: Level and size, plus the Raids already won (Level − 1) once there is any. */
export function formatGuildStats(level: number, memberCount: number): string {
  const won = wonRaids(level);
  const parts = [`Nível ${level}`, formatMemberCount(memberCount)];
  if (won > 0) parts.push(`${won} ${won === 1 ? 'Raid vencida' : 'Raids vencidas'}`);
  return parts.join(' · ').toUpperCase();
}

export function leaveGuildErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 404) return 'Você já não participa dessa guilda. Atualize a tela.';
    if (error.category === 'network') return 'Não foi possível sair da guilda. Verifique sua conexão e tente novamente.';
  }
  return 'Não foi possível sair da guilda agora. Tente novamente.';
}

const RAID_REWARD_CATEGORY_LABELS = { avatar: 'Avatar', badge: 'Badge', title: 'Título', accessory: 'Acessório' } as const;

export function formatRewardCategory(category: RaidRewardCategory): string {
  return RAID_REWARD_CATEGORY_LABELS[category];
}

/** A reward item as named on the Raid screens: a Título is quoted, the rest by name. */
export function formatRewardName(reward: { name: string; category: RaidRewardCategory }): string {
  return reward.category === 'title' ? `Título “${reward.name}”` : reward.name;
}

export const formatRewardCoins = (coins: number) => `+${coins} Moedas`;

/** "Título “X”, Escama Rubra e +50 Moedas": the one-line summary on the Raid card. */
export function formatRewardSummary({ rewards, coins }: { rewards: { name: string; category: RaidRewardCategory }[]; coins: number }): string {
  const parts = [...rewards.map(formatRewardName), formatRewardCoins(coins)];
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : parts.join('');
}

export const REWARDS_LOADING = 'Carregando as recompensas…';
export const REWARDS_ERROR = 'Não foi possível carregar as recompensas da Raid.';
export const REWARDS_EMPTY = 'Sem Raid nesta semana. As recompensas aparecem quando a próxima começar.';
export const REWARD_COINS_DETAIL = 'Para cada Participante';

export const RAID_REWARD_RULE = 'Para receber o item, contribua com ao menos uma sessão de guilda e ajude a bater a meta até o fim da semana.';

/** Shown once the progress reached the goal; Contributions keep adding until the end of the week. */
export const RAID_GOAL_REACHED = 'Meta batida! As sessões de guilda continuam contando até o fim da semana.';

export function joinRaidErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.category === 'conflict') return 'Essa Raid já foi encerrada. Atualizamos a tela com a Raid da semana.';
    if (error.status === 403) return 'Apenas membros da guilda podem participar da Raid.';
    if (error.category === 'network') return 'Não foi possível confirmar sua participação. Verifique sua conexão e tente novamente.';
  }
  return 'Não foi possível confirmar sua participação agora. Tente novamente.';
}

export function formatPosition(position: number): string {
  return `${position}º`;
}

export function formatMyPosition(position: number | null): string | null {
  return position === null ? null : `Sua posição: ${formatPosition(position)} no Ranking interno`;
}

/** The Raid week is Monday to Sunday in São Paulo. */
const RAID_TIME_ZONE = 'America/Sao_Paulo';
const RAID_END = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: RAID_TIME_ZONE });

/** "Termina domingo · 23:59": the end of the Raid week as São Paulo reads it. */
export function formatRaidEnds(endsAt: string): string {
  const parts = Object.fromEntries(RAID_END.formatToParts(new Date(endsAt)).map((part) => [part.type, part.value]));
  return `Termina ${parts.weekday} · ${parts.hour}:${parts.minute}`;
}

const RAID_WEEK_DAY = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: RAID_TIME_ZONE });

/** The Raid week as São Paulo reads it: Monday to Sunday. */
export function formatRaidWeek(startsAt: string, endsAt: string): string {
  return `Semana de ${RAID_WEEK_DAY.format(new Date(startsAt))} a ${RAID_WEEK_DAY.format(new Date(endsAt))}`;
}

type PastRaidStatus = 'completed' | 'expired';

/** What each closing status says: the long outcome for the screen reader and the seal on the row, as in Figma 06c. */
const PAST_RAID_STATUS: Record<PastRaidStatus, { outcome: string; seal: string }> = {
  completed: { outcome: 'Meta batida · a guilda subiu de nível', seal: 'VENCIDA' },
  expired: { outcome: 'Meta não batida', seal: 'NÃO VENCIDA' },
};

export function formatPastRaidOutcome(status: PastRaidStatus): string {
  return PAST_RAID_STATUS[status].outcome;
}

export function formatPastRaidSeal(status: PastRaidStatus): string {
  return PAST_RAID_STATUS[status].seal;
}

const RAID_MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const RAID_DAY_PARTS = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'numeric', timeZone: RAID_TIME_ZONE });

function raidDay(iso: string): { day: string; month: string } {
  const parts = RAID_DAY_PARTS.formatToParts(new Date(iso));
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = RAID_MONTHS[Number(parts.find((part) => part.type === 'month')?.value) - 1] ?? '';
  return { day, month };
}

/** The closed Raid week in the Figma 06c form: "06–12 OUT", or "29 SET–05 OUT" when it crosses a month. */
export function formatPastRaidPeriod(startsAt: string, endsAt: string): string {
  const start = raidDay(startsAt);
  const end = raidDay(endsAt);
  return start.month === end.month ? `${start.day}–${end.day} ${end.month}` : `${start.day} ${start.month}–${end.day} ${end.month}`;
}

/** "Raids vencidas" of the list header: Level − 1, or a plain "nenhuma vencida" while the Guild is still on Level 1. */
export function formatWonRaids(level: number): string {
  const won = wonRaids(level);
  if (won <= 0) return 'nenhuma vencida';
  return `${won} ${won === 1 ? 'vencida' : 'vencidas'}`;
}

/** The goal of a won Raid ("200h"); one that fell short shows how far it got ("140h de 180h"). */
export function formatPastRaidTotals(raid: { status: PastRaidStatus; goalXp: number; progressXp: number }): string {
  const goal = formatFocusHours(raid.goalXp);
  return raid.status === 'completed' ? goal : `${formatFocusHours(raid.progressXp)} de ${goal}`;
}

/** The own result in hours of focus, rounded like the Raid totals so it never reads above the goal: "Você: 9,4h · 3º". */
export function formatPastRaidMine(me: { participated: boolean; contributionXp: number; position: number | null }): string {
  if (!me.participated) return 'Você não participou';
  const hours = formatFocusHours(me.contributionXp);
  return me.position === null ? `Você: ${hours}` : `Você: ${hours} · ${formatPosition(me.position)}`;
}

/** The UI owns the public text: the ack code picks it, the server message never reaches the screen. */
export function chatErrorMessage(error: ChatAckError): string {
  switch (error.code) {
    case 'EMPTY': return 'Escreva algo antes de enviar.';
    case 'TOO_LONG': return 'A mensagem ficou longa demais. Encurte e envie de novo.';
    case 'ABUSIVE': return 'A mensagem tem termos não permitidos no Mural. Reescreva e envie de novo.';
    case 'RATE_LIMITED': {
      const seconds = Math.max(1, Math.ceil((error.retryAfterMs ?? 0) / 1000));
      return `Você enviou muitas mensagens seguidas. Espere ${seconds} s e tente de novo.`;
    }
    case 'FORBIDDEN': return 'Só membros da guilda podem escrever no Mural.';
    case 'DISCONNECTED': return 'Sem conexão com o Mural. A mensagem não foi enviada.';
    case 'TIMEOUT': return 'O Mural não respondeu. Confira se a mensagem apareceu antes de enviar de novo.';
    default: return 'Não foi possível enviar a mensagem agora. Tente novamente.';
  }
}

/** "Missão de <nome>" for a chosen Missão, "Missão do rodízio" when nobody chose or the Missão is free. */
export function formatMissionOwner(owner: { displayName: string } | null | undefined): string {
  return owner ? `Missão de ${owner.displayName}` : 'Missão do rodízio';
}

export const NEXT_MISSION_LOCK_NOTICE = 'A escolha trava quando a próxima Raid começa. Até lá você pode trocar.';

export const NEXT_MISSION_ROTATION_NOTICE = 'Ninguém escolheu a Missão: vale o rodízio da próxima semana.';

export function chooseNextMissionErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 403) return 'Apenas o Líder escolhe a Missão da próxima Raid.';
    if (error.status === 404 || error.status === 422) return 'Essa Missão não está mais disponível na guilda. Atualizamos a lista.';
    if (error.category === 'network') return 'Não foi possível salvar a escolha. Verifique sua conexão e tente novamente.';
  }
  return 'Não foi possível salvar a escolha agora. Tente novamente.';
}
