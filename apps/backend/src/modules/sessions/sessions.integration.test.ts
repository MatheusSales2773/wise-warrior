import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { ProgressionService } from '../progression/progression.service';
import { RaidsService } from '../raids/raids.service';
import { SessionsService } from './sessions.service';
import { StudySession } from './entities/study-session.entity';
import {
  APPLICATION_MIGRATIONS,
  createIntegrationDatabase,
  type IntegrationDatabase,
} from '../../test/integration-database';

describe('recent study sessions against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  it('returns the five newest ended sessions with deterministic ties and user isolation', async () => {
    database = await createIntegrationDatabase('wise_sessions_integration');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const userRepository = dataSource.getRepository(User);
    const sessionRepository = dataSource.getRepository(StudySession);
    await userRepository.insert([
      { id: '00000000-0000-4000-8000-000000000001', email: 'one@example.com', passwordHash: 'hash', displayName: 'One', planTier: 'free' },
      { id: '00000000-0000-4000-8000-000000000002', email: 'two@example.com', passwordHash: 'hash', displayName: 'Two', planTier: 'free' },
      { id: '00000000-0000-4000-8000-000000000003', email: 'empty@example.com', passwordHash: 'hash', displayName: 'Empty', planTier: 'free' },
    ]);
    const endedAt = new Date('2026-01-02T12:00:00Z');
    await sessionRepository.insert([
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
        userId: '00000000-0000-4000-8000-000000000001', subject: `Subject ${index}`, mode: 'solo' as const,
        startedAt: new Date(endedAt.getTime() - 3600000), endedAt,
        durationValidSeconds: 3600, xpAwarded: 10,
      })),
      {
        id: '00000000-0000-4000-8000-000000000020', userId: '00000000-0000-4000-8000-000000000001', subject: 'Active', mode: 'solo',
        startedAt: endedAt, endedAt: null, durationValidSeconds: 0, xpAwarded: 0,
      },
      {
        id: '00000000-0000-4000-8000-000000000021', userId: '00000000-0000-4000-8000-000000000001', subject: 'Discarded', mode: 'solo',
        startedAt: new Date(endedAt.getTime() - 3600000), endedAt, durationValidSeconds: 0, xpAwarded: 0,
        discardedReason: 'continuous-session-exceeds-limit',
      },
      {
        id: '00000000-0000-4000-8000-000000000022', userId: '00000000-0000-4000-8000-000000000002', subject: 'Other user', mode: 'solo',
        startedAt: new Date(endedAt.getTime() - 3600000), endedAt, durationValidSeconds: 3600, xpAwarded: 10,
      },
    ]);

    const service = new SessionsService(
      sessionRepository,
      {} as ProgressionService,
      {} as RaidsService,
    );
    const result = await service.recent('00000000-0000-4000-8000-000000000001');

    expect(result).toHaveLength(5);
    expect(result.map((session) => session.id)).toEqual([
      '00000000-0000-4000-8000-000000000021',
      '00000000-0000-4000-8000-000000000015',
      '00000000-0000-4000-8000-000000000014',
      '00000000-0000-4000-8000-000000000013',
      '00000000-0000-4000-8000-000000000012',
    ]);
    expect(result.some((session) => session.subject === 'Active')).toBe(false);
    expect((await service.recent('00000000-0000-4000-8000-000000000001')).find((session) => session.subject === 'Discarded')).toEqual(
      expect.objectContaining({ xpAwarded: 0, discardedReason: 'continuous-session-exceeds-limit' }),
    );
    expect(await service.recent('00000000-0000-4000-8000-000000000002')).toEqual([
      expect.objectContaining({ subject: 'Other user' }),
    ]);
    expect(await service.recent('00000000-0000-4000-8000-000000000003')).toEqual([]);
  });

  it('returns metrics from valid ended sessions and excludes discarded sessions', async () => {
    database = await createIntegrationDatabase('wise_sessions_metrics_integration');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const userId = '00000000-0000-4000-8000-000000000031';
    await dataSource.getRepository(User).insert([
      { id: userId, email: 'metrics@example.com', passwordHash: 'hash', displayName: 'Metrics', planTier: 'free' },
      { id: '00000000-0000-4000-8000-000000000036', email: 'other-metrics@example.com', passwordHash: 'hash', displayName: 'Other', planTier: 'free' },
    ]);
    const anchor = new Date('2026-09-17T12:00:00.000Z');
    const today = anchor.toISOString().slice(0, 10);
    const dateAtNoon = (offset: number) => {
      const date = new Date(`${today}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      return date;
    };
    const windowStart = new Date('2026-07-24T00:00:00.000Z');
    const dayBeforeWindow = new Date('2026-07-23T23:59:59.000Z');
    await dataSource.getRepository(StudySession).insert([
      ...[-1, 0].map((offset, index) => ({
        id: `00000000-0000-4000-8000-${String(32 + index).padStart(12, '0')}`,
        userId, subject: `Valid ${offset}`, mode: 'solo' as const,
        startedAt: dateAtNoon(offset), endedAt: dateAtNoon(offset),
        durationValidSeconds: offset === 0 ? 1200 : 600, xpAwarded: 10,
      })),
      {
        id: '00000000-0000-4000-8000-000000000034', userId, subject: 'Discarded', mode: 'solo',
        startedAt: dateAtNoon(0), endedAt: dateAtNoon(0), durationValidSeconds: 9999,
        xpAwarded: 0, discardedReason: 'daily-limit-exceeded',
      },
      {
        id: '00000000-0000-4000-8000-000000000037', userId, subject: 'Active', mode: 'solo',
        startedAt: dateAtNoon(0), endedAt: null, durationValidSeconds: 0, xpAwarded: 0,
      },
      {
        id: '00000000-0000-4000-8000-000000000038', userId, subject: 'Window start', mode: 'solo',
        startedAt: windowStart, endedAt: windowStart, durationValidSeconds: 300, xpAwarded: 5,
      },
      {
        id: '00000000-0000-4000-8000-000000000039', userId, subject: 'Outside window', mode: 'solo',
        startedAt: dayBeforeWindow, endedAt: dayBeforeWindow, durationValidSeconds: 300, xpAwarded: 5,
      },
      {
        id: '00000000-0000-4000-8000-000000000035', userId: '00000000-0000-4000-8000-000000000036',
        subject: 'Other user', mode: 'solo', startedAt: dateAtNoon(0), endedAt: dateAtNoon(0),
        durationValidSeconds: 9999, xpAwarded: 10,
      },
    ]);

    const service = new SessionsService(
      dataSource.getRepository(StudySession),
      {} as ProgressionService,
      {} as RaidsService,
    );
    const result = await service.metrics(userId, anchor);

    expect(result.sessionsToday).toBe(1);
    expect(result.validSecondsToday).toBe(1200);
    expect(result.currentStreakDays).toBe(2);
    expect(result.longestStreakDays).toBe(2);
    expect(result.cadence.days).toHaveLength(56);
    expect(result.cadence.days[0]).toEqual({
      date: '2026-07-24', sessionCount: 1, validSeconds: 300, intensity: 1,
    });
    expect(result.cadence.days.at(-1)).toEqual({
      date: today, sessionCount: 1, validSeconds: 1200, intensity: 1,
    });
  });
});
