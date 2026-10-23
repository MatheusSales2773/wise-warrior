import type { EntityManager } from 'typeorm';
import type { SessionCounts } from '../users/domain/unlock-condition';
import { COUNTED_SESSION_SQL } from './domain/counted-session';
import { countSessions } from './domain/session-counts';
import { StudySession } from './entities/study-session.entity';

/** Finished, non-discarded Study Sessions of the user (a session just saved in `manager`'s transaction included), bucketed by UTC hour like the metrics. */
export async function countFinishedSessions(manager: EntityManager, userId: string): Promise<SessionCounts> {
  const rows = await manager
    .getRepository(StudySession)
    .createQueryBuilder('session')
    .select("DATE_FORMAT(session.endedAt, '%Y-%m-%d %H')", 'hour')
    .addSelect('COUNT(session.id)', 'sessionCount')
    .where('session.userId = :userId', { userId })
    .andWhere('session.endedAt IS NOT NULL')
    .andWhere(COUNTED_SESSION_SQL)
    .groupBy("DATE_FORMAT(session.endedAt, '%Y-%m-%d %H')")
    .getRawMany<{ hour: string; sessionCount: string }>();
  return countSessions(rows.map((row) => ({ hour: row.hour, sessionCount: Number(row.sessionCount), validSeconds: 0 })));
}
