/** Condição de desbloqueio de um Cosmetic Item, na forma estruturada que a API devolve. */
export type UnlockCondition =
  | { type: 'level'; level: number }
  /** `slug` `*` vale para qualquer Raid. */
  | { type: 'raid'; slug: string };

/** Lê a forma persistida (`level:5`, `raid:<slug>`). */
export function parseUnlockCondition(raw: string): UnlockCondition {
  const level = /^level:([1-9]\d*)$/.exec(raw);
  if (level) return { type: 'level', level: Number(level[1]) };
  const slug = /^raid:(.+)$/.exec(raw)?.[1];
  if (slug) return { type: 'raid', slug };
  throw new Error(`Condição de desbloqueio inválida: ${raw}`);
}

/** Regra de Desbloqueio por nível. Condições de Raid só são cumpridas pelas Raids (#20/#21). */
export function isUnlockedAtLevel(condition: UnlockCondition, level: number): boolean {
  return condition.type === 'level' && condition.level <= level;
}
