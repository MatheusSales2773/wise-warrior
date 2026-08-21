/**
 * Regras de progressão RPG (camada de Domínio — sem I/O, conforme
 * Documento de Arquitetura seção 3.1: "Domínio não conhece infraestrutura").
 *
 * Fórmula de referência (UC04/RN01): XP necessário para o nível N é
 * `xp_base × N^1.5`, com `xp_base = 500`. O caso de uso original não deixa
 * explícito se o valor é cumulativo ou incremental; aqui ele é tratado como
 * o total cumulativo de XP necessário para alcançar o nível N, com o nível 1
 * como ponto de partida (0 XP) — interpretação que preserva a fórmula
 * literal do UC04 sem contradizer "todo personagem começa no nível 1".
 */

const XP_BASE = 500;

export function xpThresholdForLevel(level: number): number {
  if (level <= 1) {
    return 0;
  }
  return Math.round(XP_BASE * level ** 1.5);
}

export function levelForXp(xpTotal: number): number {
  if (xpTotal < 0) {
    throw new Error('xpTotal não pode ser negativo');
  }

  let level = 1;
  while (xpTotal >= xpThresholdForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

export interface XpApplicationResult {
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  newXpTotal: number;
}

export function applyXp(
  currentXpTotal: number,
  xpGained: number,
): XpApplicationResult {
  if (xpGained < 0) {
    throw new Error('xpGained não pode ser negativo');
  }

  const previousLevel = levelForXp(currentXpTotal);
  const newXpTotal = currentXpTotal + xpGained;
  const newLevel = levelForXp(newXpTotal);

  return {
    previousLevel,
    newLevel,
    leveledUp: newLevel > previousLevel,
    newXpTotal,
  };
}
