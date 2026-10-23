import { Injectable } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';
import type { MilestonesResponseDto } from './dto/milestones-response.dto';

/** Marcos de Crônicas (ADR-014): as Condições de desbloqueio dos Badges do Catálogo, com progresso. Lê pelos Services dos outros módulos (ADR-001). */
@Injectable()
export class MilestonesService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
  ) {}

  async list(userId: string): Promise<MilestonesResponseDto> {
    const items = await this.users.listMilestones(userId, await this.sessions.countFinishedSessions(userId));
    return { earned: items.filter(({ earned }) => earned).length, total: items.length, items };
  }
}
