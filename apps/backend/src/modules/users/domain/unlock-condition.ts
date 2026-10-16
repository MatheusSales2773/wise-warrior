/** Condição de desbloqueio de um Cosmetic Item, na forma estruturada que a API devolve. */
export type UnlockCondition =
  | { type: 'level'; level: number }
  /** `slug` é o da Missão (`raid:vigilia-da-aurora`); `*` vale para qualquer Raid. */
  | { type: 'raid'; slug: string }
  /** Item da Loja (ADR-012): só a Compra o desbloqueia. */
  | { type: 'purchase' };

/** Lê a forma persistida (`level:5`, `raid:<slug>`, `purchase`). Devolve `null` para um valor fora desse formato. */
export function parseUnlockCondition(raw: string): UnlockCondition | null {
  const level = /^level:([1-9]\d*)$/.exec(raw);
  if (level) return { type: 'level', level: Number(level[1]) };
  if (raw === 'purchase') return { type: 'purchase' };
  const slug = /^raid:(.+)$/.exec(raw)?.[1];
  if (slug) return { type: 'raid', slug };
  return null;
}

/** Regra de Desbloqueio por Raid (#117): a Raid vencida da Missão `missionSlug`, ou qualquer Raid com `raid:*`. */
export function isUnlockedByRaid(condition: UnlockCondition, missionSlug: string): boolean {
  return condition.type === 'raid' && (condition.slug === missionSlug || condition.slug === '*');
}

/** Regra de Desbloqueio por nível. Condições de Raid só são cumpridas pelas Raids (#117). */
export function isUnlockedAtLevel(condition: UnlockCondition, level: number): boolean {
  return condition.type === 'level' && condition.level <= level;
}

/** Item inicial: a condição é o nível 1, então todo Character começa com ele. */
export function isStarterItem(condition: UnlockCondition): boolean {
  return condition.type === 'level' && condition.level === 1;
}
