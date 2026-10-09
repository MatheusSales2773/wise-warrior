import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
  title: string | null;
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
    private readonly progression: ProgressionService,
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
    const character = await this.progression.getCharacterSnapshot(userId);
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
      title: character?.title ?? null,
    };
  }

  /**
   * Equipa um item cosmético já desbloqueado pelo usuário. Itens marcados
   * como premium (Pitch) exigem `plan_tier = premium` — checagem de flag de
   * entitlement (ADR-007), sem gateway de pagamento nesta fase.
   */
  async equipCosmeticItem(userId: string, cosmeticItemId: string): Promise<void> {
    const target = await this.userCosmetics.findOne({
      where: { userId, cosmeticItemId },
      relations: ['cosmeticItem'],
    });
    if (!target) {
      throw new NotFoundException('Item não desbloqueado por este usuário');
    }

    if (target.cosmeticItem.requiresPremium) {
      const user = await this.users.findOne({ where: { id: userId } });
      if (user?.planTier !== 'premium') {
        throw new ForbiddenException('Item exclusivo do plano premium');
      }
    }

    // No máximo um item equipado por categoria (ex.: um avatar, um título).
    const equipped = await this.userCosmetics.find({
      where: { userId, equipped: true },
      relations: ['cosmeticItem'],
    });
    const sameCategory = equipped.filter(
      (item) => item.cosmeticItem.category === target.cosmeticItem.category,
    );
    if (sameCategory.length > 0) {
      await this.userCosmetics.save(
        sameCategory.map((item) => ({ ...item, equipped: false })),
      );
    }

    target.equipped = true;
    await this.userCosmetics.save(target);
  }
}
