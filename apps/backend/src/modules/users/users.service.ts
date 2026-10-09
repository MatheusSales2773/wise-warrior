import {
  forwardRef,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { ProgressionService } from '../progression/progression.service';
import { CosmeticCategory, CosmeticItem } from './entities/cosmetic-item.entity';
import { UserCosmeticItem } from './entities/user-cosmetic-item.entity';
import {
  isStarterItem,
  isUnlockedAtLevel,
  parseUnlockCondition,
  UnlockCondition,
} from './domain/unlock-condition';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  planTier: string;
  level: number;
  xpTotal: number;
  levelStartXp: number;
  nextLevelXp: number;
  /** ADR-010: nome do Cosmetic Item de categoria Título equipado, ou `null`. */
  title: string | null;
  equipped: EquippedCosmeticItem[];
}

export interface EquippedCosmeticItem {
  category: CosmeticCategory;
  itemId: string;
  name: string;
}

export interface CatalogCosmeticItem {
  id: string;
  category: CosmeticCategory;
  name: string;
  requiresPremium: boolean;
  unlocked: boolean;
  equipped: boolean;
  unlockCondition: UnlockCondition;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserCosmeticItem)
    private readonly userCosmetics: Repository<UserCosmeticItem>,
    @InjectRepository(CosmeticItem)
    private readonly cosmeticItems: Repository<CosmeticItem>,
    @Inject(forwardRef(() => ProgressionService))
    private readonly progression: ProgressionService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  /** Serializes work for a user inside the caller's transaction, including the first insert. */
  async lockForUpdate(userId: string, manager: EntityManager): Promise<boolean> {
    const user = await manager.getRepository(User).findOne({
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    return user !== null;
  }

  /**
   * Regra de Desbloqueio: concede todo Cosmetic Item cuja condição de nível seja
   * ≤ `level` e que ainda não esteja no Inventário. Roda na transação de quem
   * chama e é idempotente pelo índice único (usuário + item).
   */
  async unlockCosmeticItems(manager: EntityManager, userId: string, level: number): Promise<void> {
    const unlocked = (await this.readCatalog(manager.getRepository(CosmeticItem)))
      .filter(({ condition }) => isUnlockedAtLevel(condition, level));
    if (unlocked.length === 0) return;
    await manager
      .createQueryBuilder()
      .insert()
      .into(UserCosmeticItem)
      .values(unlocked.map(({ item }) => ({ userId, cosmeticItemId: item.id, equipped: false })))
      // Só a linha repetida (usuário + item) é tolerada; qualquer outro erro continua sendo erro.
      .orUpdate(['cosmetic_item_id'], ['user_id', 'cosmetic_item_id'])
      .execute();
  }

  /** Inventário de um Character recém-criado: os Itens iniciais, já equipados. */
  async grantStarterInventory(manager: EntityManager, userId: string): Promise<void> {
    await this.unlockCosmeticItems(manager, userId, 1);
    const inventory = manager.getRepository(UserCosmeticItem);
    const starters = (await inventory.find({ where: { userId }, relations: ['cosmeticItem'] }))
      .filter((row) => {
        const condition = parseUnlockCondition(row.cosmeticItem.unlockCondition);
        return condition !== null && isStarterItem(condition);
      });
    const equippedCategories = new Set<CosmeticCategory>();
    for (const starter of starters) {
      // No máximo um item equipado por categoria, mesmo que o Catálogo ganhe outro Item inicial nela.
      if (equippedCategories.has(starter.cosmeticItem.category)) continue;
      equippedCategories.add(starter.cosmeticItem.category);
      await inventory.update({ id: starter.id }, { equipped: true });
    }
  }

  /** O Catálogo inteiro, com o estado de cada item no Inventário do usuário. A interface define a ordem. */
  async listCatalog(userId: string): Promise<CatalogCosmeticItem[]> {
    const [catalog, inventory] = await Promise.all([
      this.readCatalog(this.cosmeticItems),
      this.userCosmetics.find({ where: { userId } }),
    ]);
    const owned = new Map(inventory.map((row) => [row.cosmeticItemId, row]));
    return catalog.map(({ item, condition }) => ({
      id: item.id,
      category: item.category,
      name: item.name,
      requiresPremium: item.requiresPremium,
      unlocked: owned.has(item.id),
      equipped: owned.get(item.id)?.equipped ?? false,
      unlockCondition: condition,
    }));
  }

  /** Itens com Condição de desbloqueio fora do formato ficam fora do Catálogo, sem derrubar o resto. */
  private async readCatalog(
    repository: Repository<CosmeticItem>,
  ): Promise<Array<{ item: CosmeticItem; condition: UnlockCondition }>> {
    const catalog = await repository.find();
    return catalog.flatMap((item) => {
      const condition = parseUnlockCondition(item.unlockCondition);
      if (condition === null) {
        this.logger.warn(`Cosmetic Item ${item.id} ignorado: condição de desbloqueio inválida "${item.unlockCondition}"`);
        return [];
      }
      return [{ item, condition }];
    });
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const [character, equippedRows] = await Promise.all([
      this.progression.getCharacterSnapshot(userId),
      this.userCosmetics.find({ where: { userId, equipped: true }, relations: ['cosmeticItem'] }),
    ]);
    const equipped = equippedRows.map(({ cosmeticItem }) => ({
      category: cosmeticItem.category,
      itemId: cosmeticItem.id,
      name: cosmeticItem.name,
    }));
    const xpTotal = character?.xpTotal ?? 0;
    const projection = this.progression.getProjection(xpTotal);
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      planTier: user.planTier,
      level: projection.level,
      xpTotal,
      levelStartXp: projection.levelStartXp,
      nextLevelXp: projection.nextLevelXp,
      title: equipped.find((item) => item.category === 'title')?.name ?? null,
      equipped,
    };
  }

  /**
   * Política de entitlement do MVP (ADR-007): enquanto `COSMETICS_PREMIUM_FOR_ALL` não for
   * `false`, os itens premium ficam liberados para todos. A checagem continua no caminho de Equipar.
   */
  private premiumReleasedToEveryone(): boolean {
    return this.config?.get<string>('COSMETICS_PREMIUM_FOR_ALL') !== 'false';
  }

  /**
   * Equipa um item do Inventário e desequipa o da mesma categoria. A transação trava a linha do
   * usuário, então requisições simultâneas se serializam e sempre sobra um único item equipado.
   */
  async equipCosmeticItem(userId: string, cosmeticItemId: string): Promise<void> {
    await this.users.manager.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      const inventory = manager.getRepository(UserCosmeticItem);
      const target = user
        ? await inventory.findOne({ where: { userId, cosmeticItemId }, relations: ['cosmeticItem'] })
        : null;
      if (!user || !target) {
        throw new NotFoundException('Item não desbloqueado por este usuário');
      }
      if (target.cosmeticItem.requiresPremium && user.planTier !== 'premium' && !this.premiumReleasedToEveryone()) {
        throw new ForbiddenException('Item exclusivo do plano premium');
      }

      const sameCategory = await inventory.find({
        where: { userId, equipped: true, cosmeticItem: { category: target.cosmeticItem.category } },
      });
      const others = sameCategory.filter((row) => row.id !== target.id).map((row) => row.id);
      if (others.length > 0) {
        await inventory.update(others, { equipped: false });
      }
      await inventory.update({ id: target.id }, { equipped: true });
    });
  }

  /** Desequipa um item do Inventário; repetir a chamada não muda nada. */
  async unequipCosmeticItem(userId: string, cosmeticItemId: string): Promise<void> {
    await this.users.manager.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      const inventory = manager.getRepository(UserCosmeticItem);
      const row = user ? await inventory.findOne({ where: { userId, cosmeticItemId } }) : null;
      if (!row) {
        throw new NotFoundException('Item não desbloqueado por este usuário');
      }
      await inventory.update({ id: row.id }, { equipped: false });
    });
  }
}
