import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { ProgressionService } from '../progression/progression.service';
import { CosmeticCategory, CosmeticItem } from './entities/cosmetic-item.entity';
import { UserCosmeticItem } from './entities/user-cosmetic-item.entity';
import { parseUnlockCondition, UnlockCondition } from './domain/unlock-condition';
import { unlockCosmeticItems } from './cosmetic-unlocks';

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

export interface CatalogItem {
  id: string;
  category: CosmeticCategory;
  name: string;
  requiresPremium: boolean;
  unlocked: boolean;
  equipped: boolean;
  unlockCondition: UnlockCondition;
}

const CATEGORY_ORDER: CosmeticCategory[] = ['avatar', 'badge', 'title', 'accessory'];

/** Ordem estável do Catálogo: categoria, depois condições de nível crescentes e, por último, as de Raid. */
function catalogOrder(a: CatalogItem, b: CatalogItem): number {
  const rank = (condition: UnlockCondition) => (condition.type === 'level' ? condition.level : Number.MAX_SAFE_INTEGER);
  return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    || rank(a.unlockCondition) - rank(b.unlockCondition)
    || a.name.localeCompare(b.name, 'pt-BR');
}

@Injectable()
export class UsersService {
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

  /** Regra de Desbloqueio por nível, na transação de quem chama (criação do Character e level-up). */
  unlockCosmeticItems(manager: EntityManager, userId: string, level: number): Promise<void> {
    return unlockCosmeticItems(manager, userId, level);
  }

  /** O Catálogo inteiro, com o estado de cada item no Inventário do usuário. */
  async listCatalog(userId: string): Promise<CatalogItem[]> {
    const [catalog, inventory] = await Promise.all([
      this.cosmeticItems.find(),
      this.userCosmetics.find({ where: { userId } }),
    ]);
    const owned = new Map(inventory.map((row) => [row.cosmeticItemId, row]));
    return catalog
      .map((item) => ({
        id: item.id,
        category: item.category,
        name: item.name,
        requiresPremium: item.requiresPremium,
        unlocked: owned.has(item.id),
        equipped: owned.get(item.id)?.equipped ?? false,
        unlockCondition: parseUnlockCondition(item.unlockCondition),
      }))
      .sort(catalogOrder);
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
