import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from '../progression/entities/character.entity';
import { User } from '../users/entities/user.entity';
import { Guild } from './entities/guild.entity';
import { GuildMembership, type GuildRole } from './entities/guild-membership.entity';
import { CreateGuildDto } from './dto/create-guild.dto';
import { GUILD_MEMBERS_PAGE_SIZE_DEFAULT, type ListGuildMembersQueryDto } from './dto/list-guild-members-query.dto';
import { GUILDS_PAGE_SIZE_DEFAULT, type ListGuildsQueryDto } from './dto/list-guilds-query.dto';

export interface GuildSummary {
  id: string;
  name: string;
  level: number;
  memberCount: number;
}

export interface GuildDetail extends GuildSummary {
  /** Null only for a guild whose leader membership is missing (legacy data). */
  leader: { userId: string; displayName: string } | null;
}

export interface MyGuild {
  guild: GuildDetail;
  role: GuildRole;
}

export interface GuildPage {
  items: GuildSummary[];
  nextCursor: string | null;
}

export interface GuildMember {
  userId: string;
  displayName: string;
  level: number;
  title: string | null;
  role: GuildRole;
  joinedAt: Date;
}

export interface GuildMemberPage {
  items: GuildMember[];
  nextCursor: string | null;
}

const ALREADY_IN_GUILD = 'Você já participa de uma guilda';
const NAME_TAKEN = 'Já existe uma guilda com esse nome';

/** MySQL duplicate-key error, raised when a concurrent request wins the single-guild-per-user unique index. */
function isDuplicateEntry(error: unknown): boolean {
  const candidate = error as { code?: string; driverError?: { code?: string } } | null;
  return candidate?.code === 'ER_DUP_ENTRY' || candidate?.driverError?.code === 'ER_DUP_ENTRY';
}

function encodeCursor(guild: { name: string; id: string }): string {
  return Buffer.from(JSON.stringify([guild.name, guild.id]), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { name: string; id: string } {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
      return { name: parsed[0], id: parsed[1] };
    }
  } catch {
    // Falls through to the validation error below.
  }
  throw new BadRequestException('Cursor inválido');
}

function encodeMemberCursor(joinedAt: Date, id: string): string {
  return Buffer.from(JSON.stringify([new Date(joinedAt).toISOString(), id]), 'utf8').toString('base64url');
}

function decodeMemberCursor(cursor: string): { joinedAt: Date; id: string } {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
      const joinedAt = new Date(parsed[0]);
      if (!Number.isNaN(joinedAt.getTime())) return { joinedAt, id: parsed[1] };
    }
  } catch {
    // Falls through to the validation error below.
  }
  throw new BadRequestException('Cursor inválido');
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

@Injectable()
export class GuildsService {
  constructor(
    @InjectRepository(Guild) private readonly guilds: Repository<Guild>,
    @InjectRepository(GuildMembership)
    private readonly memberships: Repository<GuildMembership>,
  ) {}

