import type { SessionCounts, UnlockCondition } from './unlock-condition';

/**
 * Os Badges que são Marcos (ADR-014), na ordem em que Crônicas os mostra: Madrugador, Cem Sessões, Marcador do Grimório
 * e Brasão da Forja. Os Badges das Missões da Loja não entram.
 */
export const MILESTONE_BADGE_IDS = [
  'c05e71c0-0000-4000-8000-000000000003',
  'c05e71c0-0000-4000-8000-000000000006',
  'c05e71c0-0000-4000-8000-000000000009',
  'c05e71c0-0000-4000-8000-00000000000b',
] as const;

/** O avanço de um Marco (ADR-014) até a Condição de desbloqueio do Badge: `progress` de `target`, com `progress` limitado a `target`. */
export interface MilestoneProgress {
  progress: number;
  target: number;
}

/**
 * O progresso de um Badge até a sua Condição de desbloqueio. Um Badge já no Inventário está completo, mesmo que as
 * contagens atuais digam menos (Badges concedidos pela regra antiga de nível). Uma Raid vale 0 de 1 ou 1 de 1.
 * `null` para uma Condição que não é de Marco (nível, Compra).
 */
export function milestoneProgress(condition: UnlockCondition, counts: SessionCounts, owned: boolean): MilestoneProgress | null {
  if (condition.type === 'raid') return { progress: owned ? 1 : 0, target: 1 };
  if (condition.type !== 'sessions' && condition.type !== 'early-sessions') return null;
  const current = condition.type === 'sessions' ? counts.sessions : counts.earlySessions;
  return { progress: owned ? condition.count : Math.min(current, condition.count), target: condition.count };
}
