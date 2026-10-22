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
import type { SessionHistoryItemDto, SessionHistoryPageDto } from './dto/session-history-response.dto';
import { SESSION_HISTORY_PAGE_SIZE_DEFAULT, type SessionHistoryQueryDto, type SessionHistoryState } from './dto/session-history-query.dto';
import { RecentSubjectsResponseDto } from './dto/recent-subjects-response.dto';
import { SessionMetricsResponseDto } from './dto/session-metrics-response.dto';
import {
  saoPauloDayKey,
  isSaoPauloDayKey,
  saoPauloDayStart,
  saoPauloNextDayKey,
  saoPauloPreviousDayKey,
} from '../../shared/time/sao-paulo-calendar';
import { buildCadence, calculateStreaks, groupActivityByDay } from './domain/session-metrics';
import { FOCUS_CYCLE_LENGTH, focusCycle, type FocusCycle } from './domain/focus-cycle';
import { decodeDatetimeCursor, encodeDatetimeCursor } from '../../shared/pagination/datetime-cursor';

const RECENT_SUBJECTS_LIMIT = 6;

/** What each Diário filter keeps, on top of dropping cancellations. A truncated session is capped, so it never counts as plain completed. */
const HISTORY_STATE_FILTER: Record<SessionHistoryState | 'all', string> = {
  all: '',
  completed: `AND session.capped_reason IS NULL AND (session.state IS NULL OR session.state IN ('completed', 'stopped_early'))`,
  truncated: `AND session.capped_reason IS NOT NULL AND (session.state IS NULL OR session.state <> 'discarded')`,
  discarded: `AND session.state = 'discarded'`,
};

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

  /** Where the user stands in the Pomodoro cadence: only focuses completed in full advance it. */
  async focusCycle(userId: string): Promise<FocusCycle> {
    const completedFocuses = await this.studySessions.count({ where: { userId, state: 'completed' } });
    return focusCycle(completedFocuses);
  }

  /**
   * Diário (#299): every Study Session that counted, newest first, through as many São Paulo days as the cursor walks,
   * or one day when `date` is given. Cancellations never appear. Each focus completed in full carries its place in the
   * Pomodoro cycle, counted over the same focuses as `focusCycle`.
   */
  async history(userId: string, query: SessionHistoryQueryDto): Promise<SessionHistoryPageDto> {
    const date = query.date ?? null;
    if (date !== null && !isSaoPauloDayKey(date)) {
      throw new BadRequestException('Data inválida');
    }
    const limit = query.limit ?? SESSION_HISTORY_PAGE_SIZE_DEFAULT;
    const after = query.cursor ? decodeDatetimeCursor(query.cursor) : null;

    const rows = await this.studySessions.manager.query<Array<{
      id: string;
      subject: string | null;
      mode: StudySession['mode'];
      state: StudySession['state'] | null;
      started_at: Date;
      ended_at: Date;
      ended_at_text: string;
      duration_valid_seconds: number | string;
      xp_awarded: number | string;
      discarded_reason: string | null;
      capped_reason: RecentSessionResponseDto['cappedReason'];
      cycle_number: number | string | null;
    }>>(
      `SELECT session.id, session.subject, session.mode, session.state, session.started_at, session.ended_at,
              DATE_FORMAT(session.ended_at, '%Y-%m-%d %H:%i:%s.%f') AS ended_at_text,
              session.duration_valid_seconds, session.xp_awarded, session.discarded_reason, session.capped_reason,
              completed.cycle_number
       FROM study_sessions session
       LEFT JOIN (
         SELECT id, ROW_NUMBER() OVER (ORDER BY ended_at, id) AS cycle_number
         FROM study_sessions WHERE user_id = ? AND state = 'completed'
       ) completed ON completed.id = session.id
       WHERE session.user_id = ?
         AND session.ended_at IS NOT NULL
         AND (session.state IS NULL OR session.state <> 'cancelled')
         ${HISTORY_STATE_FILTER[query.state ?? 'all']}
         ${date ? 'AND session.ended_at >= ? AND session.ended_at < ?' : ''}
         ${after ? 'AND (session.ended_at < ? OR (session.ended_at = ? AND session.id < ?))' : ''}
       ORDER BY session.ended_at DESC, session.id DESC
       LIMIT ?`,
      [
        userId, userId,
        ...(date ? [saoPauloDayStart(date), saoPauloDayStart(saoPauloNextDayKey(date))] : []),
        ...(after ? [after.datetime, after.datetime, after.id] : []),
        limit + 1,
      ],
    );
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row): SessionHistoryItemDto => ({
        id: row.id,
        subject: row.subject,
        mode: row.mode,
        state: row.state ?? null,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        durationValidSeconds: Number(row.duration_valid_seconds),
        xpAwarded: Number(row.xp_awarded),
        discardedReason: row.discarded_reason ?? null,
        cappedReason: row.capped_reason ?? null,
        cyclePosition: row.cycle_number === null ? null : ((Number(row.cycle_number) - 1) % FOCUS_CYCLE_LENGTH) + 1,
      })),
      nextCursor: rows.length > limit && last ? encodeDatetimeCursor(last.ended_at_text, last.id) : null,
    };
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
      cappedReason: session.cappedReason ?? null,
    }));
  }

  /**
   * Latest spelling of each distinct Matéria, newest use first. "Distinct" ignores letter case but
   * not accents, so the collation is set explicitly: the MySQL 8.0 default (`utf8mb4_0900_ai_ci`)
   * would also merge accents. Blank subjects only exist in rows from before the Matéria rules
   * (the old DTO accepted `''` and spaces) and are Sem matéria, never a suggestion.
   */
  async recentSubjects(userId: string): Promise<RecentSubjectsResponseDto> {
    const rows: Array<{ subject: string }> = await this.studySessions.query(
      `SELECT ranked.subject AS subject
         FROM (
           SELECT subject, started_at, id,
                  ROW_NUMBER() OVER (
                    PARTITION BY subject COLLATE utf8mb4_0900_as_ci
                    ORDER BY started_at DESC, id DESC
                  ) AS use_rank
             FROM study_sessions
            WHERE user_id = ? AND subject IS NOT NULL AND subject NOT REGEXP '^[[:space:]]*$'
         ) AS ranked
        WHERE ranked.use_rank = 1
        ORDER BY ranked.started_at DESC, ranked.id DESC
        LIMIT ?`,
      [userId, RECENT_SUBJECTS_LIMIT],
    );
    return { subjects: rows.map((row) => row.subject) };
  }

  /**
   * Returns dashboard metrics on the São Paulo calendar, anchored on one instant so a request that
   * crosses midnight stays deterministic. Days are bucketed here, not in SQL, because the MySQL
   * session runs in UTC (`timezone: 'Z'`) and `DATE_FORMAT` would group by the UTC day.
   */
  async metrics(userId: string, now: Date = new Date()): Promise<SessionMetricsResponseDto> {
    const today = saoPauloDayKey(now);
    const windowStart = saoPauloPreviousDayKey(today, 55);

    const rows = await this.studySessions
      .createQueryBuilder('session')
      .select("DATE_FORMAT(session.endedAt, '%Y-%m-%d %H')", 'hour')
      .addSelect('COUNT(session.id)', 'sessionCount')
      .addSelect('COALESCE(SUM(session.durationValidSeconds), 0)', 'validSeconds')
      .where('session.userId = :userId', { userId })
      .andWhere('session.endedAt IS NOT NULL')
      .andWhere('session.discardedReason IS NULL')
      .andWhere("(session.state IS NULL OR session.state IN ('completed', 'stopped_early'))")
      .groupBy("DATE_FORMAT(session.endedAt, '%Y-%m-%d %H')")
      .getRawMany<{ hour: string; sessionCount: string; validSeconds: string }>();

    const days = groupActivityByDay(
      rows.map((row) => ({ hour: row.hour, sessionCount: Number(row.sessionCount), validSeconds: Number(row.validSeconds) })),
      saoPauloDayKey,
    );
    const activity = days.filter((day) => day.date >= windowStart && day.date <= today);
    const streaks = calculateStreaks(days.map((day) => day.date), today);
    const cadence = buildCadence(activity, windowStart, today).map((day) => ({
      ...day,
      intensity: Math.min(day.sessionCount, 4) as 0 | 1 | 2 | 3 | 4,
    }));
    const todayActivity = days.find((day) => day.date === today);

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
  async heartbeat(userId: string, sessionId: string): Promise<void> {
    const session = await this.loadOwnedActiveSession(userId, sessionId);
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
    session.cappedReason = validation.cappedReason;
    session.xpAwarded = xpForDuration(validation.validSeconds);
    await this.studySessions.save(session);

    if (session.xpAwarded > 0) {
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

  async usesCanonicalStudySessionState(userId: string, sessionId: string): Promise<boolean> {
    const session = await this.studySessions.findOne({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('Sessão não encontrada');
    return session.state !== null && session.state !== undefined;
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
      .andWhere('session.startedAt >= :startOfDay', { startOfDay })
      .andWhere('session.discardedReason IS NULL')
      .andWhere("(session.state IS NULL OR session.state IN ('completed', 'stopped_early'))")
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }
}
