import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guild } from './entities/guild.entity';
import { GuildMembership, type GuildRole } from './entities/guild-membership.entity';
import { CreateGuildDto } from './dto/create-guild.dto';
import { GUILDS_PAGE_SIZE_DEFAULT, type ListGuildsQueryDto } from './dto/list-guilds-query.dto';

export interface GuildDetail {
  id: string;
  name: string;
  level: number;
  memberCount: number;
}

export interface MyGuild {
  guild: GuildDetail;
  role: GuildRole;
}

export interface GuildPage {
  items: GuildDetail[];
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
    return { id: guild.id, name: guild.name, level: guild.level, memberCount };
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
