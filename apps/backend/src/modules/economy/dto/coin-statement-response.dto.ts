import type { CoinOriginType } from '../domain/coin-origin';

export class CoinBalanceResponseDto {
  balance: number;
}

export class CoinOriginDto {
  type: CoinOriginType;
  ref: string;
}

export class CoinStatementItemDto {
  id: string;
  /** Positivo para crédito, negativo para débito. */
  amount: number;
  balanceAfter: number;
  origin: CoinOriginDto;
  /** ISO 8601, em UTC. */
  createdAt: string;
}

export class CoinStatementPageDto {
  items: CoinStatementItemDto[];
  nextCursor: string | null;
}
