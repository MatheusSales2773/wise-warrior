import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { Session } from '../auth/entities/session.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Character } from '../progression/entities/character.entity';
import { ProgressionService } from '../progression/progression.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { User } from '../users/entities/user.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { UsersController } from '../users/users.controller';
import { UsersService, type CatalogCosmeticItem } from '../users/users.service';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { StudySessionStartService } from './study-session-start.service';
import { StudySessionTransitionService } from './study-session-transition.service';

describe('Cosmetic Item unlock on level-up through the Study Session API', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let users: UsersService;
  let baseUrl: string;
  let now: Date;
  let userId: string;

  const authSessionId = '00000000-0000-4000-8000-000000000f01';
  const headers = () => ({
    authorization: 'Bearer integration-token',
    'x-test-user-id': userId,
    'x-test-session-id': authSessionId,
  });

  const send = (method: 'GET' | 'POST', path: string, idempotencyKey?: string, body?: unknown) =>
    fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: {
        ...headers(),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  /** Starts a Study Session and lets its canonical deadline pass, so completing it awards its XP. */
  const startSession = async (plannedDurationSeconds: number, key: string) => {
    const started = await send('POST', '/sessions', `${key}-start`, { plannedDurationSeconds });
    const snapshot = await started.json() as { id: string; startedAt: string };
    now = new Date(new Date(snapshot.startedAt).getTime() + plannedDurationSeconds * 1000);
    const path = `/sessions/${snapshot.id}/complete`;
    return { path, complete: () => send('POST', path, `${key}-complete`, { expectedVersion: 1 }) };
  };

  const unlockedNames = async () => {
    const response = await send('GET', '/users/me/cosmetics');
    const catalog = await response.json() as CatalogCosmeticItem[];
    return catalog.filter((item) => item.unlocked).map((item) => item.name).sort();
  };

  const seedCharacterAt = (xpTotal: number, level: number) =>
    dataSource!.getRepository(Character).update({ userId }, { xpTotal, level });

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_levelup_unlock');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();

    now = new Date();
    const config = {
      get: (key: string) => (key === 'JWT_ACCESS_SECRET' ? 'integration-access-secret' : undefined),
    } as ConfigService;
    const realtime = { emitToUser: jest.fn() } as unknown as RealtimeGateway;
    // Users and progression reference each other; the profile read is not exercised here.
    users = new UsersService(
      dataSource.getRepository(User),
      dataSource.getRepository(UserCosmeticItem),
      dataSource.getRepository(CosmeticItem),
      {} as ProgressionService,
    );
    const progression = new ProgressionService(dataSource.getRepository(Character), realtime, users);
    const auth = new AuthService(
      dataSource.getRepository(User),
      dataSource.getRepository(Character),
      dataSource.getRepository(Session),
      new JwtService(),
      config,
      dataSource,
      users,
    );
    await auth.register({ email: 'veterana@example.com', password: 'senha-forte-123', displayName: 'Veterana' }, {});
    userId = (await dataSource.getRepository(User).findOneByOrFail({ email: 'veterana@example.com' })).id;

    const moduleRef = await Test.createTestingModule({
      controllers: [SessionsController, UsersController],
      providers: [
        { provide: SessionsService, useValue: { usesCanonicalStudySessionState: async () => true } },
        { provide: StudySessionStartService, useValue: new StudySessionStartService(dataSource, users, {} as never) },
        {
          provide: StudySessionTransitionService,
          useValue: new StudySessionTransitionService(dataSource, { now: () => new Date(now) }, progression, {} as never),
        },
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: auth },
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
          request.user = {
            sub: request.headers['x-test-user-id']!,
            sessionId: request.headers['x-test-session-id']!,
          } as JwtPayload;
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

  it('unlocks Madrugador when completing a Study Session takes the Character to level 3', async () => {
    await seedCharacterAt(2_500, 2);
    expect(await unlockedNames()).toEqual(['Aprendiz', 'Capuz do Erudito']);

    const completed = await (await startSession(900, 'level-3')).complete();

    expect(completed.status).toBe(200);
    expect(await unlockedNames()).toEqual(['Aprendiz', 'Capuz do Erudito', 'Madrugador']);
  });

  it('unlocks the items of every level reached by a gain that skips levels, without equipping them', async () => {
    // Presets cap a session at 500 XP, so the Inventory is made to lag behind the level: the rule must grant every level reached.
    await seedCharacterAt(5_500, 4);
    await dataSource!.getRepository(UserCosmeticItem).delete({
      userId,
      cosmeticItemId: 'c05e71c0-0000-4000-8000-000000000003',
    });

    const completed = await (await startSession(3_000, 'level-skip')).complete();

    expect(completed.status).toBe(200);
    const character = await dataSource!.getRepository(Character).findOneByOrFail({ userId });
    expect(character.level).toBe(5);
    const catalog = await (await send('GET', '/users/me/cosmetics')).json() as CatalogCosmeticItem[];
    expect(catalog.filter((item) => item.unlocked).map((item) => item.name).sort())
      .toEqual(['Aprendiz', 'Capuz do Erudito', 'Estudante Crepuscular', 'Madrugador']);
    expect(catalog.filter((item) => item.equipped).map((item) => item.name).sort())
      .toEqual(['Aprendiz', 'Capuz do Erudito']);
  });

  it('does not duplicate Inventory rows when the completion is replayed or the rule runs again', async () => {
    await seedCharacterAt(2_500, 2);
    const session = await startSession(900, 'replay');
    expect((await session.complete()).status).toBe(200);
    expect((await session.complete()).status).toBe(200);

    await dataSource!.transaction((manager) => users.unlockCosmeticItems(manager, userId, 3));

    expect(await dataSource!.getRepository(UserCosmeticItem).count({ where: { userId } })).toBe(3);
  });

  it('unlocks nothing and keeps the level when the XP transaction fails', async () => {
    await seedCharacterAt(2_500, 2);
    // The receipt insert is the last write of the transaction, after the XP and the unlock.
    await dataSource!.query('DROP TABLE study_session_transition_receipts');

    const completed = await (await startSession(900, 'rollback')).complete();

    expect(completed.status).toBe(500);
    expect(await unlockedNames()).toEqual(['Aprendiz', 'Capuz do Erudito']);
    const character = await dataSource!.getRepository(Character).findOneByOrFail({ userId });
    expect({ level: character.level, xpTotal: character.xpTotal }).toEqual({ level: 2, xpTotal: 2_500 });
  });
});
