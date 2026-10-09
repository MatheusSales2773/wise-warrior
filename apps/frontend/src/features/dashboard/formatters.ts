import type { SessionMetrics, UserProfile } from './api';

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

export function formatDayCount(value: number): string {
  return `${value} ${value === 1 ? 'dia' : 'dias'}`;
}

export function levelProgressPercent(profile: Pick<UserProfile, 'xpTotal' | 'levelStartXp' | 'nextLevelXp'>): number {
  return Math.min(100, Math.round(((profile.xpTotal - profile.levelStartXp) / Math.max(1, profile.nextLevelXp - profile.levelStartXp)) * 100));
}

export function formatSessionsToday(metrics: Pick<SessionMetrics, 'sessionsToday' | 'dailyGoal'>): { value: string; spoken: string } {
  const { sessionsToday } = metrics;
  const goal = Math.max(0, metrics.dailyGoal);
  if (goal > 0) return { value: `${sessionsToday} / ${goal}`, spoken: `${sessionsToday} de ${goal}` };
  return { value: `${sessionsToday}`, spoken: `${sessionsToday}` };
}
