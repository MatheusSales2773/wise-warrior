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
