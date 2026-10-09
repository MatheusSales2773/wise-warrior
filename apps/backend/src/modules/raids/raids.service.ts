import {
  ConflictException,
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
import { RaidParticipation } from './entities/raid-participation.entity';
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
  goalReachedAt: Date | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
  me: { participating: boolean; contributionXp: number };
}

/** O progresso coletivo logo depois de uma Contribuição, para o evento `raid:progress`. */
export interface RaidProgress {
  raidId: string;
  guildId: string;
  progressXp: number;
  goalXp: number;
  goalReachedAt: Date | null;
}

export interface GuildSessionContribution {
  raidId: string;
  userId: string;
  studySessionId: string;
  xpContributed: number;
  /** O fim da Study Session: decide se ela ainda cabe na semana da Raid (RN01). */
  endedAt: Date;
}

const RAID_ENDED_PROBLEM = 'https://wise.app/errors/raid-ended';

@Injectable()
export class RaidsService {
  constructor(
    @InjectRepository(Raid) private readonly raids: Repository<Raid>,
    @InjectRepository(RaidContribution)
    private readonly contributions: Repository<RaidContribution>,
    @InjectRepository(RaidParticipation)
    private readonly participations: Repository<RaidParticipation>,
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
      goalReachedAt: raid.goalReachedAt,
      startsAt: raid.startsAt,
      endsAt: raid.endsAt,
      status: raid.status,
      me: {
        participating: await this.participations.existsBy({ raidId: raid.id, userId: requesterId }),
        contributionXp: await this.contributionXpOf(raid.id, requesterId),
      },
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

  /**
   * UC02 fluxo básico: o membro confirma participação na Raid da sua Guild. Repetir é inofensivo.
   * Uma Raid que já bateu a meta (`completed`) continua aberta até o fim da semana.
   */
  async join(userId: string, raidId: string): Promise<void> {
    const raid = await this.raids.findOne({ where: { id: raidId } });
    if (!raid) {
      throw new NotFoundException('Raid não encontrada');
    }
    if (!(await this.guilds.isMember(raid.guildId, userId))) {
      throw new ForbiddenException('Usuário não pertence à guilda desta raid');
    }
    if (!this.isOpenAt(raid, this.clock())) {
      throw new ConflictException({ type: RAID_ENDED_PROBLEM, message: 'Raid encerrada' }); // UC02 (A01) — Raid Expirada
    }
    await this.participations
      .createQueryBuilder()
      .insert()
      .values({ raidId, userId })
      .orIgnore() // a unicidade por Raid e usuário torna a repetição um no-op, mesmo em corrida
      .execute();
  }

  /**
   * Forja: uma Study Session de modo Guilda só começa na Raid ativa da Guild do usuário, e só para
   * Participantes. Roda na transação do início, depois da trava do usuário.
   */
  async assertCanStartGuildSession(manager: EntityManager, userId: string, raidId: string, now: Date): Promise<void> {
    const raid = await manager.findOne(Raid, { where: { id: raidId } });
    if (!raid) {
      throw new NotFoundException('Raid não encontrada');
    }
    if (!(await this.guilds.isMember(raid.guildId, userId))) {
      throw new ForbiddenException('Usuário não pertence à guilda desta raid');
    }
    if (!this.isOpenAt(raid, now)) {
      throw new ConflictException({ type: RAID_ENDED_PROBLEM, message: 'Raid encerrada' });
    }
    if (!(await manager.exists(RaidParticipation, { where: { raidId, userId } }))) {
      throw new ForbiddenException('Confirme a participação na Raid antes de iniciar uma sessão de guilda');
    }
  }

  /**
   * Grava a Contribuição na transação da conclusão da Study Session. Sessão concluída fora da semana
   * da Raid (RN01) ou sem XP validado pelo antifraude não contribui, e a mesma Study Session conta
   * no máximo uma vez. Devolve o progresso para publicar depois do commit, ou `null` se nada mudou.
   */
  async recordContributionInTransaction(
    manager: EntityManager,
    contribution: GuildSessionContribution,
  ): Promise<RaidProgress | null> {
    const { raidId, userId, studySessionId, xpContributed, endedAt } = contribution;
    if (xpContributed <= 0) return null;
    // Locking the Raid first keeps concurrent Contributions from deadlocking on the foreign key check.
    const raid = await manager
      .createQueryBuilder(Raid, 'raid')
      .setLock('pessimistic_write')
      .where('raid.id = :raidId', { raidId })
      .getOne();
    if (!raid || !this.isOpenAt(raid, endedAt)) return null;

    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(RaidContribution)
      .values({ raidId, userId, studySessionId, xpContributed })
      .orIgnore() // `study_session_id` único: uma conclusão reprocessada não soma de novo
      .execute();
    if ((inserted.raw as { affectedRows: number }).affectedRows === 0) return null;

    // Atomic in the database. MySQL evaluates the assignments left to right, so the goal check runs before the increment.
    await manager.query(
      `UPDATE raids
       SET goal_reached_at = IF(goal_reached_at IS NULL AND progress_xp + ? >= goal_xp, ?, goal_reached_at),
           progress_xp = progress_xp + ?
       WHERE id = ?`,
      [xpContributed, endedAt, xpContributed, raidId],
    );
    const updated = await manager.findOneOrFail(Raid, { where: { id: raidId } });
    return {
      raidId,
      guildId: updated.guildId,
      progressXp: updated.progressXp,
      goalXp: updated.goalXp,
      goalReachedAt: updated.goalReachedAt,
    };
  }

  /** Depois do commit: todos os membros conectados veem o progresso (UC02 RE01). */
  publishProgress(progress: RaidProgress): void {
    this.realtime.emitToGuild(progress.guildId, 'raid:progress', {
      raidId: progress.raidId,
      progressXp: progress.progressXp,
      goalXp: progress.goalXp,
      goalReachedAt: progress.goalReachedAt,
    });
  }

  /** Conclusão das Study Sessions legadas, sem estado canônico, que ainda não usam a transação da conclusão. */
  async recordContribution(
    raidId: string,
    userId: string,
    studySessionId: string,
    xpContributed: number,
  ): Promise<void> {
    const progress = await this.raids.manager.transaction((manager) =>
      this.recordContributionInTransaction(manager, {
        raidId,
        userId,
        studySessionId,
        xpContributed,
        endedAt: this.clock(),
      }),
    );
    if (progress) this.publishProgress(progress);
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

  /** A Raid aceita Participantes e Contribuições da segunda 00:00 ao domingo 23:59:59, mesmo depois da Meta batida. */
  private isOpenAt(raid: Raid, at: Date): boolean {
    return raid.status !== 'expired'
      && raid.startsAt.getTime() <= at.getTime()
      && at.getTime() <= raid.endsAt.getTime();
  }

  private async contributionXpOf(raidId: string, userId: string): Promise<number> {
    const row = await this.contributions
      .createQueryBuilder('contribution')
      .select('COALESCE(SUM(contribution.xpContributed), 0)', 'total')
      .where('contribution.raidId = :raidId AND contribution.userId = :userId', { raidId, userId })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
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
