import type { SessionHistoryItem } from '@/features/dashboard/api';
import { formatCappedReason, formatDuration, formatXp } from '@/features/dashboard/formatters';
import { saoPauloDay } from '@/features/dashboard/queries';

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOCK = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' });
const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' });

const dayMs = (dayKey: string) => Date.parse(`${dayKey}T00:00:00Z`);
const shiftDay = (dayKey: string, days: number) => new Date(dayMs(dayKey) + days * DAY_MS).toISOString().slice(0, 10);
const dayMonth = (dayKey: string) => `${dayKey.slice(8, 10)}/${dayKey.slice(5, 7)}`;

/** "19/10 a 25/10": the Monday-to-Sunday week of São Paulo that holds `todayKey`. */
export function weekRangeLabel(todayKey: string): string {
  const sinceMonday = (new Date(dayMs(todayKey)).getUTCDay() + 6) % 7;
  const monday = shiftDay(todayKey, -sinceMonday);
  return `${dayMonth(monday)} a ${dayMonth(shiftDay(monday, 6))}`;
}

/** "HOJE · QUINTA, 22/10", "ONTEM · QUARTA, 21/10", then "TERÇA, 20/10". */
export function dayHeading(dayKey: string, todayKey: string): string {
  const named = `${WEEKDAY.format(new Date(dayMs(dayKey))).replace('-feira', '')}, ${dayMonth(dayKey)}`.toUpperCase();
  if (dayKey === todayKey) return `HOJE · ${named}`;
  if (dayKey === shiftDay(todayKey, -1)) return `ONTEM · ${named}`;
  return named;
}

export function sessionClock(endedAt: string): string {
  return CLOCK.format(new Date(endedAt));
}

export type DiaryDay = { dayKey: string; heading: string; items: SessionHistoryItem[] };

/** Groups the already newest-first list by the São Paulo day each session ended on. */
export function groupByDay(items: readonly SessionHistoryItem[], todayKey: string = saoPauloDay()): DiaryDay[] {
  const days: DiaryDay[] = [];
  for (const item of items) {
    const dayKey = saoPauloDay(new Date(item.endedAt).getTime());
    const last = days[days.length - 1];
    if (last?.dayKey === dayKey) last.items.push(item);
    else days.push({ dayKey, heading: dayHeading(dayKey, todayKey), items: [item] });
  }
  return days;
}

export const isDiscarded = (item: SessionHistoryItem) => item.state === 'discarded';
export const isTruncated = (item: SessionHistoryItem) => !isDiscarded(item) && Boolean(item.cappedReason);

/** The status line of a row: Concluída, Truncada with its reason, or not counted. */
export function diaryStatus(item: SessionHistoryItem): string {
  if (isDiscarded(item)) return 'Não contabilizada';
  if (item.cappedReason) return `Truncada · ${formatCappedReason(item.cappedReason)}`;
  return 'Concluída';
}

/** XP of a row: "+400 XP", or "—" when the session did not count. */
export function diaryXp(item: SessionHistoryItem): string {
  return isDiscarded(item) ? '—' : `+${formatXp(item.xpAwarded)} XP`;
}

/** The spoken description of a row. */
export function rowLabel(item: SessionHistoryItem): string {
  const subject = item.subject?.trim() || 'Sem matéria';
  const mode = item.mode === 'guild' ? 'Guilda' : 'Solo';
  return `${sessionClock(item.endedAt)}. ${subject}. ${diaryStatus(item)}. ${mode}. ${formatDuration(item.durationValidSeconds)}. ${isDiscarded(item) ? 'Sem XP' : diaryXp(item)}.`;
}
