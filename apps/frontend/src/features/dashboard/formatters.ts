export function formatXp(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatSessionDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.floor(seconds))} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
}

export function formatDiscardReason(reason: string | null): string {
  if (!reason) return '';
  return 'Sessão não contabilizada';
}

export function formatCadenceDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
