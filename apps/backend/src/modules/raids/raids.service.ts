import {
  BadRequestException,
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
import { RAID_RANKING_PAGE_SIZE_DEFAULT, type ListRaidRankingQueryDto } from './dto/list-raid-ranking-query.dto';
import { PAST_RAIDS_PAGE_SIZE_DEFAULT, type ListPastRaidsQueryDto } from './dto/list-past-raids-query.dto';
import { Guild } from '../guilds/entities/guild.entity';
import { GuildMembership } from '../guilds/entities/guild-membership.entity';

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
  /** `position` is the caller's place in the Ranking interno, or `null` while they are not a Participant. */
  me: { participating: boolean; contributionXp: number; position: number | null };
}

export interface RaidRankingEntry {
  position: number;
  userId: string;
  displayName: string;
  level: number;
  /** The equipped Título (ADR-010); `null` when the slot is empty. */
  title: string | null;
  contributionXp: number;
  isMe: boolean;
}

/** A closed Raid in the Guild's history, with the caller's own result in it. */
export interface PastRaid {
  id: string;
  mission: { slug: string; name: string };
  startsAt: Date;
  endsAt: Date;
  status: 'completed' | 'expired';
  goalXp: number;
  progressXp: number;
  me: { participated: boolean; contributionXp: number; position: number | null };
}

export interface PastRaidPage {
  items: PastRaid[];
  nextCursor: string | null;
}

/** What one weekly closing did, for the log and for the realtime notice that comes after it (#119). */
export interface RaidClosing {
  raidId: string;
  guildId: string;
  status: 'completed' | 'expired';
  /** Everyone who confirmed participation, each told about the closing through `notification:raidComplete`. */
  participantUserIds: string[];
  /** Participants who received the Recompensa de Raid; empty for an `expired` Raid. */
  rewardedUserIds: string[];
  /** The Cosmetic Items granted to each of them. */
  rewardItemIds: string[];
}

export interface RaidRankingPage {
  items: RaidRankingEntry[];
  nextCursor: string | null;
}

/** O progresso coletivo logo depois de uma Contribuição, para o evento `raid:progress`. */
export interface RaidProgress {
  raidId: string;
  guildId: string;
  progressXp: number;
  goalXp: number;
  goalReachedAt: Date | null;
}

export type RaidContributionOutcome =
  | { status: 'counted'; xpContributed: number; progress: RaidProgress | null }
  | { status: 'outside-raid-window'; xpContributed: 0 }
  | { status: 'no-validated-xp'; xpContributed: 0 };

export interface GuildSessionContribution {
  raidId: string;
  userId: string;
  studySessionId: string;
  xpContributed: number;
  /** O fim da Study Session: decide se ela ainda cabe na semana da Raid (RN01). */
  endedAt: Date;
}

const RAID_ENDED_PROBLEM = 'https://wise.app/errors/raid-ended';

/**
 * The Ranking interno of one Raid, numbered in a single pass. Order: Contribution desc, then who reached that
 * total first (oldest last Contribution), then userId. Participants without Contribution have 0 XP and so end up
 * last. Only current members of the Guild appear, but a former member's Contributions stay in `raids.progress_xp`.
 * Parameters: the Raid id, four times.
 */
const RAID_RANKING_SQL = `
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(c.xp, 0) DESC, c.last_at ASC, u.id ASC) AS rank_position,
    u.id AS user_id,
    u.display_name AS display_name,
    COALESCE(ch.level, 1) AS level,
    t.name AS title,
    COALESCE(c.xp, 0) AS contribution_xp
  FROM (
    SELECT user_id FROM raid_participations WHERE raid_id = ?
    UNION
    SELECT user_id FROM raid_contributions WHERE raid_id = ?
  ) participant
  JOIN raids r ON r.id = ?
  JOIN guild_memberships m ON m.guild_id = r.guild_id AND m.user_id = participant.user_id
  JOIN users u ON u.id = participant.user_id
  LEFT JOIN characters ch ON ch.user_id = u.id
  LEFT JOIN (
    SELECT user_id, SUM(xp_contributed) AS xp, MAX(created_at) AS last_at
    FROM raid_contributions WHERE raid_id = ? GROUP BY user_id
  ) c ON c.user_id = u.id
  LEFT JOIN (
    SELECT uci.user_id, ci.name
    FROM user_cosmetic_items uci JOIN cosmetic_items ci ON ci.id = uci.cosmetic_item_id
    WHERE uci.equipped = 1 AND ci.category = 'title'
  ) t ON t.user_id = u.id`;

const rankingParams = (raidId: string) => [raidId, raidId, raidId, raidId];

