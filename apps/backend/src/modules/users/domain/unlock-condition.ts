/** Condição de desbloqueio de um Cosmetic Item, na forma estruturada que a API devolve. */
export type UnlockCondition =
  | { type: 'level'; level: number }
  /** `slug` é o da Missão (`raid:vigilia-da-aurora`); `*` vale para qualquer Raid. */
  | { type: 'raid'; slug: string };

/** Lê a forma persistida (`level:5`, `raid:<slug>`). Devolve `null` para um valor fora desse formato. */
export function parseUnlockCondition(raw: string): UnlockCondition | null {
  const level = /^level:([1-9]\d*)$/.exec(raw);
  if (level) return { type: 'level', level: Number(level[1]) };
  const slug = /^raid:(.+)$/.exec(raw)?.[1];
  if (slug) return { type: 'raid', slug };
  return null;
}

/** Regra de Desbloqueio por nível. Condições de Raid só são cumpridas pelas Raids (#20/#21). */
export function isUnlockedAtLevel(condition: UnlockCondition, level: number): boolean {
  return condition.type === 'level' && condition.level <= level;
}

/** Item inicial: a condição é o nível 1, então todo Character começa com ele. */
export function isStarterItem(condition: UnlockCondition): boolean {
  return condition.type === 'level' && condition.level === 1;
}
