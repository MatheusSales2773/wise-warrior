import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InsufficientCoinsError } from '../economy/domain/insufficient-coins-error';
import { EconomyService } from '../economy/economy.service';
import { MissionsService, type PricedMission } from '../raids/missions.service';
import { UsersService, type ShopCosmeticItem } from '../users/users.service';

export type StoreState = 'owned' | 'purchasable' | 'insufficient';

export interface StoreMission extends Omit<PricedMission, 'owned'> {
  state: StoreState;
  /** Moedas que faltam para comprar; 0 quando já possui ou o saldo basta. */
  missing: number;
}

export interface MissionPurchase {
  missionId: string;
  price: number;
  balance: number;
}

/** Loja, seção Itens: um Cosmetic Item À venda, com o estado para o usuário. */
export interface StoreItem extends Omit<ShopCosmeticItem, 'owned'> {
  state: StoreState;
  /** Moedas que faltam para comprar; 0 quando já possui ou o saldo basta. */
  missing: number;
}

export interface ItemPurchase {
  itemId: string;
  price: number;
  balance: number;
}

function missionState(owned: boolean, missing: number): StoreState {
  if (owned) return 'owned';
  return missing > 0 ? 'insufficient' : 'purchasable';
}

/** A Loja (ADR-012): compõe o catálogo e a posse (raids) com o saldo (economy). Não toca tabelas de outros módulos. */
@Injectable()
export class ShopService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly missions: MissionsService,
    private readonly economy: EconomyService,
    private readonly users: UsersService,
  ) {}

  async listMissions(userId: string): Promise<StoreMission[]> {
    const [missions, balance] = await Promise.all([this.missions.listPriced(userId), this.economy.getBalance(userId)]);
    return missions.map(({ owned, ...mission }) => {
      const missing = owned ? 0 : Math.max(0, mission.price - balance);
      return { ...mission, state: missionState(owned, missing), missing };
    });
  }

  /** Débito e posse numa transação só: sem saldo (422) ou já possuída (409), nada muda. */
  async purchaseMission(userId: string, missionId: string): Promise<MissionPurchase> {
    try {
      const { price, movement } = await this.dataSource.transaction(async (manager) => {
        const missionPrice = await this.missions.claimForPurchase(manager, userId, missionId);
        const result = await this.economy.debit(manager, userId, missionPrice, { type: 'purchase', ref: `mission:${missionId}` });
        return { price: missionPrice, movement: result };
      });
      if (movement.applied) this.economy.publishBalanceChanged(userId, movement);
      return { missionId, price, balance: movement.balance };
    } catch (error) {
      if (error instanceof InsufficientCoinsError) {
        throw new UnprocessableEntityException({ message: error.message, missing: error.missing });
      }
      throw error;
    }
  }

  async listItems(userId: string): Promise<StoreItem[]> {
    const [items, balance] = await Promise.all([this.users.listItemsForSale(userId), this.economy.getBalance(userId)]);
    return items.map(({ owned, ...item }) => {
      const missing = owned ? 0 : Math.max(0, item.price - balance);
      return { ...item, state: missionState(owned, missing), missing };
    });
  }

  /**
   * Compra de um Cosmetic Item (a Condição de desbloqueio `purchase`): desbloqueia e debita na mesma transação. A
   * linha do usuário é travada antes, para Compras simultâneas se enfileirarem. Não está À venda: 404; já possui: 409;
   * sem saldo: 422, e nada muda.
   */
  async purchaseItem(userId: string, itemId: string): Promise<ItemPurchase> {
    try {
      const { price, movement } = await this.dataSource.transaction(async (manager) => {
        await this.users.lockForUpdate(userId, manager);
        const { price: itemPrice } = await this.users.unlockPurchasedItem(manager, userId, itemId);
        const result = await this.economy.debit(manager, userId, itemPrice, { type: 'purchase', ref: `cosmetic:${itemId}` });
        return { price: itemPrice, movement: result };
      });
      if (movement.applied) this.economy.publishBalanceChanged(userId, movement);
      return { itemId, price, balance: movement.balance };
    } catch (error) {
      if (error instanceof InsufficientCoinsError) {
        throw new UnprocessableEntityException({ message: error.message, missing: error.missing });
      }
      throw error;
    }
  }
}
