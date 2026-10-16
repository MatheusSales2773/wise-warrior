import { ConflictException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, In, IsNull, Not, QueryFailedError, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { Mission } from './entities/mission.entity';
import { MissionRewardItem } from './entities/mission-reward-item.entity';
import { UserMission } from './entities/user-mission.entity';

export interface MissionReward {
  id: string;
  name: string;
  category: string;
}

export interface PricedMission {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  reward: MissionReward;
  owned: boolean;
}

/**
 * Dono da posse de Missões (ADR-012). As Missões do rodízio (sem preço) são grátis, ficam fora da Loja e todo
 * usuário as possui; as demais pertencem a quem as comprou, para sempre.
 */
@Injectable()
export class MissionsService {
  constructor(
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    @InjectRepository(UserMission) private readonly ownerships: Repository<UserMission>,
    @InjectRepository(MissionRewardItem) private readonly rewardItems: Repository<MissionRewardItem>,
    @Inject(forwardRef(() => UsersService)) private readonly users: UsersService,
  ) {}

  /** As Missões à venda, das mais baratas às mais caras, com a posse do usuário. */
  async listPriced(userId: string): Promise<PricedMission[]> {
    const missions = await this.missions.find({ where: { price: Not(IsNull()) }, order: { price: 'ASC', slug: 'ASC' } });
    if (missions.length === 0) return [];
    // A Loja mostra o primeiro item da Missão, como a Raid ativa; o fechamento concede todos.
    const rewardRows = await this.rewardItems.find({
      where: { missionId: In(missions.map((mission) => mission.id)) },
      order: { cosmeticItemId: 'ASC' },
    });
    const firstRewardId = new Map<string, string>();
    for (const row of rewardRows) if (!firstRewardId.has(row.missionId)) firstRewardId.set(row.missionId, row.cosmeticItemId);
    const [owned, rewards] = await Promise.all([
      this.ownerships.find({ where: { userId } }),
      this.users.findCosmeticItems([...firstRewardId.values()]),
    ]);
    const ownedIds = new Set(owned.map((row) => row.missionId));
    const rewardById = new Map(rewards.map((reward) => [reward.id, reward]));
    return missions.map((mission) => {
      const reward = rewardById.get(firstRewardId.get(mission.id) ?? '');
      if (!reward) throw new Error(`Recompensa da Missão ${mission.slug} não encontrada`);
      return {
        id: mission.id,
        slug: mission.slug,
        name: mission.name,
        description: mission.description,
        imageUrl: mission.imageUrl,
        price: mission.price!,
        reward,
        owned: ownedIds.has(mission.id),
      };
    });
  }

  /** O catálogo inteiro, rodízio e à venda, para quem monta a escolha do Líder. */
  listAll(): Promise<Mission[]> {
    return this.missions.find({ order: { rotationOrder: 'ASC', price: 'ASC', slug: 'ASC' } });
  }

  findById(missionId: string): Promise<Mission | null> {
    return this.missions.findOne({ where: { id: missionId } });
  }

  /** Quem entre `userIds` possui cada Missão à venda (a posse das Missões do rodízio é de todos e não tem linha). */
  async ownersOf(userIds: string[]): Promise<Map<string, string[]>> {
    const owners = new Map<string, string[]>();
    if (userIds.length === 0) return owners;
    for (const { missionId, userId } of await this.ownerships.find({ where: { userId: In(userIds) }, order: { acquiredAt: 'ASC' } })) {
      owners.set(missionId, [...(owners.get(missionId) ?? []), userId]);
    }
    return owners;
  }

  async owns(userId: string, missionId: string): Promise<boolean> {
    return this.ownerships.exists({ where: { userId, missionId } });
  }

  /**
   * Registra a posse na transação de quem chama, junto com o débito. Missão inexistente ou do rodízio → 404;
   * já possuída → 409 (a unicidade do par decide, então duas Compras simultâneas não passam as duas).
   * Devolve o preço a debitar.
   */
  async claimForPurchase(manager: EntityManager, userId: string, missionId: string): Promise<number> {
    const mission = await manager.findOne(Mission, { where: { id: missionId } });
    if (!mission || mission.price === null) {
      throw new NotFoundException('Missão não está à venda');
    }
    try {
      await manager.insert(UserMission, { userId, missionId });
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string } | undefined)?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Você já possui esta Missão');
      }
      throw error;
    }
    return mission.price;
  }
}
