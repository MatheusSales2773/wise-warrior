import { formatXp } from '@/features/dashboard/formatters';

const compactDecimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

/** Short XP totals for stat tiles: 950, 12,5k, 128,4k, 1,2M. Rounds down so the tile never overstates progress. */
export function formatCompactXp(value: number): string {
  const safe = Math.max(0, Math.floor(value));
  if (safe < 1_000) return formatXp(safe);
  if (safe < 1_000_000) return `${compactDecimal.format(Math.floor(safe / 100) / 10)}k`;
  return `${compactDecimal.format(Math.floor(safe / 100_000) / 10)}M`;
}
