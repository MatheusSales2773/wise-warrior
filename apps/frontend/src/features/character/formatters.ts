import { formatXp } from '@/features/dashboard/formatters';

const compactDecimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

/** Short XP totals for stat tiles: 950, 12,5k, 128,4k, 1,2M. Rounds down so the tile never overstates progress. */
export function formatCompactXp(value: number): string {
  const safe = Math.max(0, Math.floor(value));
  if (safe < 1_000) return formatXp(safe);
  if (safe < 1_000_000) return `${compactDecimal.format(Math.floor(safe / 100) / 10)}k`;
  return `${compactDecimal.format(Math.floor(safe / 100_000) / 10)}M`;
}

/** `compact` is the mobile wording, which drops the noun: "Este navegador e mais 2". */
export function formatDeviceSummary(count: number, currentDevice: string, compact = false): string {
  const others = Math.max(0, count - 1);
  if (others === 0) return `Somente ${currentDevice.toLowerCase()}`;
  return compact ? `${currentDevice} e mais ${others}` : `${currentDevice} e mais ${others} ${others === 1 ? 'sessão' : 'sessões'}`;
}
