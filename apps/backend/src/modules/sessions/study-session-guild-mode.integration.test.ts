import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { Guild } from '../guilds/entities/guild.entity';
import { GuildMembership } from '../guilds/entities/guild-membership.entity';
import { GuildsController } from '../guilds/guilds.controller';
import { GuildsService } from '../guilds/guilds.service';
import { Character } from '../progression/entities/character.entity';
import { ProgressionService } from '../progression/progression.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Mission } from '../raids/entities/mission.entity';
import { Raid } from '../raids/entities/raid.entity';
import { RaidContribution } from '../raids/entities/raid-contribution.entity';
import { RaidParticipation } from '../raids/entities/raid-participation.entity';
import { GuildRaidsController } from '../raids/guild-raids.controller';
import { RAID_CLOCK } from '../raids/raid-clock';
import { RaidsController } from '../raids/raids.controller';
import { RaidsService } from '../raids/raids.service';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { StudySession } from './entities/study-session.entity';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { StudySessionStartService } from './study-session-start.service';
import { STUDY_SESSION_CLOCK, StudySessionTransitionService } from './study-session-transition.service';

type Snapshot = { id: string; mode: string; raidId: string | null; startedAt: string; state: string; xpAwarded: number };
type ActiveRaidBody = {
  id: string;
  progressXp: number;
  goalXp: number;
  goalReachedAt: string | null;
  status: string;
  me: { participating: boolean; contributionXp: number };
};

