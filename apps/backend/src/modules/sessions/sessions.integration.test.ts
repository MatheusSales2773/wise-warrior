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
        startedAt: new Date(endedAt.getTime() - 3600000), endedAt: new Date(endedAt.getTime() - 1000), durationValidSeconds: 0, xpAwarded: 0,
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
      '00000000-0000-4000-8000-000000000015',
      '00000000-0000-4000-8000-000000000014',
      '00000000-0000-4000-8000-000000000013',
      '00000000-0000-4000-8000-000000000012',
      '00000000-0000-4000-8000-000000000011',
    ]);
    expect(result.some((session) => session.subject === 'Active')).toBe(false);
    expect((await service.recent('00000000-0000-4000-8000-000000000001')).find((session) => session.subject === 'Discarded')).toEqual(
      expect.objectContaining({ xpAwarded: 0, discardedReason: 'continuous-session-exceeds-limit' }),
    );
    expect(await service.recent('00000000-0000-4000-8000-000000000002')).toEqual([
      expect.objectContaining({ subject: 'Other user' }),
    ]);
  });
});
