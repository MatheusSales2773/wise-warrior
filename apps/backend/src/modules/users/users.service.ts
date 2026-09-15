import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { ProgressionService } from '../progression/progression.service';
import { CosmeticItem } from './entities/cosmetic-item.entity';
import { UserCosmeticItem } from './entities/user-cosmetic-item.entity';

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
