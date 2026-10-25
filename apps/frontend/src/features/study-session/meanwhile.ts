import { formatXp } from '@/features/dashboard/formatters';
import type { SessionsObjective } from '@/features/chronicles/queries';

/** The "meta de N sessões" line of "Enquanto isso"; none once the Objetivo is done. Counts this session as done. */
export function goalLine(objective: SessionsObjective | undefined): string | null {
  if (!objective || objective.progress >= objective.target) return null;
  const left = objective.target - objective.progress - 1;
  if (left <= 0) return `Concluindo esta, você bate a meta de ${objective.target}.`;
  return `Concluindo esta, ${left === 1 ? 'falta 1 sessão' : `faltam ${left} sessões`} para a meta de ${objective.target}.`;
}

/** The XP still missing for the next level; none when the profile is unknown or the level is already reached. */
export function levelLine(profile: { xpTotal: number; nextLevelXp: number; level: number } | undefined): string | null {
  if (!profile) return null;
  const left = profile.nextLevelXp - profile.xpTotal;
  return left > 0 ? `Faltam ${formatXp(left)} XP para o nível ${profile.level + 1}.` : null;
}