/** The cursor is the position of the last row of the page: positions are dense and start at 1. */
function encodeRankingCursor(position: number): string {
  return Buffer.from(JSON.stringify({ p: position }), 'utf8').toString('base64url');
}

function encodePastRaidsCursor(startsAt: Date): string {
  return Buffer.from(JSON.stringify({ s: startsAt.toISOString() }), 'utf8').toString('base64url');
}

function decodePastRaidsCursor(cursor: string): Date {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { s?: unknown };
    if (typeof parsed.s === 'string') {
      const startsAt = new Date(parsed.s);
      if (!Number.isNaN(startsAt.getTime())) return startsAt;
    }
  } catch {
    // Falls through to the validation error below.
  }
  throw new BadRequestException('Cursor inválido');
}

function decodeRankingCursor(cursor: string): number {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { p?: unknown };
    if (typeof parsed.p === 'number' && Number.isInteger(parsed.p) && parsed.p >= 1 && parsed.p <= 1_000_000) {
      return parsed.p;
    }
  } catch {
    // Falls through to the validation error below.
  }
  throw new BadRequestException('Cursor inválido');
}

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
    @Inject(forwardRef(() => UsersService))
    private readonly users: UsersService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtime: RealtimeGateway,
    @Inject(RAID_CLOCK) private readonly clock: RaidClock,
  ) {}

  /**
   * Opens the Raid of the current week for a Guild, in the caller's transaction. The Missão comes from the
   * weekly rotation and the goal is frozen from the member count at this moment.
   */
  async createForGuild(manager: EntityManager, guildId: string, memberCount: number, now: Date = this.clock()): Promise<Raid> {
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
      me: await this.myStanding(raid.id, requesterId),
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
   * no máximo uma vez. Devolve o resultado discriminado para reportar o motivo da não-contagem.
   */
  async recordContributionInTransaction(
    manager: EntityManager,
    contribution: GuildSessionContribution,
  ): Promise<RaidContributionOutcome> {
    const { raidId, userId, studySessionId, xpContributed, endedAt } = contribution;
    if (xpContributed <= 0) return { status: 'no-validated-xp', xpContributed: 0 };
    // Locking the Raid first keeps concurrent Contributions from deadlocking on the foreign key check.
    const raid = await manager
      .createQueryBuilder(Raid, 'raid')
      .setLock('pessimistic_write')
      .where('raid.id = :raidId', { raidId })
      .getOne();
    if (!raid || !this.isOpenAt(raid, endedAt)) return { status: 'outside-raid-window', xpContributed: 0 };

    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(RaidContribution)
      .values({ raidId, userId, studySessionId, xpContributed })
      .orIgnore() // `study_session_id` único: uma conclusão reprocessada não soma de novo
      .execute();
    if ((inserted.raw as { affectedRows: number }).affectedRows === 0) {
      // Já contou antes: informa o XP gravado na primeira vez, sem somar nem publicar de novo.
      const existing = await manager.findOneByOrFail(RaidContribution, { studySessionId });
      return { status: 'counted', xpContributed: existing.xpContributed, progress: null };
    }

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
      status: 'counted',
      xpContributed,
      progress: {
        raidId,
        guildId: updated.guildId,
        progressXp: updated.progressXp,
        goalXp: updated.goalXp,
        goalReachedAt: updated.goalReachedAt,
      },
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
    const outcome = await this.raids.manager.transaction((manager) =>
      this.recordContributionInTransaction(manager, {
        raidId,
        userId,
        studySessionId,
        xpContributed,
        endedAt: this.clock(),
      }),
    );
    if (outcome.status === 'counted' && outcome.progress) this.publishProgress(outcome.progress);
  }

  /**
   * Fechamento semanal (#116): closes every Raid whose week is over, then gives each Guild without one the Raid
   * of the week that contains `now`. Weeks that passed entirely while the application was down get no Raid of
   * their own: nobody could have played them. Each Raid and each Guild is its own transaction.
   */
  async runWeeklyClose(now: Date): Promise<{ closed: number; opened: number; closings: RaidClosing[] }> {
    const due = await this.raids
      .createQueryBuilder('raid')
      .select('raid.id', 'id')
      .where("raid.status = 'active'")
      .andWhere('raid.endsAt < :now', { now })
      .orderBy('raid.endsAt', 'ASC')
      .getRawMany<{ id: string }>();
    const closings: RaidClosing[] = [];
    for (const { id } of due) {
      const closing = await this.raids.manager.transaction((manager) => this.closeRaid(manager, id, now));
      if (!closing) continue;
      closings.push(closing);
      this.notifyRaidComplete(closing);
    }

    const week = raidWeekAt(now);
    const withoutRaid = await this.raids.manager
      .createQueryBuilder(Guild, 'guild')
      .select('guild.id', 'id')
      .leftJoin(Raid, 'raid', 'raid.guildId = guild.id AND raid.startsAt = :weekStart', { weekStart: week.startsAt })
      .where('raid.id IS NULL')
      .getRawMany<{ id: string }>();
    let opened = 0;
    for (const { id } of withoutRaid) {
      const raid = await this.raids.manager.transaction((manager) => this.openWeekRaid(manager, id, now));
      if (raid) opened += 1;
    }
    return { closed: closings.length, opened, closings };
  }

  /**
   * Closes one Raid under a row lock, so running the closing twice, or in two processes, changes it once:
   * Meta batida closes it `completed` and raises the Nível da Guild; otherwise it closes `expired`.
   */
  private async closeRaid(manager: EntityManager, raidId: string, now: Date): Promise<RaidClosing | null> {
    const raid = await manager
      .createQueryBuilder(Raid, 'raid')
      .setLock('pessimistic_write')
      .where('raid.id = :raidId', { raidId })
      .getOne();
    if (!raid || raid.status !== 'active' || raid.endsAt.getTime() >= now.getTime()) return null;

    const status = raid.goalReachedAt !== null || raid.progressXp >= raid.goalXp ? 'completed' : 'expired';
    await manager.update(Raid, { id: raid.id }, { status });
    let rewardedUserIds: string[] = [];
    let rewardItemIds: string[] = [];
    if (status === 'completed') {
      await manager.increment(Guild, { id: raid.guildId }, 'level', 1);
      ({ rewardedUserIds, rewardItemIds } = await this.grantRaidReward(manager, raid));
    }
    await this.openWeekRaid(manager, raid.guildId, now);
    const participations = await manager.find(RaidParticipation, { where: { raidId: raid.id }, select: { userId: true } });
    const participantUserIds = participations.map(({ userId }) => userId);
    return { raidId: raid.id, guildId: raid.guildId, status, participantUserIds, rewardedUserIds, rewardItemIds };
  }

  /**
   * `notification:raidComplete` (#119) to every device of each Participant, after the closing committed. A closing
   * that runs again finds the Raid already closed and returns nothing, so each Participant hears about it once.
   */
  private notifyRaidComplete(closing: RaidClosing): void {
    const rewarded = new Set(closing.rewardedUserIds);
    for (const userId of closing.participantUserIds) {
      this.realtime.emitToUser(userId, 'notification:raidComplete', {
        raidId: closing.raidId,
        guildId: closing.guildId,
        status: closing.status,
        rewardItemId: rewarded.has(userId) ? closing.rewardItemIds[0] ?? null : null,
      });
    }
  }

  /**
   * Recompensa de Raid (#117), in the closing transaction: every Participant who is still a member of the Guild
   * and made at least one Contribution gets the Missão's Cosmetic Item. Confirming without contributing, or
   * having left the Guild, earns nothing.
   */
  private async grantRaidReward(manager: EntityManager, raid: Raid): Promise<{ rewardedUserIds: string[]; rewardItemIds: string[] }> {
    const mission = await manager.findOneOrFail(Mission, { where: { id: raid.missionId } });
    const rows = await manager.query<Array<{ user_id: string }>>(
      `SELECT DISTINCT contribution.user_id
       FROM raid_contributions contribution
       JOIN guild_memberships membership
         ON membership.guild_id = ? AND membership.user_id = contribution.user_id
       WHERE contribution.raid_id = ? AND contribution.xp_contributed > 0
       ORDER BY contribution.user_id`,
      [raid.guildId, raid.id],
    );
    const rewardedUserIds = rows.map((row) => row.user_id);
    const rewardItemIds = await this.users.unlockRaidRewards(manager, rewardedUserIds, mission.slug);
    return { rewardedUserIds: rewardItemIds.length ? rewardedUserIds : [], rewardItemIds };
  }

  /**
   * Opens the Raid of the week that contains `now` for a Guild that has none. The Guild row lock makes the check
   * and the insert one step, so a Guild never gets two Raids in the same week.
   */
  private async openWeekRaid(manager: EntityManager, guildId: string, now: Date): Promise<Raid | null> {
    const guild = await manager
      .createQueryBuilder(Guild, 'guild')
      .setLock('pessimistic_write')
      .where('guild.id = :guildId', { guildId })
      .getOne();
    if (!guild) return null;
    const week = raidWeekAt(now);
    if (await manager.exists(Raid, { where: { guildId, startsAt: week.startsAt } })) return null;
    const memberCount = await manager.count(GuildMembership, { where: { guildId } });
    if (memberCount === 0) return null;
    return this.createForGuild(manager, guildId, memberCount, now);
  }

  /** Raids anteriores of a Guild, most recent first. Members only, like the rest of the Raid. */
  async listPast(guildId: string, requesterId: string, query: ListPastRaidsQueryDto): Promise<PastRaidPage> {
    if (!(await this.guilds.isMember(guildId, requesterId))) {
      throw new ForbiddenException('Apenas membros da guilda podem ver as Raids anteriores');
    }
    const limit = query.limit ?? PAST_RAIDS_PAGE_SIZE_DEFAULT;
    const qb = this.raids
      .createQueryBuilder('raid')
      .innerJoinAndSelect('raid.mission', 'mission')
      .where('raid.guildId = :guildId', { guildId })
      .andWhere("raid.status IN ('completed', 'expired')")
      .orderBy('raid.startsAt', 'DESC')
      .take(limit + 1);
    if (query.cursor) {
      qb.andWhere('raid.startsAt < :before', { before: decodePastRaidsCursor(query.cursor) });
    }
    const rows = await qb.getMany();
    const page = rows.slice(0, limit);
    const items = await Promise.all(page.map(async (raid): Promise<PastRaid> => {
      const [participation, contributionXp, position] = await Promise.all([
        this.participations.existsBy({ raidId: raid.id, userId: requesterId }),
        this.contributionXpOf(raid.id, requesterId),
        this.positionOf(raid.id, requesterId),
      ]);
      return {
        id: raid.id,
        mission: { slug: raid.mission.slug, name: raid.mission.name },
        startsAt: raid.startsAt,
        endsAt: raid.endsAt,
        status: raid.status as PastRaid['status'],
        goalXp: raid.goalXp,
        progressXp: raid.progressXp,
        me: { participated: participation || contributionXp > 0, contributionXp, position },
      };
    }));
    const last = page[page.length - 1];
    return { items, nextCursor: rows.length > limit && last ? encodePastRaidsCursor(last.startsAt) : null };
  }

  /** Ranking interno: members only, paginated by position, stable under the order documented in `RAID_RANKING_SQL`. */
  async ranking(userId: string, raidId: string, query: ListRaidRankingQueryDto): Promise<RaidRankingPage> {
    await this.findRaidForMember(userId, raidId);
    const limit = query.limit ?? RAID_RANKING_PAGE_SIZE_DEFAULT;
    const after = query.cursor ? decodeRankingCursor(query.cursor) : 0;

    const rows = await this.raids.manager.query<Array<{
      rank_position: number | string;
      user_id: string;
      display_name: string;
      level: number | string;
      title: string | null;
      contribution_xp: number | string;
    }>>(
      `SELECT * FROM (${RAID_RANKING_SQL}) ranked WHERE rank_position > ? ORDER BY rank_position LIMIT ?`,
      [...rankingParams(raidId), after, limit + 1],
    );
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => ({
        position: Number(row.rank_position),
        userId: row.user_id,
        displayName: row.display_name,
        level: Number(row.level),
        title: row.title ?? null,
        contributionXp: Number(row.contribution_xp),
        isMe: row.user_id === userId,
      })),
      nextCursor: rows.length > limit && last ? encodeRankingCursor(Number(last.rank_position)) : null,
    };
  }

  /** A Raid aceita Participantes e Contribuições da segunda 00:00 ao domingo 23:59:59, mesmo depois da Meta batida. */
  private isOpenAt(raid: Raid, at: Date): boolean {
    return raid.status !== 'expired'
      && raid.startsAt.getTime() <= at.getTime()
      && at.getTime() <= raid.endsAt.getTime();
  }

  /** The caller's own line in the Raid: participation, Contribution and place in the Ranking interno. */
  private async myStanding(raidId: string, userId: string): Promise<ActiveRaid['me']> {
    const [participating, contributionXp, position] = await Promise.all([
      this.participations.existsBy({ raidId, userId }),
      this.contributionXpOf(raidId, userId),
      this.positionOf(raidId, userId),
    ]);
    return { participating, contributionXp, position };
  }

  private async positionOf(raidId: string, userId: string): Promise<number | null> {
    const rows = await this.raids.manager.query<Array<{ rank_position: number | string }>>(
      `SELECT rank_position FROM (${RAID_RANKING_SQL}) ranked WHERE user_id = ?`,
      [...rankingParams(raidId), userId],
    );
    return rows[0] ? Number(rows[0].rank_position) : null;
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
