/** Condição de desbloqueio de um Cosmetic Item, na forma estruturada que a API devolve. */
export type UnlockCondition =
  | { type: 'level'; level: number }
  /** `slug` é o da Missão (`raid:vigilia-da-aurora`); `*` vale para qualquer Raid. */
  | { type: 'raid'; slug: string }
  /** Item da Loja (ADR-012): só a Compra o desbloqueia. */
  | { type: 'purchase' }
  /** Badge por hábito de estudo: `count` Study Sessions não descartadas. */
  | { type: 'sessions'; count: number }
  /** Badge por hábito de estudo: `count` Study Sessions terminadas antes das 7h de São Paulo. */
  | { type: 'early-sessions'; count: number };

/** Quantas Study Sessions do usuário cumprem cada Condição de desbloqueio por contagem. */
export interface SessionCounts {
  /** Study Sessions não descartadas que terminaram. */
  sessions: number;
  /** As desse total que terminaram antes das 7h de São Paulo. */
  earlySessions: number;
}

/** Lê a forma persistida (`level:5`, `raid:<slug>`, `purchase`, `sessions:100`, `early-sessions:5`). Devolve `null` para um valor fora desse formato. */
export function parseUnlockCondition(raw: string): UnlockCondition | null {
  const level = /^level:([1-9]\d*)$/.exec(raw);
  if (level) return { type: 'level', level: Number(level[1]) };
  if (raw === 'purchase') return { type: 'purchase' };
  const sessions = /^sessions:([1-9]\d*)$/.exec(raw);
  if (sessions) return { type: 'sessions', count: Number(sessions[1]) };
  const earlySessions = /^early-sessions:([1-9]\d*)$/.exec(raw);
  if (earlySessions) return { type: 'early-sessions', count: Number(earlySessions[1]) };
  const slug = /^raid:(.+)$/.exec(raw)?.[1];
  if (slug) return { type: 'raid', slug };
  return null;
}

/** Regra de Desbloqueio por nível. Condições de Raid só são cumpridas pelas Raids (#117). */
export function isUnlockedAtLevel(condition: UnlockCondition, level: number): boolean {
  return condition.type === 'level' && condition.level <= level;
}

/** Regra de Desbloqueio por contagem de Study Sessions, avaliada no término de cada sessão. */
export function isUnlockedBySessionCounts(condition: UnlockCondition, counts: SessionCounts): boolean {
  if (condition.type === 'sessions') return condition.count <= counts.sessions;
  if (condition.type === 'early-sessions') return condition.count <= counts.earlySessions;
  return false;
}

/** Item inicial: a condição é o nível 1, então todo Character começa com ele. */
export function isStarterItem(condition: UnlockCondition): boolean {
  return condition.type === 'level' && condition.level === 1;
}
