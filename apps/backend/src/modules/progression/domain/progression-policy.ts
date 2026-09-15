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
const MAX_LEVEL_ADJUSTMENTS = 4;
export const MAX_SUPPORTED_XP_TOTAL = 9_000_000_000_000_000;

export function validateXpTotal(xpTotal: number, fieldName = 'xpTotal'): void {
  if (
    !Number.isFinite(xpTotal) ||
    !Number.isSafeInteger(xpTotal) ||
    xpTotal < 0 ||
    xpTotal > MAX_SUPPORTED_XP_TOTAL
  ) {
    throw new Error(`${fieldName} deve ser um inteiro seguro não negativo`);
  }
}

export function xpThresholdForLevel(level: number): number {
  if (level <= 1) {
    return 0;
  }
  return Math.round(XP_BASE * level ** 1.5);
}

export function levelForXp(xpTotal: number): number {
  return levelForXpWithStats(xpTotal).level;
}

export interface LevelForXpStats {
  level: number;
  thresholdComparisons: number;
}

/**
 * Estimates the level from the inverse formula, then corrects rounding at the
 * neighboring thresholds. The stats make the bounded lookup observable in
 * domain tests without changing the public level projection contract.
 */
export function levelForXpWithStats(xpTotal: number): LevelForXpStats {
  validateXpTotal(xpTotal);

  let candidateLevel = Math.max(
    1,
    Math.floor((xpTotal / XP_BASE) ** (2 / 3)),
  );
  let thresholdComparisons = 0;
  const thresholdAt = (level: number): number => {
    thresholdComparisons += 1;
    return xpThresholdForLevel(level);
  };

  for (let adjustment = 0; adjustment < MAX_LEVEL_ADJUSTMENTS; adjustment += 1) {
    if (candidateLevel > 1 && thresholdAt(candidateLevel) > xpTotal) {
      candidateLevel -= 1;
      continue;
    }

    if (thresholdAt(candidateLevel + 1) <= xpTotal) {
      candidateLevel += 1;
      continue;
    }

    return {
      level: candidateLevel,
      thresholdComparisons,
    };
  }

  throw new Error('não foi possível resolver o nível de XP');
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
  validateXpTotal(currentXpTotal, 'currentXpTotal');
  validateXpTotal(xpGained, 'xpGained');
  if (currentXpTotal > MAX_SUPPORTED_XP_TOTAL - xpGained) {
    throw new Error('total de XP excede o limite suportado');
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
