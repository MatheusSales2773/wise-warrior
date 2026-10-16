/** Origens de crédito e débito da Moeda (ADR-012). Cada origem vale uma vez por usuário. */
export const COIN_ORIGIN_TYPES = ['study-session', 'raid-win', 'purchase', 'signup', 'migration'] as const;

export type CoinOriginType = (typeof COIN_ORIGIN_TYPES)[number];

export interface CoinOrigin {
  type: CoinOriginType;
  ref: string;
}

export interface CoinMovementResult {
  /** `false` quando a origem já foi aplicada ou o valor é zero: nada mudou. */
  applied: boolean;
  balance: number;
  /** Positivo para crédito, negativo para débito, zero quando nada mudou. */
  delta: number;
  origin: CoinOrigin;
}
