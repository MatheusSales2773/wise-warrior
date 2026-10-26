import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../shared/security/rate-limit';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import type { ProgressionService } from '../progression/progression.service';
import type { RaidsService } from '../raids/raids.service';
import { User } from '../users/entities/user.entity';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { StudySession, type StudySessionState } from './entities/study-session.entity';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { StudySessionStartService } from './study-session-start.service';
import { StudySessionTransitionService } from './study-session-transition.service';

type HistoryPage = {
  items: Array<{
    id: string;
    subject: string | null;
    kind: string;
    state: string | null;
    startedAt: string;
    endedAt: string;
    durationValidSeconds: number;
    xpAwarded: number;
    discardedReason: string | null;
    cappedReason: string | null;
    cyclePosition: number | null;
  }>;
  nextCursor: string | null;
};

describe('Diário (GET /sessions/history) against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let counter: number;

  const ana = '00000000-0000-4000-8000-000000000f01';
  const bruno = '00000000-0000-4000-8000-000000000f02';

  async function record(owner: string, endedAt: string | null, state: StudySessionState, extra: Partial<StudySession> = {}) {
    counter += 1;
    const id = `00000000-0000-4000-8000-${String(2000 + counter).padStart(12, '0')}`;
    const end = endedAt ? new Date(endedAt) : null;
    await dataSource!.getRepository(StudySession).insert({
      id,
      userId: owner,
      subject: 'Cálculo',
      mode: 'solo',
      raidId: null,
      startedAt: new Date((end ?? new Date('2026-09-01T12:00:00Z')).getTime() - 25 * 60_000),
      endedAt: end,
      plannedDurationSeconds: 1500,
      state,
      durationValidSeconds: state === 'completed' ? 1500 : 600,
      xpAwarded: state === 'completed' ? 250 : 0,
      ...extra,
    });
    return id;
  }

  const history = async (query = '?date=2026-09-01', as: string | null = ana) => fetch(`${baseUrl}/api/v1/sessions/history${query}`, {
    headers: as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as },
  });
  const page = async (query?: string) => (await history(query)).json() as Promise<HistoryPage>;

  beforeEach(async () => {
    counter = 0;
    database = await createIntegrationDatabase('wise_session_history_http');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert([
      { id: ana, email: 'ana@example.com', passwordHash: 'hash', displayName: 'Ana', planTier: 'free' },
      { id: bruno, email: 'bruno@example.com', passwordHash: 'hash', displayName: 'Bruno', planTier: 'free' },
    ]);

    const sessions = new SessionsService(dataSource.getRepository(StudySession), {} as ProgressionService, {} as RaidsService);
    const moduleRef = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: SessionsService, useValue: sessions },
        { provide: StudySessionStartService, useValue: {} },
        { provide: StudySessionTransitionService, useValue: {} },
      ],
    })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const request = context.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            user?: JwtPayload;
          }>();
          if (request.headers.authorization !== 'Bearer integration-token') throw new UnauthorizedException();
          request.user = { sub: request.headers['x-test-user-id']! } as JwtPayload;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await app?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  it('requires authentication and validates the query', async () => {
    expect((await history('', null)).status).toBe(401);
    expect((await history('?date=01/09/2026')).status).toBe(400);
    expect((await history('?date=2026-02-30')).status).toBe(400);
    expect((await history('?date=2026-09-01&cursor=nope')).status).toBe(400);
    expect((await history('?date=2026-09-01&limit=51')).status).toBe(400);
  });

  it('lists every outcome that counted on the São Paulo day, newest first, without cancellations', async () => {
    const early = await record(ana, '2026-09-01T03:00:00.000Z', 'completed');
    const stopped = await record(ana, '2026-09-01T10:00:00.000Z', 'stopped_early');
    const discarded = await record(ana, '2026-09-01T11:00:00.000Z', 'discarded', { discardedReason: 'heartbeat-gap', xpAwarded: 0 });
    const capped = await record(ana, '2026-09-01T12:00:00.000Z', 'stopped_early', { cappedReason: 'daily-limit' });
    const cancelled = await record(ana, '2026-09-02T02:59:59.999Z', 'cancelled');
    await record(ana, '2026-09-01T02:59:59.999Z', 'completed'); // 23:59:59 of the day before in São Paulo
    await record(ana, '2026-09-02T03:00:00.000Z', 'completed'); // midnight of the day after in São Paulo
    await record(ana, null, 'running'); // not ended yet
    await record(bruno, '2026-09-01T12:00:00.000Z', 'completed'); // someone else

    const result = await page();

    expect(result.nextCursor).toBeNull();
    expect(result.items.map((item) => item.id)).toEqual([capped, discarded, stopped, early]);
    expect(result.items.map((item) => item.id)).not.toContain(cancelled);
    expect(result.items.find((item) => item.id === discarded)).toMatchObject({ state: 'discarded', discardedReason: 'heartbeat-gap', xpAwarded: 0, cyclePosition: null });
    expect(result.items.find((item) => item.id === capped)).toMatchObject({ cappedReason: 'daily-limit', cyclePosition: null });
    expect(result.items.find((item) => item.id === early)).toMatchObject({ subject: 'Cálculo', durationValidSeconds: 1500, xpAwarded: 250 });
    expect(new Date(result.items[0]!.endedAt).toISOString()).toBe('2026-09-01T12:00:00.000Z');
  });

  it('numbers each focus completed in full in the Pomodoro cycle, restarting every São Paulo day', async () => {
    await record(ana, '2026-08-31T20:00:00.000Z', 'completed'); // the day before
    await record(ana, '2026-08-31T21:00:00.000Z', 'completed');
    await record(ana, '2026-09-01T09:00:00.000Z', 'stopped_early'); // never counts
    const first = await record(ana, '2026-09-01T10:00:00.000Z', 'completed');
    const second = await record(ana, '2026-09-01T11:00:00.000Z', 'completed');
    const third = await record(ana, '2026-09-01T12:00:00.000Z', 'completed');

    const byId = Object.fromEntries((await page()).items.map((item) => [item.id, item.cyclePosition]));

    expect(byId[first]).toBe(1);
    expect(byId[second]).toBe(2);
    expect(byId[third]).toBe(3);
  });

  it('restarts the numbering at São Paulo midnight', async () => {
    const lastOfDay = await record(ana, '2026-09-01T02:59:59.000Z', 'completed'); // 23:59:59 of Aug 31 in São Paulo
    const firstOfDay = await record(ana, '2026-09-01T03:00:00.000Z', 'completed'); // 00:00:00 of Sep 1

    const byId = Object.fromEntries((await page('?date=2026-09-01')).items.map((item) => [item.id, item.cyclePosition]));
    const previousDay = Object.fromEntries((await page('?date=2026-08-31')).items.map((item) => [item.id, item.cyclePosition]));

    expect(byId[firstOfDay]).toBe(1);
    expect(previousDay[lastOfDay]).toBe(1);
  });

  it('pages without repeating or skipping rows, even when two sessions end in the same millisecond', async () => {
    const ids = [];
    for (const minute of [10, 20, 20, 30, 40]) {
      ids.push(await record(ana, `2026-09-01T08:${String(minute).padStart(2, '0')}:00.123Z`, 'completed'));
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const next: HistoryPage = await page(`?date=2026-09-01&limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      expect(next.items.length).toBeLessThanOrEqual(2);
      seen.push(...next.items.map((item) => item.id));
      cursor = next.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(5);
    expect([...seen].sort()).toEqual([...ids].sort());
  });

  it('pages across the São Paulo midnight without leaking the neighbouring days', async () => {
    const last = await record(ana, '2026-09-02T02:59:59.999Z', 'completed');
    const first = await record(ana, '2026-09-01T03:00:00.000Z', 'completed');
    await record(ana, '2026-09-01T02:59:59.999Z', 'completed'); // 23:59:59 of the day before
    await record(ana, '2026-09-02T03:00:00.000Z', 'completed'); // 00:00 of the day after

    const one = await page('?date=2026-09-01&limit=1');
    expect(one.items.map((item) => item.id)).toEqual([last]);
    const two = await page(`?date=2026-09-01&limit=1&cursor=${one.nextCursor}`);
    expect(two.items.map((item) => item.id)).toEqual([first]);
    expect(two.nextCursor).toBeNull();
  });

  it('returns an empty page for a day without sessions', async () => {
    expect(await page('?date=2026-09-03')).toEqual({ items: [], nextCursor: null });
  });

  it('pages through several days without a date, newest first, never listing running sessions or someone else\'s', async () => {
    const newest = await record(ana, '2026-09-03T15:00:00.000Z', 'completed');
    const middle = await record(ana, '2026-09-02T15:00:00.000Z', 'completed');
    const oldest = await record(ana, '2026-08-20T15:00:00.000Z', 'stopped_early');
    await record(ana, null, 'running');
    await record(bruno, '2026-09-02T16:00:00.000Z', 'completed');

    const one = await page('?limit=2');
    expect(one.items.map((item) => item.id)).toEqual([newest, middle]);
    const two = await page(`?limit=2&cursor=${one.nextCursor}`);
    expect(two.items.map((item) => item.id)).toEqual([oldest]);
    expect(two.nextCursor).toBeNull();
  });

  it.each([
    ['completed', ['plain', 'early']],
    ['truncated', ['capped']],
    ['discarded', ['discarded']],
  ])('filters %s on the server', async (state, expected) => {
    const ids: Record<string, string> = {
      plain: await record(ana, '2026-09-01T10:00:00.000Z', 'completed'),
      early: await record(ana, '2026-09-01T11:00:00.000Z', 'stopped_early'),
      capped: await record(ana, '2026-09-01T12:00:00.000Z', 'stopped_early', { cappedReason: 'continuous-limit' }),
      discarded: await record(ana, '2026-09-01T13:00:00.000Z', 'discarded', { discardedReason: 'heartbeat-gap', xpAwarded: 0 }),
      cancelled: await record(ana, '2026-09-01T14:00:00.000Z', 'cancelled'),
    };

    const result = await page(`?state=${state}`);

    expect(result.items.map((item) => item.id).sort()).toEqual(expected.map((key) => ids[key]!).sort());
  });

  it('keeps the filter while paging across days', async () => {
    await record(ana, '2026-09-03T12:00:00.000Z', 'completed');
    const capped = await record(ana, '2026-09-02T12:00:00.000Z', 'completed', { cappedReason: 'daily-limit' });
    const older = await record(ana, '2026-09-01T12:00:00.000Z', 'stopped_early', { cappedReason: 'continuous-limit' });

    const one = await page('?state=truncated&limit=1');
    expect(one.items.map((item) => item.id)).toEqual([capped]);
    const two = await page(`?state=truncated&limit=1&cursor=${one.nextCursor}`);
    expect(two.items.map((item) => item.id)).toEqual([older]);
    expect(two.nextCursor).toBeNull();
  });

  it('rejects an unknown filter', async () => {
    expect((await history('?state=cancelled')).status).toBe(400);
  });

  it('lists a Foco livre as completed and keeps it out of the Pomodoro cycle', async () => {
    const free = await record(ana, '2026-09-01T10:00:00.000Z', 'stopped_early', { kind: 'free', plannedDurationSeconds: null });

    const result = await page('?state=completed');

    expect(result.items.map((item) => item.id)).toEqual([free]);
    expect(result.items[0]).toMatchObject({ kind: 'free', cyclePosition: null });
  });
});
