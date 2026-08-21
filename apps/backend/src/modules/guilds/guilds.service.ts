import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guild } from './entities/guild.entity';
import { GuildMembership } from './entities/guild-membership.entity';
import { CreateGuildDto } from './dto/create-guild.dto';

export interface GuildDetail {
  id: string;
  name: string;
  level: number;
  memberCount: number;
}

@Injectable()
export class GuildsService {
  constructor(
    @InjectRepository(Guild) private readonly guilds: Repository<Guild>,
    @InjectRepository(GuildMembership)
    private readonly memberships: Repository<GuildMembership>,
  ) {}

  async create(userId: string, dto: CreateGuildDto): Promise<Guild> {
    const existing = await this.guilds.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('Já existe uma guilda com esse nome');
    }
    const guild = await this.guilds.save(
      this.guilds.create({ name: dto.name, level: 1, createdBy: userId }),
    );
    await this.memberships.save(
      this.memberships.create({ guildId: guild.id, userId, role: 'leader' }),
    );
    return guild;
  }

  async findById(guildId: string): Promise<GuildDetail> {
    const guild = await this.guilds.findOne({ where: { id: guildId } });
    if (!guild) {
      throw new NotFoundException('Guilda não encontrada');
    }
    const memberCount = await this.memberships.count({ where: { guildId } });
    return { id: guild.id, name: guild.name, level: guild.level, memberCount };
  }

  async addMember(guildId: string, userId: string): Promise<void> {
    const guild = await this.guilds.findOne({ where: { id: guildId } });
    if (!guild) {
      throw new NotFoundException('Guilda não encontrada');
    }
    const existing = await this.memberships.findOne({ where: { guildId, userId } });
    if (existing) {
      return;
    }
    await this.memberships.save(
      this.memberships.create({ guildId, userId, role: 'member' }),
    );
  }

  async isMember(guildId: string, userId: string): Promise<boolean> {
    const membership = await this.memberships.findOne({
      where: { guildId, userId },
    });
    return membership !== null;
  }
}
