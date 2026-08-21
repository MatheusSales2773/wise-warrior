import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudySession } from './entities/study-session.entity';
import { StartSessionDto } from './dto/start-session.dto';
import { validateSessionDuration } from './domain/session-validator';
import { xpForDuration } from './domain/xp-rate';
import { ProgressionService } from '../progression/progression.service';
import { RaidsService } from '../raids/raids.service';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(StudySession)
    private readonly studySessions: Repository<StudySession>,
    private readonly progression: ProgressionService,
    private readonly raids: RaidsService,
  ) {}

  async start(userId: string, dto: StartSessionDto): Promise<StudySession> {
    if (dto.mode === 'guild' && !dto.raidId) {
      throw new BadRequestException('raidId é obrigatório no modo guild');
    }
    const now = new Date();
    return this.studySessions.save(
      this.studySessions.create({
        userId,
        subject: dto.subject,
        mode: dto.mode,
        raidId: dto.mode === 'guild' ? dto.raidId : null,
        startedAt: now,
        lastHeartbeatAt: now,
      }),
    );
  }

  /**
   * Heartbeat periódico (UC03/S01) — o servidor, nunca o cliente, é quem
   * carimba o tempo. Isso é o que torna a validação antifraude possível.
   */
  async heartbeat(userId: string, sessionId: string): Promise<void> {
    const session = await this.loadOwnedActiveSession(userId, sessionId);
    session.lastHeartbeatAt = new Date();
    await this.studySessions.save(session);
  }

  async complete(userId: string, sessionId: string): Promise<StudySession> {
    const session = await this.loadOwnedActiveSession(userId, sessionId);
    const endedAt = new Date();
    const priorDailySeconds = await this.sumValidSecondsToday(userId, sessionId);

    const validation = validateSessionDuration({
      startedAt: session.startedAt,
      endedAt,
      priorDailySeconds,
    });

    session.endedAt = endedAt;
    session.durationValidSeconds = validation.validSeconds;
    session.discardedReason = validation.discardedReason;
    session.xpAwarded = validation.discardedReason
      ? 0
      : xpForDuration(validation.validSeconds);
    await this.studySessions.save(session);

    if (!validation.discardedReason && session.xpAwarded > 0) {
      await this.progression.awardXp(userId, session.xpAwarded);
      if (session.mode === 'guild' && session.raidId) {
        await this.raids.recordContribution(
          session.raidId,
          userId,
          session.id,
          session.xpAwarded,
        );
      }
    }

    return session;
  }

  private async loadOwnedActiveSession(
    userId: string,
    sessionId: string,
  ): Promise<StudySession> {
    const session = await this.studySessions.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('Sessão não encontrada');
    }
    if (session.endedAt) {
      throw new BadRequestException('Sessão já encerrada');
    }
    return session;
  }

  private async sumValidSecondsToday(
    userId: string,
    excludeSessionId: string,
  ): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const row = await this.studySessions
      .createQueryBuilder('session')
      .select('COALESCE(SUM(session.durationValidSeconds), 0)', 'total')
      .where('session.userId = :userId', { userId })
      .andWhere('session.id != :excludeSessionId', { excludeSessionId })
      .andWhere('session.endedAt >= :startOfDay', { startOfDay })
      .andWhere('session.discardedReason IS NULL')
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }
}
