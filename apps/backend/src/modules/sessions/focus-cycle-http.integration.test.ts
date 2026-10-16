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

describe('Focus cycle HTTP contract against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let sessionCounter: number;

  const userId = '00000000-0000-4000-8000-000000000a01';
  const otherUserId = '00000000-0000-4000-8000-000000000a02';

  async function recordSessions(owner: string, state: StudySessionState | null, count: number) {
    for (let index = 0; index < count; index += 1) {
      sessionCounter += 1;
      await dataSource!.getRepository(StudySession).insert({
        id: `00000000-0000-4000-8000-${String(2000 + sessionCounter).padStart(12, '0')}`,
        userId: owner,
        subject: null,
        mode: 'solo',
        raidId: null,
        startedAt: new Date(Date.UTC(2026, 8, 1, 8, sessionCounter)),
        endedAt: new Date(Date.UTC(2026, 8, 1, 8, sessionCounter, 30)),
        plannedDurationSeconds: 1500,
        state,
        durationValidSeconds: 1500,
        xpAwarded: 250,
      });
    }
  }

  const getCycle = (as: string | null = userId) => fetch(`${baseUrl}/api/v1/sessions/cycle`, {
    headers: as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as },
  });

  beforeEach(async () => {
    sessionCounter = 0;
    database = await createIntegrationDatabase('wise_focus_cycle_http');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert([
      { id: userId, email: 'cycle@example.com', passwordHash: 'hash', displayName: 'Cycle', planTier: 'free' },
      { id: otherUserId, email: 'cycle-other@example.com', passwordHash: 'hash', displayName: 'Other', planTier: 'free' },
    ]);

    const sessions = new SessionsService(
      dataSource.getRepository(StudySession),
      {} as ProgressionService,
      {} as RaidsService,
    );
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

  it('requires authentication', async () => {
    expect((await getCycle(null)).status).toBe(401);
  });

  it('starts empty for a user without completed focuses', async () => {
    const response = await getCycle();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ completedInCycle: 0, cycleLength: 4, nextBreak: 'short' });
  });

  it('counts completed focuses and offers the short break before the fourth', async () => {
    await recordSessions(userId, 'completed', 3);

    expect(await (await getCycle()).json()).toEqual({ completedInCycle: 3, cycleLength: 4, nextBreak: 'short' });
  });

  it('offers the long break after four completed focuses', async () => {
    await recordSessions(userId, 'completed', 4);

    expect(await (await getCycle()).json()).toEqual({ completedInCycle: 4, cycleLength: 4, nextBreak: 'long' });
  });

  it('starts a fresh cycle with the fifth completed focus', async () => {
    await recordSessions(userId, 'completed', 5);

    expect(await (await getCycle()).json()).toEqual({ completedInCycle: 1, cycleLength: 4, nextBreak: 'short' });
  });

  it('ignores early stops, cancellations, discards, running sessions and legacy sessions', async () => {
    await recordSessions(userId, 'completed', 2);
    await recordSessions(userId, 'stopped_early', 3);
    await recordSessions(userId, 'cancelled', 1);
    await recordSessions(userId, 'discarded', 1);
    await recordSessions(userId, 'running', 1);
    await recordSessions(userId, null, 2);

    expect(await (await getCycle()).json()).toEqual({ completedInCycle: 2, cycleLength: 4, nextBreak: 'short' });
  });

  it('never counts focuses of another user', async () => {
    await recordSessions(otherUserId, 'completed', 4);

    expect(await (await getCycle()).json()).toEqual({ completedInCycle: 0, cycleLength: 4, nextBreak: 'short' });
  });
});
