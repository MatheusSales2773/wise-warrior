import {
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThan, Repository } from 'typeorm';
import { Mission } from './entities/mission.entity';
import { Raid, type RaidStatus } from './entities/raid.entity';
import { RAID_PAGE_SIZE_DEFAULT, type RaidPageQueryDto } from './dto/raid-page-query.dto';
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
  /** `position` no Ranking interno; `null` para quem ainda não é Participante. */
  me: { participating: boolean; contributionXp: number; position: number | null };
}

interface MissionSummary {
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
}

/** Uma linha do Ranking interno (ADR-010 para o Título). */
export interface RankingEntry {
  position: number;
  userId: string;
  displayName: string;
  level: number;
  title: string | null;
  contributionXp: number;
}

export interface RankingPage {
  items: RankingEntry[];
  nextCursor: string | null;
}

/** Uma Raid fechada, vista por um membro da Guild. */
export interface PastRaid {
  id: string;
  mission: MissionSummary;
  goalXp: number;
  progressXp: number;
  goalReachedAt: Date | null;
  startsAt: Date;
  endsAt: Date;
  status: RaidStatus;
  me: { participated: boolean; contributionXp: number; position: number | null };
}

export interface PastRaidPage {
  items: PastRaid[];
  nextCursor: string | null;
}

/** O resultado de um fechamento, para avisar os Participantes depois do commit. */
export interface RaidClosure {
  raidId: string;
  guildId: string;
  status: Exclude<RaidStatus, 'active'>;
  participantIds: string[];
  /** Participantes membros com Contribuição: só eles recebem a Recompensa de Raid. */
  rewardedIds: string[];
  rewardItemId: string | null;
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

/** Ordena quem ainda não contribuiu depois de todos os que contribuíram. */
const NO_CONTRIBUTION_SORT_AT = '9999-12-31 23:59:59.999999';
const MYSQL_DATETIME_TEXT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/;

interface RankRow {
  userId: string;
  contributionXp: number;
  /** O momento da última Contribuição, como o texto exato do MySQL (microssegundos inclusos). */
  sortAt: string;
  position: number;
}

type RankCursor = Pick<RankRow, 'contributionXp' | 'sortAt' | 'userId'>;

function encodeCursor(values: unknown[]): string {
  return Buffer.from(JSON.stringify(values), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Falls through to the validation error below.
  }
  throw new BadRequestException('Cursor inválido');
}

function decodeRankCursor(cursor: string): RankCursor {
  const [contributionXp, sortAt, userId] = decodeCursor(cursor);
  if (
    typeof contributionXp !== 'number' || !Number.isInteger(contributionXp)
    || typeof sortAt !== 'string' || !MYSQL_DATETIME_TEXT.test(sortAt)
    || typeof userId !== 'string'
  ) {
    throw new BadRequestException('Cursor inválido');
  }
  return { contributionXp, sortAt, userId };
}

function decodePastRaidCursor(cursor: string): { startsAt: Date; id: string } {
  const [startsAt, id] = decodeCursor(cursor);
  const date = typeof startsAt === 'string' ? new Date(startsAt) : null;
  if (!date || Number.isNaN(date.getTime()) || typeof id !== 'string') {
    throw new BadRequestException('Cursor inválido');
  }
  return { startsAt: date, id };
}

function missionSummary(mission: Mission): MissionSummary {
  return { slug: mission.slug, name: mission.name, description: mission.description, imageUrl: mission.imageUrl };
}

function isDuplicateEntry(error: unknown): boolean {
  const candidate = error as { code?: string; driverError?: { code?: string } } | null;
  return candidate?.code === 'ER_DUP_ENTRY' || candidate?.driverError?.code === 'ER_DUP_ENTRY';
}

@Injectable()
export class RaidsService {
  private readonly logger = new Logger(RaidsService.name);

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
      // The Meta batida (`goalReachedAt`) keeps the Raid `active`; only the weekly closing changes the status.
      .andWhere("raid.status = 'active'")
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
    const me = await this.participantSummary(raid, requesterId);
    return {
      id: raid.id,
      mission: missionSummary(raid.mission),
      reward: { itemId: item.id, name: item.name, category: item.category },
      goalXp: raid.goalXp,
      progressXp: raid.progressXp,
      goalReachedAt: raid.goalReachedAt,
      startsAt: raid.startsAt,
      endsAt: raid.endsAt,
      status: raid.status,
      me: { participating: me.participated, contributionXp: me.contributionXp, position: me.position },
    };
  }

