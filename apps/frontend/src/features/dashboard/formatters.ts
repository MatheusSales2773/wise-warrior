import type { SessionsObjective, WeeklyMinutesObjective } from '@/features/chronicles/queries';
import type { RecentStudySession, UserProfile, WeekSummary } from './api';

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

export function formatCappedReason(reason: 'continuous-limit' | 'daily-limit'): string {
  return reason === 'daily-limit' ? 'XP limitado pelo teto diário' : 'XP limitado ao máximo de sessão contínua';
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

/** Progress and target come from the "Conclua 4 sessões hoje" Objetivo; without it only the session count is known. */
export function formatSessionsToday(sessionsToday: number, objective: SessionsObjective | undefined): { value: string; spoken: string } {
  if (objective) {
    return { value: `${objective.progress} / ${objective.target}`, spoken: `${objective.progress} de ${objective.target}` };
  }
  return { value: `${sessionsToday}`, spoken: `${sessionsToday}` };
}

export function formatSessionMode(mode: string): string {
  return mode === 'guild' ? 'guilda' : mode;
}

export function formatSessionState(state: RecentStudySession['state']): string {
  switch (state) {
    case 'completed': return 'Concluída';
    case 'stopped_early': return 'Encerrada antecipadamente';
    case 'cancelled': return 'Cancelada';
    case 'discarded': return 'Descartada';
    case 'paused': return 'Pausada';
    case 'running': return 'Em andamento';
    default: return '';
  }
}

/** Minutes as "3h 40min", "5h" or "50min": the unit the Objetivo semanal and the week's subjects are shown in. */
export function formatFocusMinutes(minutes: number): string {
  const whole = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest}min`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

/** The support line of "Foco válido hoje": the weekly minutes Objetivo when known, the old text otherwise. */
export function formatWeeklyFocusLine(objective: WeeklyMinutesObjective | undefined, validSecondsToday: number): string {
  if (!objective) return `${formatDuration(validSecondsToday)} de foco válido`;
  return `Semana: ${formatFocusMinutes(objective.progress)} de ${formatFocusMinutes(objective.target)}`;
}

/** Seconds of valid focus as "1h 10min": the format of the Foco válido hoje card and of the week's subjects. */
export function formatFocusSeconds(seconds: number): string {
  return formatFocusMinutes(Math.floor(seconds / 60));
}

const MAX_WEEK_SUBJECTS = 3;

/** The subjects of the week's summary the Progressão shows: the first three, in the server's order. */
export function topWeekSubjects(subjects: WeekSummary['subjects'] | undefined): WeekSummary['subjects'] {
  return (subjects ?? []).slice(0, MAX_WEEK_SUBJECTS);
}

/** "7h 12min": the time left until the Objetivos renew, never below zero. */
export function formatTimeLeft(renewsAt: string, at: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((Date.parse(renewsAt) - at) / 60_000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

/** The header of Objetivos de hoje: "1 de 3 · renova em 7h 12min". */
export function formatObjectivesHeader(completed: number, total: number, renewsAt: string, at: number = Date.now()): string {
  return `${completed} de ${total} · renova em ${formatTimeLeft(renewsAt, at)}`;
}
