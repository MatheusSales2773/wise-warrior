import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Mission } from './entities/mission.entity';
import { Raid } from './entities/raid.entity';
import { RAID_CLOCK, type RaidClock } from './raid-clock';
import { missionIndexForWeek, proportionalGoalXp, raidWeekAt } from './domain/raid-week';
import { UsersService } from '../users/users.service';
import { RaidContribution } from './entities/raid-contribution.entity';
import { GuildsService } from '../guilds/guilds.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface RaidDetail {
  id: string;
  title: string;
  goalXp: number;
  progressXp: number;
  endsAt: Date;
  status: string;
}

export interface ActiveRaid {
  id: string;
  mission: { slug: string; name: string; description: string; imageUrl: string | null };
  reward: { itemId: string; name: string; category: string };
  goalXp: number;
  progressXp: number;
  startsAt: Date;
  endsAt: Date;
  status: string;
}

@Injectable()
export class RaidsService {
  constructor(
    @InjectRepository(Raid) private readonly raids: Repository<Raid>,
    @InjectRepository(RaidContribution)
    private readonly contributions: Repository<RaidContribution>,
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    @Inject(forwardRef(() => GuildsService))
    private readonly guilds: GuildsService,
    private readonly users: UsersService,
    private readonly realtime: RealtimeGateway,
    @Inject(RAID_CLOCK) private readonly clock: RaidClock,
  ) {}

  /**
   * Opens the Raid of the current week for a Guild, in the caller's transaction. The Missão comes from the
   * weekly rotation and the goal is frozen from the member count at this moment.
   */
  async createForGuild(manager: EntityManager, guildId: string, memberCount: number): Promise<Raid> {
    const now = this.clock();
    const week = raidWeekAt(now);
    const catalog = await manager.find(Mission, { order: { rotationOrder: 'ASC' } });
    const mission = catalog[missionIndexForWeek(week.number, catalog.length)];
    if (!mission) {
      throw new Error('Catálogo de Missões vazio');
    }
    return manager.save(
      manager.create(Raid, {
        guildId,
        missionId: mission.id,
        goalXp: proportionalGoalXp(memberCount, week, now),
        progressXp: 0,
        startsAt: week.startsAt,
        endsAt: week.endsAt,
        status: 'active',
      }),
    );
  }

  /** The Guild's Raid for the current week. Only members may see it. */
  async findActive(guildId: string, requesterId: string): Promise<ActiveRaid> {
    if (!(await this.guilds.isMember(guildId, requesterId))) {
      throw new ForbiddenException('Apenas membros da guilda podem ver a Raid');
    }
    const now = this.clock();
    const raid = await this.raids
      .createQueryBuilder('raid')
      .innerJoinAndSelect('raid.mission', 'mission')
      .where('raid.guildId = :guildId', { guildId })
      // `completed` still belongs to the current week: the goal being reached must not hide the Raid.
      .andWhere("raid.status IN ('active', 'completed')")
      .andWhere('raid.startsAt <= :now', { now })
      .andWhere('raid.endsAt >= :now', { now })
      .orderBy('raid.startsAt', 'DESC')
      .getOne();
    if (!raid) {
      throw new NotFoundException('A guilda não tem Raid ativa');
    }
    const [item] = await this.users.findCosmeticItems([raid.mission.rewardCosmeticItemId]);
    if (!item) {
      throw new Error(`Recompensa da Missão ${raid.mission.slug} não encontrada`);
    }
    return {
      id: raid.id,
      mission: {
        slug: raid.mission.slug,
        name: raid.mission.name,
        description: raid.mission.description,
        imageUrl: raid.mission.imageUrl,
      },
      reward: { itemId: item.id, name: item.name, category: item.category },
      goalXp: raid.goalXp,
      progressXp: raid.progressXp,
      startsAt: raid.startsAt,
      endsAt: raid.endsAt,
      status: raid.status,
    };
  }

  async findById(userId: string, raidId: string): Promise<RaidDetail> {
    const raid = await this.findRaidForMember(userId, raidId);
    return {
      id: raid.id,
      title: raid.mission.name,
      goalXp: raid.goalXp,
      progressXp: raid.progressXp,
      endsAt: raid.endsAt,
      status: raid.status,
    };
  }

  /** UC02 fluxo básico: usuário confirma participação numa raid ativa da sua guilda. */
  async join(userId: string, raidId: string): Promise<void> {
    const raid = await this.raids.findOne({ where: { id: raidId } });
    if (!raid) {
      throw new NotFoundException('Raid não encontrada');
    }
    if (this.isExpired(raid)) {
      throw new ForbiddenException('Raid expirada'); // UC02 (A01) — Raid Expirada
    }
    const member = await this.guilds.isMember(raid.guildId, userId);
    if (!member) {
      throw new ForbiddenException('Usuário não pertence à guilda desta raid');
    }
    // "Participar" não precisa de uma tabela própria nesta fase — a
    // participação é implícita na primeira contribuição registrada.
  }

  /**
   * RN01 (UC02): só sessões concluídas dentro do período oficial da raid
   * contam como contribuição. Chamado pelo SessionsService após a validação
   * antifraude — nunca recebe XP não-validado.
   */
  async recordContribution(
    raidId: string,
    userId: string,
    studySessionId: string,
    xpContributed: number,
  ): Promise<void> {
    const raid = await this.raids.findOne({ where: { id: raidId } });
    if (!raid) {
      throw new NotFoundException('Raid não encontrada');
    }
    if (this.isExpired(raid)) {
      // (E01)/(A01) — contribuição fora da janela oficial não é contabilizada.
      return;
    }

    await this.contributions.save(
      this.contributions.create({ raidId, userId, studySessionId, xpContributed }),
    );
    raid.progressXp += xpContributed;
    if (raid.progressXp >= raid.goalXp) {
      raid.status = 'completed';
    }
    await this.raids.save(raid);

    this.realtime.emitToGuild(raid.guildId, 'raid:progress', {
      raidId: raid.id,
      progressXp: raid.progressXp,
      goalXp: raid.goalXp,
      status: raid.status,
    });
  }

  async ranking(
    userId: string,
    raidId: string,
  ): Promise<Array<{ userId: string; xpContributed: number }>> {
    await this.findRaidForMember(userId, raidId);
    const rows = await this.contributions
      .createQueryBuilder('contribution')
      .select('contribution.userId', 'userId')
      .addSelect('SUM(contribution.xpContributed)', 'xpContributed')
      .where('contribution.raidId = :raidId', { raidId })
      .groupBy('contribution.userId')
      .orderBy('xpContributed', 'DESC')
      .getRawMany<{ userId: string; xpContributed: string }>();

    return rows.map((row) => ({
      userId: row.userId,
      xpContributed: Number(row.xpContributed),
    }));
  }

  private isExpired(raid: Raid): boolean {
    return raid.status !== 'active' || raid.endsAt.getTime() < Date.now();
  }

  /** Detalhe e ranking são só dos membros da Guild da Raid. */
  private async findRaidForMember(userId: string, raidId: string): Promise<Raid> {
    const raid = await this.raids.findOne({ where: { id: raidId }, relations: ['mission'] });
    if (!raid) {
      throw new NotFoundException('Raid não encontrada');
    }
    if (!(await this.guilds.isMember(raid.guildId, userId))) {
      throw new ForbiddenException('Usuário não pertence à guilda desta raid');
    }
    return raid;
  }
}
