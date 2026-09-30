import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

describe('Recent subjects HTTP contract against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let sessionCounter: number;

  const userId = '00000000-0000-4000-8000-000000000091';
  const otherUserId = '00000000-0000-4000-8000-000000000092';
  const emptyUserId = '00000000-0000-4000-8000-000000000093';
  const baseTime = new Date('2026-09-01T12:00:00.000Z').getTime();
  const minutesAfterBase = (minutes: number) => new Date(baseTime + minutes * 60_000);

  async function recordSession(
    owner: string,
    subject: string | null,
    startedMinute: number,
    state: StudySessionState = 'completed',
  ) {
    sessionCounter += 1;
    await dataSource!.getRepository(StudySession).insert({
      id: `00000000-0000-4000-8000-${String(1000 + sessionCounter).padStart(12, '0')}`,
      userId: owner,
      subject,
      mode: 'solo',
      raidId: null,
      startedAt: minutesAfterBase(startedMinute),
      endedAt: state === 'running' || state === 'paused' ? null : minutesAfterBase(startedMinute + 25),
      plannedDurationSeconds: 1500,
      state,
      durationValidSeconds: 0,
      xpAwarded: 0,
    });
  }

  const getRecentSubjects = (as: string | null = userId) => fetch(`${baseUrl}/api/v1/sessions/subjects/recent`, {
    headers: as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as },
  });

  beforeEach(async () => {
    sessionCounter = 0;
    database = await createIntegrationDatabase('wise_recent_subjects_http');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert([
      { id: userId, email: 'subjects@example.com', passwordHash: 'hash', displayName: 'Subjects', planTier: 'free' },
      { id: otherUserId, email: 'subjects-other@example.com', passwordHash: 'hash', displayName: 'Other', planTier: 'free' },
      { id: emptyUserId, email: 'subjects-empty@example.com', passwordHash: 'hash', displayName: 'Empty', planTier: 'free' },
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
    const response = await getRecentSubjects(null);

    expect(response.status).toBe(401);
  });

  it('lists the subjects of the user from the most recent use to the oldest', async () => {
    await recordSession(userId, 'Cálculo II', 10);
    await recordSession(userId, 'Física', 30);
    await recordSession(userId, 'História', 20);

    const response = await getRecentSubjects();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ subjects: ['Física', 'História', 'Cálculo II'] });
  });

  it('returns at most six subjects, keeping the most recent ones', async () => {
    for (let minute = 1; minute <= 8; minute += 1) await recordSession(userId, `Matéria ${minute}`, minute * 10);

    const { subjects } = await (await getRecentSubjects()).json() as { subjects: string[] };

    expect(subjects).toEqual(['Matéria 8', 'Matéria 7', 'Matéria 6', 'Matéria 5', 'Matéria 4', 'Matéria 3']);
  });

  it('lists subjects that differ only by letter case once, spelled as in the most recent use', async () => {
    await recordSession(userId, 'cálculo ii', 10);
    await recordSession(userId, 'Física', 20);
    await recordSession(userId, 'CÁLCULO II', 30);
    await recordSession(userId, 'Cálculo II', 40);
    await recordSession(userId, 'fÍsica', 5);

    const { subjects } = await (await getRecentSubjects()).json() as { subjects: string[] };

    expect(subjects).toEqual(['Cálculo II', 'Física']);
  });

  it('keeps subjects that differ by accents as different subjects', async () => {
    await recordSession(userId, 'Calculo', 10);
    await recordSession(userId, 'Cálculo', 20);

    const { subjects } = await (await getRecentSubjects()).json() as { subjects: string[] };

    expect(subjects).toEqual(['Cálculo', 'Calculo']);
  });

  it('includes subjects from sessions in any state and ignores sessions without a subject', async () => {
    await recordSession(userId, 'Concluída', 10, 'completed');
    await recordSession(userId, 'Antecipada', 20, 'stopped_early');
    await recordSession(userId, 'Cancelada', 30, 'cancelled');
    await recordSession(userId, 'Descartada', 40, 'discarded');
    await recordSession(userId, 'Em andamento', 60, 'running');
    await recordSession(userId, null, 70, 'completed');

    const { subjects } = await (await getRecentSubjects()).json() as { subjects: string[] };

    expect(subjects).toEqual(['Em andamento', 'Descartada', 'Cancelada', 'Antecipada', 'Concluída']);
  });

  it('never returns subjects from another user', async () => {
    await recordSession(otherUserId, 'Segredo do outro', 100);
    await recordSession(userId, 'Minha matéria', 10);

    const { subjects } = await (await getRecentSubjects()).json() as { subjects: string[] };

    expect(subjects).toEqual(['Minha matéria']);
    expect(subjects).not.toContain('Segredo do outro');
  });

  it('returns an empty list for a user without subjects', async () => {
    await recordSession(emptyUserId, null, 10);
    await recordSession(otherUserId, 'De outro usuário', 20);

    const response = await getRecentSubjects(emptyUserId);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ subjects: [] });
  });

  it('fills the limit with distinct subjects even when recent uses repeat the same one', async () => {
    for (let minute = 1; minute <= 10; minute += 1) await recordSession(userId, 'Sempre o mesmo', 100 + minute);
    for (let minute = 1; minute <= 6; minute += 1) await recordSession(userId, `Antiga ${minute}`, minute);

    const { subjects } = await (await getRecentSubjects()).json() as { subjects: string[] };

    expect(subjects).toEqual(['Sempre o mesmo', 'Antiga 6', 'Antiga 5', 'Antiga 4', 'Antiga 3', 'Antiga 2']);
  });
});
