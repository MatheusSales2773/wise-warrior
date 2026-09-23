import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { StudySession } from './entities/study-session.entity';
import { validateSessionDuration } from './domain/session-validator';
import { xpForDuration } from './domain/xp-rate';
import { ProgressionService } from '../progression/progression.service';
import { RaidsService } from '../raids/raids.service';
import { RecentSessionResponseDto } from './dto/recent-session-response.dto';
import { SessionMetricsResponseDto } from './dto/session-metrics-response.dto';
import { buildCadence, calculateStreaks, type SessionActivityDay } from './domain/session-metrics';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(StudySession)
    private readonly studySessions: Repository<StudySession>,
    private readonly progression: ProgressionService,
    private readonly raids: RaidsService,
  ) {}

  async start(userId: string, dto: { subject: string; mode: 'solo' | 'guild'; raidId?: string }): Promise<StudySession> {
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

  async recent(userId: string): Promise<RecentSessionResponseDto[]> {
    const sessions = await this.studySessions.find({
      where: { userId, endedAt: Not(IsNull()) },
      order: { endedAt: 'DESC', id: 'DESC' },
      take: 5,
    });

    return sessions.map((session) => ({
      id: session.id,
      subject: session.subject,
      mode: session.mode,
      state: session.state ?? null,
      startedAt: session.startedAt,
      endedAt: session.endedAt as Date,
      durationValidSeconds: session.durationValidSeconds,
      xpAwarded: session.xpAwarded,
      discardedReason: session.discardedReason ?? null,
    }));
  }

  /**
   * Returns dashboard metrics using one UTC anchor for all calendar
   * boundaries. This keeps a request deterministic even when it crosses
   * midnight and avoids depending on the MySQL session timezone.
   */
  async metrics(userId: string, now: Date = new Date()): Promise<SessionMetricsResponseDto> {
    const today = utcDateKey(now);
    const windowStart = previousDay(today, 55);
    const windowEndExclusive = nextDay(today);

    const cadenceRows = await this.studySessions
      .createQueryBuilder('session')
      .select("DATE_FORMAT(session.endedAt, '%Y-%m-%d')", 'date')
      .addSelect('COUNT(session.id)', 'sessionCount')
      .addSelect('COALESCE(SUM(session.durationValidSeconds), 0)', 'validSeconds')
      .where('session.userId = :userId', { userId })
      .andWhere('session.endedAt >= :windowStart', { windowStart: utcDayStart(windowStart) })
      .andWhere('session.endedAt < :windowEndExclusive', { windowEndExclusive: utcDayStart(windowEndExclusive) })
      .andWhere('session.discardedReason IS NULL')
      .andWhere("(session.state IS NULL OR session.state IN ('completed', 'stopped_early'))")
      .groupBy("DATE_FORMAT(session.endedAt, '%Y-%m-%d')")
      .getRawMany<{ date: string; sessionCount: string; validSeconds: string }>();

    const historicalRows = await this.studySessions
      .createQueryBuilder('session')
      .select("DATE_FORMAT(session.endedAt, '%Y-%m-%d')", 'date')
      .where('session.userId = :userId', { userId })
      .andWhere('session.endedAt IS NOT NULL')
      .andWhere('session.discardedReason IS NULL')
      .andWhere("(session.state IS NULL OR session.state IN ('completed', 'stopped_early'))")
      .groupBy("DATE_FORMAT(session.endedAt, '%Y-%m-%d')")
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string }>();

    const activity: SessionActivityDay[] = cadenceRows.map((row) => ({
      date: row.date,
      sessionCount: Number(row.sessionCount),
      validSeconds: Number(row.validSeconds),
    }));
    const streaks = calculateStreaks(historicalRows.map((row) => row.date), today);
    const cadence = buildCadence(activity, previousDay(today, 55), today).map((day) => ({
      ...day,
      intensity: Math.min(day.sessionCount, 4) as 0 | 1 | 2 | 3 | 4,
    }));
    const todayActivity = activity.find((day) => day.date === today);

    return {
      ...streaks,
      sessionsToday: todayActivity?.sessionCount ?? 0,
      dailyGoal: 4,
      validSecondsToday: todayActivity?.validSeconds ?? 0,
      cadence: { windowStart, windowEnd: today, days: cadence },
    };
  }

  /**
   * Heartbeat periódico (UC03/S01) — o servidor, nunca o cliente, é quem
   * carimba o tempo. Isso é o que torna a validação antifraude possível.
   */
  async heartbeat(userId: string, sessionId: string, authSessionId?: string): Promise<void> {
    const session = await this.loadOwnedActiveSession(userId, sessionId);
    if (session.state && session.initiatingSessionId !== authSessionId) {
      throw new ConflictException('Study Session iniciada em outra Session autenticada');
    }
    session.lastHeartbeatAt = new Date();
    await this.studySessions.save(session);
  }

  async complete(userId: string, sessionId: string): Promise<StudySession> {
    const session = await this.loadOwnedActiveSession(userId, sessionId);
    if (session.state) {
      throw new ConflictException('Conclusão canônica indisponível nesta etapa da Study Session');
    }
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
      .andWhere("(session.state IS NULL OR session.state IN ('completed', 'stopped_early'))")
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }
}

function previousDay(date: string, days: number): string {
  const value = utcDayStart(date);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function nextDay(date: string): string {
  const value = utcDayStart(date);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function utcDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function utcDayStart(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