  async create(userId: string, dto: CreateGuildDto): Promise<Guild> {
    if (await this.memberships.findOne({ where: { userId } })) {
      throw new ConflictException(ALREADY_IN_GUILD);
    }
    const existing = await this.guilds.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(NAME_TAKEN);
    }
    try {
      return await this.guilds.manager.transaction(async (manager) => {
        const guild = await manager.save(
          manager.create(Guild, { name: dto.name, level: 1, createdBy: userId }),
        );
        await manager.save(
          manager.create(GuildMembership, { guildId: guild.id, userId, role: 'leader' }),
        );
        return guild;
      });
    } catch (error) {
      if (isDuplicateEntry(error)) {
        // Two unique indexes can lose a race here: the guild name or the single-guild-per-user rule.
        throw new ConflictException(
          String((error as Error).message).includes('UQ_guilds_name') ? NAME_TAKEN : ALREADY_IN_GUILD,
        );
      }
      throw error;
    }
  }

  async findById(guildId: string): Promise<GuildDetail> {
    const guild = await this.guilds.findOne({ where: { id: guildId } });
    if (!guild) {
      throw new NotFoundException('Guilda não encontrada');
    }
    const memberCount = await this.memberships.count({ where: { guildId } });
    const leaderMembership = await this.memberships.findOne({
      where: { guildId, role: 'leader' },
      relations: ['user'],
    });
    return {
      id: guild.id,
      name: guild.name,
      level: guild.level,
      memberCount,
      leader: leaderMembership
        ? { userId: leaderMembership.userId, displayName: leaderMembership.user.displayName }
        : null,
    };
  }

  /** Members are visible to the guild's own members only. */
  async listMembers(guildId: string, requesterId: string, query: ListGuildMembersQueryDto): Promise<GuildMemberPage> {
    if (!(await this.guilds.findOne({ where: { id: guildId } }))) {
      throw new NotFoundException('Guilda não encontrada');
    }
    if (!(await this.isMember(guildId, requesterId))) {
      throw new ForbiddenException('Apenas membros da guilda podem ver seus membros');
    }

    const limit = query.limit ?? GUILD_MEMBERS_PAGE_SIZE_DEFAULT;
    const qb = this.memberships
      .createQueryBuilder('membership')
      .innerJoin(User, 'member', 'member.id = membership.userId')
      .leftJoin(Character, 'character', 'character.userId = membership.userId')
      .select('membership.id', 'membershipId')
      .addSelect('membership.userId', 'userId')
      .addSelect('member.displayName', 'displayName')
      .addSelect('character.level', 'level')
      .addSelect('character.title', 'title')
      .addSelect('membership.role', 'role')
      .addSelect('membership.joinedAt', 'joinedAt')
      .where('membership.guildId = :guildId', { guildId })
      .orderBy('membership.joinedAt', 'ASC')
      .addOrderBy('membership.id', 'ASC')
      .limit(limit + 1);

    if (query.cursor) {
      const after = decodeMemberCursor(query.cursor);
      qb.andWhere(
        '(membership.joinedAt > :afterJoinedAt OR (membership.joinedAt = :afterJoinedAt AND membership.id > :afterId))',
        { afterJoinedAt: after.joinedAt, afterId: after.id },
      );
    }

    const rows = await qb.getRawMany<{
      membershipId: string;
      userId: string;
      displayName: string;
      level: number | string | null;
      title: string | null;
      role: GuildRole;
      joinedAt: Date;
    }>();
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => ({
        userId: row.userId,
        displayName: row.displayName,
        level: Number(row.level ?? 1),
        title: row.title ?? null,
        role: row.role,
        joinedAt: row.joinedAt,
      })),
      nextCursor: rows.length > limit && last ? encodeMemberCursor(last.joinedAt, last.membershipId) : null,
    };
  }

  /**
   * Leaving is one transaction over the guild's memberships. The oldest remaining member takes over a vacated
   * leadership, and the guild ends when its last member leaves (raids cascade; study sessions keep their history).
   */
  async leave(guildId: string, userId: string): Promise<void> {
    await this.guilds.manager.transaction(async (manager) => {
      const members = await manager.find(GuildMembership, {
        where: { guildId },
        order: { joinedAt: 'ASC', id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const mine = members.find((member) => member.userId === userId);
      if (!mine) {
        throw new NotFoundException('Você não participa desta guilda');
      }
      const others = members.filter((member) => member.id !== mine.id);
      if (others.length === 0) {
        await manager.delete(Guild, { id: guildId });
        return;
      }
      await manager.delete(GuildMembership, { id: mine.id });
      if (mine.role === 'leader' && !others.some((member) => member.role === 'leader')) {
        await manager.update(GuildMembership, { id: others[0]!.id }, { role: 'leader' });
      }
    });
  }

  async findMine(userId: string): Promise<MyGuild> {
    const membership = await this.memberships.findOne({ where: { userId } });
    if (!membership) {
      throw new NotFoundException('Você não participa de nenhuma guilda');
    }
    return { guild: await this.findById(membership.guildId), role: membership.role };
  }

  async list(query: ListGuildsQueryDto): Promise<GuildPage> {
    const limit = query.limit ?? GUILDS_PAGE_SIZE_DEFAULT;
    const search = query.search?.trim();
    const qb = this.guilds
      .createQueryBuilder('guild')
      .leftJoin(GuildMembership, 'membership', 'membership.guildId = guild.id')
      .select('guild.id', 'id')
      .addSelect('guild.name', 'name')
      .addSelect('guild.level', 'level')
      .addSelect('COUNT(membership.id)', 'memberCount')
      .groupBy('guild.id')
      .addGroupBy('guild.name')
      .addGroupBy('guild.level')
      .orderBy('guild.name', 'ASC')
      .addOrderBy('guild.id', 'ASC')
      .limit(limit + 1);

    if (search) {
      qb.andWhere('guild.name LIKE :search', { search: `%${escapeLike(search)}%` });
    }
    if (query.cursor) {
      const after = decodeCursor(query.cursor);
      qb.andWhere('(guild.name > :afterName OR (guild.name = :afterName AND guild.id > :afterId))', {
        afterName: after.name,
        afterId: after.id,
      });
    }

    const rows = await qb.getRawMany<{ id: string; name: string; level: number | string; memberCount: number | string }>();
    const items = rows.slice(0, limit).map((row) => ({
      id: row.id,
      name: row.name,
      level: Number(row.level),
      memberCount: Number(row.memberCount),
    }));
    const last = items[items.length - 1];
    return { items, nextCursor: rows.length > limit && last ? encodeCursor(last) : null };
  }

  async addMember(guildId: string, userId: string): Promise<void> {
    const guild = await this.guilds.findOne({ where: { id: guildId } });
    if (!guild) {
      throw new NotFoundException('Guilda não encontrada');
    }
    const current = await this.memberships.findOne({ where: { userId } });
    if (current) {
      if (current.guildId === guildId) {
        return;
      }
      throw new ConflictException(ALREADY_IN_GUILD);
    }
    try {
      await this.memberships.save(
        this.memberships.create({ guildId, userId, role: 'member' }),
      );
    } catch (error) {
      if (!isDuplicateEntry(error)) {
        throw error;
      }
      // A concurrent join won: succeed only if it was to this same guild.
      const winner = await this.memberships.findOne({ where: { userId } });
      if (winner?.guildId !== guildId) {
        throw new ConflictException(ALREADY_IN_GUILD);
      }
    }
  }

  async isMember(guildId: string, userId: string): Promise<boolean> {
    const membership = await this.memberships.findOne({
      where: { guildId, userId },
    });
    return membership !== null;
  }
}