describe('Study Session de modo Guilda against MySQL', () => {
  jest.setTimeout(60_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let realtime: { emitToGuild: jest.Mock; emitToUser: jest.Mock };
  /** The completion clock; each test moves it to the end of the Study Session it completes. */
  let completionNow: Date;
  let guildId: string;
  let raidId: string;

  const ana = '00000000-0000-4000-8000-000000000c01';
  const bruno = '00000000-0000-4000-8000-000000000c02';
  const carla = '00000000-0000-4000-8000-000000000c03';
  const diego = '00000000-0000-4000-8000-000000000c04';
  const outsider = '00000000-0000-4000-8000-000000000c05';

  const call = (method: string, path: string, as: string, body?: unknown, idempotencyKey?: string) => fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      authorization: 'Bearer integration-token',
      'x-test-user-id': as,
      'x-test-session-id': as.replace('c0', 'd0'),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const startGuildSession = (as: string, key: string, plannedDurationSeconds = 900) =>
    call('POST', '/sessions', as, { plannedDurationSeconds, mode: 'guild', raidId }, key);

  const completeAtDeadline = async (as: string, snapshot: Snapshot, key: string, plannedDurationSeconds = 900) => {
    completionNow = new Date(new Date(snapshot.startedAt).getTime() + plannedDurationSeconds * 1000);
    return call('POST', `/sessions/${snapshot.id}/complete`, as, { expectedVersion: 1 }, key);
  };

  const activeRaid = async (as = ana) => await (await call('GET', `/guilds/${guildId}/raids/active`, as)).json() as ActiveRaidBody;
  const contributions = () => dataSource!.getRepository(RaidContribution).findBy({ raidId });

  beforeEach(async () => {
    completionNow = new Date();
    database = await createIntegrationDatabase('wise_guild_session');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    const everyone = [ana, bruno, carla, diego, outsider];
    await dataSource.getRepository(User).insert(everyone.map((id, index) => ({
      id, email: `user${index}@example.com`, passwordHash: 'hash', displayName: `User ${index}`, planTier: 'free' as const,
    })));
    await dataSource.getRepository(Character).insert(everyone.map((userId) => ({ userId, level: 1, xpTotal: 0 })));

    realtime = { emitToGuild: jest.fn(), emitToUser: jest.fn() };
    const repo = (entity: Parameters<DataSource['getRepository']>[0]) => ({
      provide: getRepositoryToken(entity as never),
      useValue: dataSource!.getRepository(entity),
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [GuildsController, GuildRaidsController, RaidsController, SessionsController],
      providers: [
        GuildsService,
        RaidsService,
        UsersService,
        ProgressionService,
        StudySessionStartService,
        StudySessionTransitionService,
        repo(Guild), repo(GuildMembership), repo(Raid), repo(RaidContribution), repo(RaidParticipation), repo(Mission),
        repo(User), repo(CosmeticItem), repo(UserCosmeticItem), repo(Character),
        { provide: DataSource, useValue: dataSource },
        { provide: SessionsService, useValue: { usesCanonicalStudySessionState: async () => true } },
        { provide: RAID_CLOCK, useValue: () => new Date() },
        { provide: STUDY_SESSION_CLOCK, useValue: { now: () => new Date(completionNow) } },
        { provide: RealtimeGateway, useValue: realtime },
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
          request.user = { sub: request.headers['x-test-user-id']!, sessionId: request.headers['x-test-session-id']! } as JwtPayload;
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

    guildId = (await (await call('POST', '/guilds', ana, { name: 'Ordem do Foco' })).json() as { id: string }).id;
    for (const member of [bruno, carla, diego]) await call('POST', `/guilds/${guildId}/members`, member);
    await call('POST', '/guilds', outsider, { name: 'Outra Guilda' });
    raidId = (await activeRaid()).id;
    // A goal no test reaches by accident; the Meta batida test lowers it.
    await dataSource.getRepository(Raid).update({ id: raidId }, { goalXp: 100_000 });
  });

  afterEach(async () => {
    await app?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  describe('starting', () => {
    it('starts a guild-mode Study Session for a Participante of the active Raid', async () => {
      await call('POST', `/raids/${raidId}/join`, bruno);

      const started = await startGuildSession(bruno, 'guild-start');

      expect(started.status).toBe(201);
      expect(await started.json()).toMatchObject({ mode: 'guild', raidId, state: 'running' });
    });

    it('answers 403 to a member who is not a Participante yet, and starts nothing', async () => {
      expect((await startGuildSession(bruno, 'not-participating')).status).toBe(403);
      expect(await dataSource!.getRepository(StudySession).countBy({ userId: bruno })).toBe(0);
    });

    it('answers 403 to a user of another Guild', async () => {
      expect((await startGuildSession(outsider, 'outsider')).status).toBe(403);
    });

    it('answers 409 when the Raid already ended, by date or by status, and starts nothing', async () => {
      await call('POST', `/raids/${raidId}/join`, bruno);
      await dataSource!.getRepository(Raid).update({ id: raidId }, { endsAt: new Date(Date.now() - 1000) });
      const byDate = await startGuildSession(bruno, 'ended-by-date');
      expect(byDate.status).toBe(409);
      expect(await byDate.json()).toMatchObject({ type: 'https://wise.app/errors/raid-ended' });

      await dataSource!.getRepository(Raid).update({ id: raidId }, { endsAt: new Date(Date.now() + 86_400_000), status: 'expired' });
      expect((await startGuildSession(bruno, 'ended-by-status')).status).toBe(409);
      expect(await dataSource!.getRepository(StudySession).countBy({ userId: bruno })).toBe(0);
    });

    it('requires a raidId in guild mode and refuses one in solo mode', async () => {
      expect((await call('POST', '/sessions', bruno, { mode: 'guild' }, 'no-raid')).status).toBe(400);
      expect((await call('POST', '/sessions', bruno, { raidId }, 'solo-with-raid')).status).toBe(400);
    });

    it('refuses to replay a start key with another mode', async () => {
      await call('POST', `/raids/${raidId}/join`, bruno);
      expect((await call('POST', '/sessions', bruno, { plannedDurationSeconds: 900 }, 'same-key')).status).toBe(201);
      expect((await startGuildSession(bruno, 'same-key')).status).toBe(409);
    });
  });

  describe('contributing', () => {
    const joinAndStart = async (as: string, key: string, plannedDurationSeconds = 900) => {
      await call('POST', `/raids/${raidId}/join`, as);
      const started = await startGuildSession(as, `${key}-start`, plannedDurationSeconds);
      expect(started.status).toBe(201);
      return await started.json() as Snapshot;
    };

    it('adds the XP of a completed guild-mode Study Session to the progress and to the member Contribution', async () => {
      const session = await joinAndStart(bruno, 'complete');

      const completed = await completeAtDeadline(bruno, session, 'complete-done');

      expect(completed.status).toBe(200);
      expect(await completed.json()).toMatchObject({ state: 'completed', xpAwarded: 150 });
      expect(await activeRaid(bruno)).toMatchObject({ progressXp: 150, goalReachedAt: null, me: { participating: true, contributionXp: 150 } });
      expect((await activeRaid(ana)).me.contributionXp).toBe(0);
      expect(await contributions()).toEqual([expect.objectContaining({ userId: bruno, studySessionId: session.id, xpContributed: 150 })]);
      expect(realtime.emitToGuild).toHaveBeenCalledWith(guildId, 'raid:progress', {
        raidId, progressXp: 150, goalXp: 100_000, goalReachedAt: null,
      });
    });

    it('does not add twice when the completion is replayed', async () => {
      const session = await joinAndStart(bruno, 'replay');

      expect((await completeAtDeadline(bruno, session, 'replay-done')).status).toBe(200);
      expect((await completeAtDeadline(bruno, session, 'replay-done')).status).toBe(200);

      expect((await activeRaid()).progressXp).toBe(150);
      expect(await contributions()).toHaveLength(1);
      expect(realtime.emitToGuild).toHaveBeenCalledTimes(1);
    });

    it('sums exactly when several members complete at the same time', async () => {
      const members = [ana, bruno, carla, diego];
      const sessions = await Promise.all(members.map((member) => joinAndStart(member, `together-${member}`)));
      // Every session completes at its own deadline; the latest one covers them all.
      completionNow = new Date(Math.max(...sessions.map((session) => new Date(session.startedAt).getTime())) + 900_000);

      const statuses = await Promise.all(sessions.map(async (session, index) =>
        (await call('POST', `/sessions/${session.id}/complete`, members[index]!, { expectedVersion: 1 }, `together-done-${index}`)).status,
      ));

      expect(statuses).toEqual([200, 200, 200, 200]);
      expect((await activeRaid()).progressXp).toBe(4 * 150);
      expect(await contributions()).toHaveLength(4);
    });

    it('does not count a Study Session completed after the Raid ended', async () => {
      const session = await joinAndStart(bruno, 'late');
      await dataSource!.getRepository(Raid).update({ id: raidId }, { endsAt: new Date(new Date(session.startedAt).getTime() + 60_000) });

      const completed = await completeAtDeadline(bruno, session, 'late-done');

      expect(completed.status).toBe(200);
      expect(await completed.json()).toMatchObject({ state: 'completed', xpAwarded: 150 });
      const raid = await dataSource!.getRepository(Raid).findOneByOrFail({ id: raidId });
      expect(raid.progressXp).toBe(0);
      expect(await contributions()).toEqual([]);
      expect(realtime.emitToGuild).not.toHaveBeenCalled();
    });

    it('does not count a Study Session cancelled before five minutes', async () => {
      const session = await joinAndStart(bruno, 'short');
      completionNow = new Date(new Date(session.startedAt).getTime() + 120_000);

      const stopped = await call('POST', `/sessions/${session.id}/stop`, bruno, { expectedVersion: 1 }, 'short-stop');

      expect(await stopped.json()).toMatchObject({ state: 'cancelled', xpAwarded: 0 });
      expect((await activeRaid()).progressXp).toBe(0);
      expect(await contributions()).toEqual([]);
    });

    it('counts a Study Session stopped early after five minutes with the XP it earned', async () => {
      const session = await joinAndStart(bruno, 'early');
      completionNow = new Date(new Date(session.startedAt).getTime() + 600_000);

      const stopped = await call('POST', `/sessions/${session.id}/stop`, bruno, { expectedVersion: 1 }, 'early-stop');

      expect(await stopped.json()).toMatchObject({ state: 'stopped_early', xpAwarded: 100 });
      expect((await activeRaid()).progressXp).toBe(100);
    });

    it('does not count a Study Session discarded by the antifraude', async () => {
      const session = await joinAndStart(bruno, 'discarded');
      completionNow = new Date(new Date(session.startedAt).getTime() + 900_000);
      // Earlier focus today already used the whole daily limit.
      await dataSource!.getRepository(StudySession).save(dataSource!.getRepository(StudySession).create({
        userId: bruno, subject: null, mode: 'solo', raidId: null,
        startedAt: new Date(completionNow.getTime() - 2_000), endedAt: new Date(completionNow.getTime() - 1_000),
        durationValidSeconds: 16 * 60 * 60, xpAwarded: 0,
      }));

      const completed = await completeAtDeadline(bruno, session, 'discarded-done');

      expect(await completed.json()).toMatchObject({ state: 'discarded', xpAwarded: 0 });
      expect((await activeRaid()).progressXp).toBe(0);
      expect(await contributions()).toEqual([]);
    });

    it('records the Meta batida once and keeps adding Contributions until the end of the week', async () => {
      await dataSource!.getRepository(Raid).update({ id: raidId }, { goalXp: 200 });
      const first = await joinAndStart(bruno, 'goal-1');
      await completeAtDeadline(bruno, first, 'goal-1-done');
      expect(await activeRaid()).toMatchObject({ progressXp: 150, goalReachedAt: null });

      const second = await joinAndStart(carla, 'goal-2');
      await completeAtDeadline(carla, second, 'goal-2-done');
      const reachedAt = completionNow.toISOString();
      expect(await activeRaid()).toMatchObject({ progressXp: 300, goalReachedAt: reachedAt, status: 'active' });

      const third = await joinAndStart(diego, 'goal-3');
      await completeAtDeadline(diego, third, 'goal-3-done');
      expect(await activeRaid()).toMatchObject({ progressXp: 450, goalReachedAt: reachedAt, status: 'active' });
      expect(realtime.emitToGuild).toHaveBeenLastCalledWith(guildId, 'raid:progress', {
        raidId, progressXp: 450, goalXp: 200, goalReachedAt: new Date(reachedAt),
      });
    });
  });
});
