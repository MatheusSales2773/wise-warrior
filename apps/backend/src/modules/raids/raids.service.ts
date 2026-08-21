import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Raid } from './entities/raid.entity';
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

@Injectable()
export class RaidsService {
  constructor(
    @InjectRepository(Raid) private readonly raids: Repository<Raid>,
    @InjectRepository(RaidContribution)
    private readonly contributions: Repository<RaidContribution>,
    private readonly guilds: GuildsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async findById(raidId: string): Promise<RaidDetail> {
    const raid = await this.findActiveOrAnyRaid(raidId);
    return {
      id: raid.id,
      title: raid.title,
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

  async ranking(raidId: string): Promise<Array<{ userId: string; xpContributed: number }>> {
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

  private async findActiveOrAnyRaid(raidId: string): Promise<Raid> {
    const raid = await this.raids.findOne({ where: { id: raidId } });
    if (!raid) {
      throw new NotFoundException('Raid não encontrada');
    }
    return raid;
  }
}