  /** As Raids fechadas da Guild, da mais recente para a mais antiga. Só membros as veem. */
  async listClosed(guildId: string, requesterId: string, query: RaidPageQueryDto): Promise<PastRaidPage> {
    if (!(await this.guilds.isMember(guildId, requesterId))) {
      throw new ForbiddenException('Apenas membros da guilda podem ver as Raids anteriores');
    }
    const limit = query.limit ?? RAID_PAGE_SIZE_DEFAULT;
    const qb = this.raids
      .createQueryBuilder('raid')
      .innerJoinAndSelect('raid.mission', 'mission')
      .where('raid.guildId = :guildId', { guildId })
      .andWhere("raid.status IN ('completed', 'expired')")
      .orderBy('raid.startsAt', 'DESC')
      .addOrderBy('raid.id', 'DESC')
      .limit(limit + 1);
    if (query.cursor) {
      const after = decodePastRaidCursor(query.cursor);
      qb.andWhere('(raid.startsAt < :afterStartsAt OR (raid.startsAt = :afterStartsAt AND raid.id < :afterId))', {
        afterStartsAt: after.startsAt,
        afterId: after.id,
      });
    }
    const rows = await qb.getMany();
    const page = rows.slice(0, limit);
    const memberIds = await this.guilds.memberIds(guildId);
    const items = await Promise.all(page.map(async (raid) => ({
      id: raid.id,
      mission: missionSummary(raid.mission),
      goalXp: raid.goalXp,
      progressXp: raid.progressXp,
      goalReachedAt: raid.goalReachedAt,
      startsAt: raid.startsAt,
      endsAt: raid.endsAt,
      status: raid.status,
      me: await this.participantSummary(raid, requesterId, memberIds),
    })));
    const last = page[page.length - 1];
    return {
      items,
      nextCursor: rows.length > limit && last ? encodeCursor([last.startsAt.toISOString(), last.id]) : null,
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
   * Uma Raid com Meta batida continua aberta até o fim da semana.
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

  /**
   * Ranking interno: só Participantes que ainda são membros, por Contribuição decrescente, depois quem
   * chegou ao total primeiro (última Contribuição mais antiga), depois `userId`. Quem não contribuiu fica no fim.
   */
  async ranking(userId: string, raidId: string, query: RaidPageQueryDto = {}): Promise<RankingPage> {
    const raid = await this.findRaidForMember(userId, raidId);
    const limit = query.limit ?? RAID_PAGE_SIZE_DEFAULT;
    const rows = await this.rankRows(raid.id, await this.guilds.memberIds(raid.guildId), {
      after: query.cursor ? decodeRankCursor(query.cursor) : undefined,
      limit: limit + 1,
    });
    const page = rows.slice(0, limit);
    const identities = await this.users.findPublicIdentities(page.map((row) => row.userId));
    const last = page[page.length - 1];
    return {
      items: page.map((row) => {
        const identity = identities.get(row.userId);
        return {
          position: row.position,
          userId: row.userId,
          displayName: identity?.displayName ?? '',
          level: identity?.level ?? 1,
          title: identity?.title ?? null,
          contributionXp: row.contributionXp,
        };
      }),
      nextCursor: rows.length > limit && last ? encodeCursor([last.contributionXp, last.sortAt, last.userId]) : null,
    };
  }

  /**
   * Job semanal: fecha as Raids vencidas e abre a Raid da semana corrente de cada Guild que ainda não tem.
   * Rodar de novo, ou depois de semanas com a aplicação fora do ar, não repete nada.
   */
  async runWeeklyRollover(): Promise<{ closed: RaidClosure[]; opened: number }> {
    const closed = await this.closeEndedRaids();
    const opened = await this.openCurrentWeekRaids();
    return { closed, opened };
  }

  /** Fecha cada Raid `active` com `endsAt` vencido numa transação própria e avisa os Participantes depois do commit. */
  async closeEndedRaids(): Promise<RaidClosure[]> {
    const ended = await this.raids.find({
      select: { id: true },
      where: { status: 'active', endsAt: LessThan(this.clock()) },
      order: { endsAt: 'ASC' },
    });
    const closures: RaidClosure[] = [];
    for (const { id } of ended) {
      try {
        const closure = await this.closeRaid(id);
        if (closure) {
          closures.push(closure);
          this.publishClosure(closure);
        }
      } catch (error) {
        this.logger.error(`Falha ao fechar a Raid ${id}`, error instanceof Error ? error.stack : String(error));
      }
    }
    return closures;
  }

  /** Abre a Raid da semana corrente para cada Guild sem uma; a meta é a do tamanho atual, proporcional ao que falta. */
  async openCurrentWeekRaids(): Promise<number> {
    const now = this.clock();
    const week = raidWeekAt(now);
    const covered = new Set((await this.raids.find({
      select: { guildId: true },
      where: { startsAt: week.startsAt },
    })).map((raid) => raid.guildId));
    let opened = 0;
    for (const guild of await this.guilds.listForWeeklyRaid()) {
      if (covered.has(guild.id)) continue;
      try {
        await this.raids.manager.transaction((manager) => this.createForGuild(manager, guild.id, guild.memberCount));
        opened += 1;
      } catch (error) {
        // Outra execução abriu a mesma semana (índice único Guild + início) ou a Guild acabou de ser encerrada.
        if (isDuplicateEntry(error)) continue;
        this.logger.error(`Falha ao abrir a Raid da guilda ${guild.id}`, error instanceof Error ? error.stack : String(error));
      }
    }
    return opened;
  }

  /**
   * Fechamento idempotente: só uma Raid ainda `active` muda de status. Com Meta batida, a Guild sobe um nível
   * e cada Participante membro com Contribuição recebe a Recompensa, tudo na mesma transação.
   */
  private async closeRaid(raidId: string): Promise<RaidClosure | null> {
    return this.raids.manager.transaction(async (manager) => {
      const raid = await manager
        .createQueryBuilder(Raid, 'raid')
        .setLock('pessimistic_write')
        .where('raid.id = :raidId', { raidId })
        .getOne();
      if (!raid || raid.status !== 'active') return null;

      const won = raid.goalReachedAt !== null || raid.progressXp >= raid.goalXp;
      const status = won ? 'completed' : 'expired';
      await manager.update(Raid, { id: raid.id }, { status });

      const participantIds = ((await manager.query(
        'SELECT user_id AS userId FROM raid_participations WHERE raid_id = ? UNION SELECT user_id FROM raid_contributions WHERE raid_id = ?',
        [raid.id, raid.id],
      )) as Array<{ userId: string }>).map((row) => row.userId);
      if (!won) {
        return { raidId: raid.id, guildId: raid.guildId, status, participantIds, rewardedIds: [], rewardItemId: null };
      }

      await this.guilds.levelUpInTransaction(manager, raid.guildId);
      const members = new Set(await this.guilds.memberIds(raid.guildId, manager));
      const contributors = ((await manager.query(
        'SELECT DISTINCT user_id AS userId FROM raid_contributions WHERE raid_id = ?',
        [raid.id],
      )) as Array<{ userId: string }>).map((row) => row.userId);
      const rewardedIds = contributors.filter((userId) => members.has(userId));
      const mission = await manager.findOneByOrFail(Mission, { id: raid.missionId });
      await this.users.unlockRaidReward(manager, rewardedIds, mission.slug);
      return {
        raidId: raid.id,
        guildId: raid.guildId,
        status,
        participantIds,
        rewardedIds,
        rewardItemId: mission.rewardCosmeticItemId,
      };
    });
  }

  /** Depois do commit do fechamento, uma vez por Participante: todos os dispositivos dele recebem o aviso. */
  private publishClosure(closure: RaidClosure): void {
    const rewarded = new Set(closure.rewardedIds);
    for (const userId of closure.participantIds) {
      this.realtime.emitToUser(userId, 'notification:raidComplete', {
        raidId: closure.raidId,
        guildId: closure.guildId,
        status: closure.status,
        rewardItemId: rewarded.has(userId) ? closure.rewardItemId : null,
      });
    }
  }

  /**
   * A Raid aceita Participantes e Contribuições da segunda 00:00 ao domingo 23:59:59, mesmo depois da Meta
   * batida. Depois do fechamento (`completed` ou `expired`) não aceita mais nada.
   */
  private isOpenAt(raid: Raid, at: Date): boolean {
    return raid.status === 'active'
      && raid.startsAt.getTime() <= at.getTime()
      && at.getTime() <= raid.endsAt.getTime();
  }

  /** Participação, Contribuição e posição de um usuário numa Raid. */
  private async participantSummary(
    raid: Raid,
    userId: string,
    knownMemberIds?: string[],
  ): Promise<{ participated: boolean; contributionXp: number; position: number | null }> {
    const [participated, contributionXp, memberIds] = await Promise.all([
      this.participations.existsBy({ raidId: raid.id, userId }),
      this.contributionXpOf(raid.id, userId),
      knownMemberIds ?? this.guilds.memberIds(raid.guildId),
    ]);
    const [row] = await this.rankRows(raid.id, memberIds, { userId });
    return { participated: participated || contributionXp > 0, contributionXp, position: row?.position ?? null };
  }

  /**
   * O Ranking interno inteiro é numerado no banco (ROW_NUMBER), e a página é recortada por keyset sobre a
   * mesma ordem, para que a paginação não repita nem pule linhas.
   */
  private async rankRows(
    raidId: string,
    memberIds: string[],
    filter: { after?: RankCursor; userId?: string; limit?: number },
  ): Promise<RankRow[]> {
    if (memberIds.length === 0) return [];
    const conditions: string[] = [];
    const params: unknown[] = [raidId, raidId, raidId, memberIds];
    if (filter.after) {
      const { contributionXp, sortAt, userId } = filter.after;
      conditions.push(`(ranked.contributionXp < ?
        OR (ranked.contributionXp = ? AND ranked.sortAt > ?)
        OR (ranked.contributionXp = ? AND ranked.sortAt = ? AND ranked.userId > ?))`);
      params.push(contributionXp, contributionXp, sortAt, contributionXp, sortAt, userId);
    }
    if (filter.userId) {
      conditions.push('ranked.userId = ?');
      params.push(filter.userId);
    }
    let sql = `
      SELECT ranked.userId, ranked.contributionXp, ranked.sortAt, ranked.position FROM (
        SELECT totals.userId, totals.contributionXp, totals.sortAt,
               ROW_NUMBER() OVER (ORDER BY totals.contributionXp DESC, totals.sortAt ASC, totals.userId ASC) AS position
        FROM (
          SELECT participant.user_id AS userId,
                 CAST(COALESCE(SUM(contribution.xp_contributed), 0) AS SIGNED) AS contributionXp,
                 COALESCE(DATE_FORMAT(MAX(contribution.created_at), '%Y-%m-%d %H:%i:%s.%f'), '${NO_CONTRIBUTION_SORT_AT}') AS sortAt
          FROM (
            SELECT user_id FROM raid_participations WHERE raid_id = ?
            UNION SELECT user_id FROM raid_contributions WHERE raid_id = ?
          ) participant
          LEFT JOIN raid_contributions contribution
            ON contribution.raid_id = ? AND contribution.user_id = participant.user_id
          WHERE participant.user_id IN (?)
          GROUP BY participant.user_id
        ) totals
      ) ranked
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY ranked.position`;
    if (filter.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }
    const rows = (await this.raids.query(sql, params)) as Array<{
      userId: string;
      contributionXp: number | string;
      sortAt: string;
      position: number | string;
    }>;
    return rows.map((row) => ({
      userId: row.userId,
      contributionXp: Number(row.contributionXp),
      sortAt: String(row.sortAt),
      position: Number(row.position),
    }));
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
