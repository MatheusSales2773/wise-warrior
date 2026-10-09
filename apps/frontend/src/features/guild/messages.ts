import { isApiError } from '@/core/api/api-error';

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

export function leaveGuildErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 404) return 'Você já não participa dessa guilda. Atualize a tela.';
    if (error.category === 'network') return 'Não foi possível sair da guilda. Verifique sua conexão e tente novamente.';
  }
  return 'Não foi possível sair da guilda agora. Tente novamente.';
}

const RAID_REWARD_CATEGORY_LABELS = { avatar: 'Avatar', badge: 'Badge', title: 'Título', accessory: 'Acessório' } as const;

export function formatRewardCategory(category: keyof typeof RAID_REWARD_CATEGORY_LABELS): string {
  return RAID_REWARD_CATEGORY_LABELS[category];
}

export const RAID_REWARD_RULE = 'Para receber o item, contribua com ao menos uma sessão de guilda e ajude a bater a meta até o fim da semana.';

/** Remaining time shown on the Raid card; at zero the week is over and the next refetch brings the new Raid. */
export function formatRaidTimeLeft(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes <= 0) return 'Encerrando…';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} d ${hours} h restantes`;
  if (hours > 0) return `${hours} h ${minutes % 60} min restantes`;
  return `${minutes} min restantes`;
}

export function raidProgressPercent(progressXp: number, goalXp: number): number {
  return goalXp > 0 ? Math.min(100, Math.floor((progressXp / goalXp) * 100)) : 0;
}

export function joinRaidErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.category === 'conflict') return 'Essa Raid já foi encerrada. Atualizamos a tela com a Raid da semana.';
    if (error.status === 403) return 'Apenas membros da guilda podem participar da Raid.';
    if (error.category === 'network') return 'Não foi possível confirmar sua participação. Verifique sua conexão e tente novamente.';
  }
  return 'Não foi possível confirmar sua participação agora. Tente novamente.';
}
