import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { InsufficientCoinsError } from '../economy/domain/insufficient-coins-error';
import { EconomyService } from '../economy/economy.service';
import { UsersService, type ShopCosmeticItem } from '../users/users.service';

export interface ShopItemDto extends ShopCosmeticItem {
  /** Quantas Moedas faltam para comprar; zero quando o saldo basta ou o item já é do usuário. */
  missing: number;
}

export interface ShopItemsResponse {
  items: ShopItemDto[];
}

export interface ShopPurchaseResponse {
  itemId: string;
  balance: number;
}

@Injectable()
export class ShopService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly economy: EconomyService,
    private readonly users: UsersService,
  ) {}

  async listItems(userId: string): Promise<ShopItemsResponse> {
    const [items, balance] = await Promise.all([this.users.listItemsForSale(userId), this.economy.getBalance(userId)]);
    return {
      items: items.map((item) => ({ ...item, missing: item.owned ? 0 : Math.max(0, item.price - balance) })),
    };
  }

  /**
   * Compra de um Cosmetic Item: desbloqueia e debita na mesma transação, então uma Compra recusada não deixa nada para
   * trás. A linha do usuário é travada antes, para Compras simultâneas se enfileirarem.
   */
  async purchaseItem(userId: string, itemId: string): Promise<ShopPurchaseResponse> {
    const origin = { type: 'purchase', ref: `cosmetic:${itemId}` } as const;
    const result = await this.dataSource.transaction(async (manager) => {
      await this.users.lockForUpdate(userId, manager);
      const { price } = await this.users.unlockPurchasedItem(manager, userId, itemId);
      return this.economy.debit(manager, userId, price, origin);
    }).catch((error: unknown) => {
      if (error instanceof InsufficientCoinsError) {
        throw new UnprocessableEntityException({ message: error.message, missing: error.missing });
      }
      throw error;
    });
    if (result.applied) this.economy.publishBalanceChanged(userId, result);
    return { itemId, balance: result.balance };
  }
}
