import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { GuildsService } from '../guilds/guilds.service';
import { UsersService } from '../users/users.service';
import type { ChooseNextMissionDto } from './dto/choose-next-mission.dto';
import { GuildMissionChoice } from './entities/guild-mission-choice.entity';
import { Mission } from './entities/mission.entity';
import { MissionsService } from './missions.service';

export interface MissionOwner {
  userId: string;
  displayName: string;
}

interface MissionSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  /** Missão do rodízio: grátis e de todos os membros, então sem dono declarado. */
  rotation: boolean;
}

export interface AvailableMission extends MissionSummary {
  owners: MissionOwner[];
}

export interface NextMissionChoice {
  mission: MissionSummary;
  owner: MissionOwner | null;
  chosenAt: Date;
}

const summarize = (mission: Mission): MissionSummary => ({
  id: mission.id,
  slug: mission.slug,
  name: mission.name,
  description: mission.description,
  imageUrl: mission.imageUrl,
  rotation: mission.price === null,
});

/**
 * Escolha da Missão da próxima Raid pelo Líder (ADR-012). A escolha é uma por Guild, trocável até o job de segunda
 * criar a Raid, que a consome. Só vale com dono ainda na Guild; senão a Raid usa o rodízio.
 */
@Injectable()
export class MissionChoiceService {
  constructor(
    @InjectRepository(GuildMissionChoice) private readonly choices: Repository<GuildMissionChoice>,
    private readonly missions: MissionsService,
    @Inject(forwardRef(() => GuildsService)) private readonly guilds: GuildsService,
    @Inject(forwardRef(() => UsersService)) private readonly users: UsersService,
  ) {}

  /** Missões possuídas pelos membros atuais, com o dono de cada uma. Só membros. */
  async listAvailable(guildId: string, requesterId: string): Promise<AvailableMission[]> {
    await this.assertMember(guildId, requesterId);
    const memberIds = await this.guilds.memberIds(guildId);
    const [catalog, ownersByMission, names] = await Promise.all([
      this.missions.listAll(),
      this.missions.ownersOf(memberIds),
      this.users.findDisplayNames(memberIds),
    ]);
    const nameById = new Map(names.map(({ id, displayName }) => [id, displayName]));
    const available: AvailableMission[] = [];
    for (const mission of catalog) {
      if (mission.price === null) {
        available.push({ ...summarize(mission), owners: [] });
        continue;
      }
      const owners = (ownersByMission.get(mission.id) ?? []).map((userId) => ({ userId, displayName: nameById.get(userId) ?? '' }));
      if (owners.length > 0) available.push({ ...summarize(mission), owners });
    }
    return available;
  }

  /** A escolha pendente, ou `null` se não há ou se o dono já saiu da Guild. Só membros. */
  async findCurrent(guildId: string, requesterId: string): Promise<NextMissionChoice | null> {
    await this.assertMember(guildId, requesterId);
    const choice = await this.choices.findOne({ where: { guildId } });
    if (!choice) return null;
    if (choice.ownerUserId !== null && !(await this.guilds.isMember(guildId, choice.ownerUserId))) return null;
    const mission = await this.missions.findById(choice.missionId);
    if (!mission) return null;
    const [owner] = choice.ownerUserId ? await this.users.findDisplayNames([choice.ownerUserId]) : [];
    return {
      mission: summarize(mission),
      owner: owner ? { userId: owner.id, displayName: owner.displayName } : null,
      chosenAt: choice.chosenAt,
    };
  }

  /** Só o Líder escolhe, e só entre Missões possuídas por um membro atual. Escolher de novo troca a escolha. */
  async choose(guildId: string, requesterId: string, dto: ChooseNextMissionDto): Promise<NextMissionChoice> {
    await this.assertMember(guildId, requesterId);
    if (!(await this.guilds.isLeader(guildId, requesterId))) {
      throw new ForbiddenException('Apenas o Líder escolhe a Missão da próxima Raid');
    }
    const mission = await this.missions.findById(dto.missionId);
    if (!mission) throw new NotFoundException('Missão não encontrada');

    let ownerUserId: string | null = null;
    if (mission.price !== null) {
      if (!dto.ownerId) throw new UnprocessableEntityException('Informe o dono da Missão');
      if (!(await this.guilds.isMember(guildId, dto.ownerId)) || !(await this.missions.owns(dto.ownerId, mission.id))) {
        throw new UnprocessableEntityException('A Missão precisa ser de um membro atual da guilda');
      }
      ownerUserId = dto.ownerId;
    }

    await this.choices.manager.transaction(async (manager) => {
      await manager.delete(GuildMissionChoice, { guildId });
      await manager.insert(GuildMissionChoice, { guildId, missionId: mission.id, ownerUserId });
    });
    const current = await this.findCurrent(guildId, requesterId);
    if (!current) throw new Error('Escolha não encontrada após gravar');
    return current;
  }

  /**
   * Chamado ao criar a Raid, na transação dela: devolve a Missão escolhida e apaga a escolha, que trava ali. Dono
   * que saiu antes (ou escolha sem Missão) → `null`, e a Raid usa o rodízio.
   */
  async consume(manager: EntityManager, guildId: string): Promise<Mission | null> {
    const choice = await manager.findOne(GuildMissionChoice, { where: { guildId }, lock: { mode: 'pessimistic_write' } });
    if (!choice) return null;
    await manager.delete(GuildMissionChoice, { guildId });
    if (choice.ownerUserId !== null && !(await this.guilds.isMemberIn(manager, guildId, choice.ownerUserId))) return null;
    return manager.findOne(Mission, { where: { id: choice.missionId } });
  }

  private async assertMember(guildId: string, userId: string): Promise<void> {
    if (!(await this.guilds.isMember(guildId, userId))) {
      throw new ForbiddenException('Apenas membros da guilda acessam a Missão da próxima Raid');
    }
  }
}
