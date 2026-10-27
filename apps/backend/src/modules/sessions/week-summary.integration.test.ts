import { DataSource } from 'typeorm';
import type { ProgressionService } from '../progression/progression.service';
import type { RaidsService } from '../raids/raids.service';
import { User } from '../users/entities/user.entity';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { StudySession, type StudySessionState } from './entities/study-session.entity';
import { SessionsService } from './sessions.service';

describe('Semana do Diário (SessionsService.weekSummary) against MySQL', () => {
  jest.setTimeout(30_000);

  // Thursday 2026-10-22 in São Paulo: the week runs from 2026-10-19 to 2026-10-25.
  const now = new Date('2026-10-22T15:00:00Z');
  const ana = '00000000-0000-4000-8000-000000000e01';
  const bruno = '00000000-0000-4000-8000-000000000e02';

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let sessions: SessionsService;
  let counter: number;

  async function record(owner: string, endedAt: string, state: StudySessionState, extra: Partial<StudySession> = {}) {
    counter += 1;
    const end = new Date(endedAt);
    await dataSource!.getRepository(StudySession).insert({
      id: `00000000-0000-4000-8000-${String(3000 + counter).padStart(12, '0')}`,
      userId: owner,
      subject: 'Cálculo II',
      mode: 'solo',
      raidId: null,
      startedAt: new Date(end.getTime() - 25 * 60_000),
      endedAt: end,
      plannedDurationSeconds: 1500,
      state,
      durationValidSeconds: 1500,
      xpAwarded: 250,
      ...extra,
    });
  }

  beforeEach(async () => {
    counter = 0;
    database = await createIntegrationDatabase('wise_session_week_summary');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert([
      { id: ana, email: 'ana@example.com', passwordHash: 'hash', displayName: 'Ana', planTier: 'free' },
      { id: bruno, email: 'bruno@example.com', passwordHash: 'hash', displayName: 'Bruno', planTier: 'free' },
    ]);
    sessions = new SessionsService(dataSource.getRepository(StudySession), {} as ProgressionService, {} as RaidsService);
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  it('sums only the counted sessions of the São Paulo week of the user', async () => {
    await record(ana, '2026-10-19T03:00:00.000Z', 'completed'); // Monday 00:00 in São Paulo
    await record(ana, '2026-10-22T12:00:00.000Z', 'stopped_early', { durationValidSeconds: 600, xpAwarded: 80, cappedReason: 'daily-limit' });
    await record(ana, '2026-10-26T02:59:59.000Z', 'completed'); // Sunday 23:59:59 in São Paulo
    await record(ana, '2026-10-26T02:59:59.500Z', 'completed', { durationValidSeconds: 0, xpAwarded: 0 }); // the last second of Sunday
    await record(ana, '2026-10-19T02:59:59.000Z', 'completed'); // Sunday of the previous week
    await record(ana, '2026-10-26T03:00:00.000Z', 'completed'); // Monday of the next week
    await record(ana, '2026-10-21T12:00:00.000Z', 'discarded', { discardedReason: 'heartbeat-gap', xpAwarded: 0 });
    await record(ana, '2026-10-21T13:00:00.000Z', 'cancelled', { durationValidSeconds: 0, xpAwarded: 0 });
    await record(bruno, '2026-10-20T12:00:00.000Z', 'completed');

    const week = await sessions.weekSummary(ana, now);

    expect(week).toMatchObject({ weekStart: '2026-10-19', weekEnd: '2026-10-25', today: '2026-10-22', sessionCount: 4, validSeconds: 3600, xp: 580 });
    expect(week.days.map((day) => day.sessionCount)).toEqual([1, 0, 0, 1, 0, 0, 2]);
  });

  it('groups subjects ignoring case and edge spaces, files the rest under "Sem matéria" and keeps four', async () => {
    await record(ana, '2026-10-20T12:00:00.000Z', 'completed', { subject: 'Cálculo II', durationValidSeconds: 1000 });
    await record(ana, '2026-10-21T12:00:00.000Z', 'completed', { subject: ' cálculo ii ', durationValidSeconds: 800 });
    await record(ana, '2026-10-21T13:00:00.000Z', 'completed', { subject: null, durationValidSeconds: 700 });
    for (const [subject, seconds] of [['B', 600], ['C', 500], ['D', 400], ['E', 300]] as const) {
      await record(ana, '2026-10-22T12:00:00.000Z', 'completed', { subject, durationValidSeconds: seconds });
    }

    const { subjects } = await sessions.weekSummary(ana, now);

    expect(subjects).toEqual([
      { subject: 'cálculo ii', validSeconds: 1800 },
      { subject: 'Sem matéria', validSeconds: 700 },
      { subject: 'B', validSeconds: 600 },
      { subject: 'C', validSeconds: 500 },
    ]);
  });
});
