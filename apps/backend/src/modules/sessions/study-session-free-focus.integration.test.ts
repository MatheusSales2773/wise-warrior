import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CoinBalance } from '../economy/entities/coin-balance.entity';
import { CoinLedgerEntry } from '../economy/entities/coin-ledger-entry.entity';
import { EconomyService } from '../economy/economy.service';
import { Character } from '../progression/entities/character.entity';
import { ProgressionService } from '../progression/progression.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { Guild } from '../guilds/entities/guild.entity';
import { Mission } from '../raids/entities/mission.entity';
import { Raid } from '../raids/entities/raid.entity';
import { saoPauloDayKey } from '../../shared/time/sao-paulo-calendar';
import { StudySession } from './entities/study-session.entity';
import { SessionsService } from './sessions.service';
import { StudySessionStartService } from './study-session-start.service';
import { StudySessionEventsService } from './study-session-events.service';
import { StudySessionTransitionService } from './study-session-transition.service';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import type { StudySessionSnapshot } from './study-session-snapshot';

const CONTINUOUS_LIMIT_SECONDS = 4 * 3600;

describe('Foco livre against MySQL', () => {
  jest.setTimeout(30_000);
  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let realtime: { emitToUser: jest.Mock };
  let clock: Date;
  let raids: { assertCanStartGuildSession: jest.Mock; recordContributionInTransaction: jest.Mock; publishContribution: jest.Mock };
  let start: StudySessionStartService;
  let transitions: StudySessionTransitionService;
  const userId = '00000000-0000-4000-8000-000000000f01';
  let keys = 0;
  const key = () => `free-${keys += 1}`;

  const startFree = (body: Record<string, unknown> = {}) => start.start(userId, 'device-a', { kind: 'free', ...body } as never, key());
  const command = (action: 'pause' | 'resume' | 'stop' | 'complete', snapshot: StudySessionSnapshot) =>
    transitions[action]({
      userId, authSessionId: 'device-a', studySessionId: snapshot.id, dto: { expectedVersion: snapshot.version }, idempotencyKey: key(),
    });

  beforeEach(async () => {
    keys = 0;
    database = await createIntegrationDatabase('wise_free_focus');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert({ id: userId, email: 'free@example.com', passwordHash: 'hash', displayName: 'Free', planTier: 'free' });
    await dataSource.getRepository(Character).insert({ userId, level: 1, xpTotal: 0 });
    realtime = { emitToUser: jest.fn() };
    raids = {
      assertCanStartGuildSession: jest.fn().mockResolvedValue(undefined),
      recordContributionInTransaction: jest.fn().mockResolvedValue({ status: 'contributed', xpContributed: 0 }),
      publishContribution: jest.fn(),
    };
    clock = new Date();
    const users = new UsersService({} as never, {} as never, {} as never, {} as never);
    const gateway = realtime as unknown as RealtimeGateway;
    const progression = new ProgressionService(dataSource.getRepository(Character), gateway, users);
    const economy = new EconomyService(dataSource.getRepository(CoinBalance), dataSource.getRepository(CoinLedgerEntry), gateway);
    const events = new StudySessionEventsService(gateway);
    transitions = new StudySessionTransitionService(dataSource, { now: () => new Date(clock) }, progression, raids as never, economy, users, events, { settleInTransaction: async () => [] } as never);
    start = new StudySessionStartService(dataSource, users, raids as never, transitions, events);
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  it('starts a running snapshot without planned duration and with the ceiling as deadline', async () => {
    const started = await startFree();
    expect(started).toMatchObject({ kind: 'free', state: 'running', plannedDurationSeconds: null, remainingSeconds: 0 });
    expect(started.runDeadlineAt!.getTime() - started.startedAt.getTime()).toBe(CONTINUOUS_LIMIT_SECONDS * 1000);
    expect(await dataSource!.getRepository(StudySession).findOneByOrFail({ id: started.id }))
      .toMatchObject({ kind: 'free', plannedDurationSeconds: null });
  });

  it('keeps starting a Ciclo when kind is absent and rejects a free focus with a planned duration', async () => {
    await expect(startFree({ plannedDurationSeconds: 1500 })).rejects.toBeInstanceOf(BadRequestException);
    const cycle = await start.start(userId, 'device-a', {}, key());
    expect(cycle).toMatchObject({ kind: 'cycle', plannedDurationSeconds: 1500 });
  });

  it('replays the same receipt but rejects reusing a key with another kind', async () => {
    const first = await start.start(userId, 'device-a', { kind: 'free' }, 'same-key');
    expect(await start.start(userId, 'device-a', { kind: 'free' }, 'same-key')).toMatchObject({ id: first.id, kind: 'free' });
    await expect(start.start(userId, 'device-a', {}, 'same-key')).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to start when the daily balance is gone', async () => {
    await dataSource!.getRepository(StudySession).insert({
      userId, subject: null, mode: 'solo', kind: 'cycle', startedAt: new Date(), endedAt: new Date(), state: 'completed',
      plannedDurationSeconds: 1500, durationValidSeconds: 16 * 3600, xpAwarded: 0,
    });
    await expect(startFree()).rejects.toMatchObject({
      response: { type: 'https://wise.app/errors/daily-limit-reached' },
    });
    await expect(start.start(userId, 'device-a', {}, key())).resolves.toMatchObject({ kind: 'cycle' });
  });

  it('caps the ceiling at the remaining daily balance', async () => {
    await dataSource!.getRepository(StudySession).insert({
      userId, subject: null, mode: 'solo', kind: 'cycle', startedAt: new Date(), endedAt: new Date(), state: 'completed',
      plannedDurationSeconds: 1500, durationValidSeconds: 15 * 3600, xpAwarded: 0,
    });
    const started = await startFree();
    expect(started.runDeadlineAt!.getTime() - started.startedAt.getTime()).toBe(3600 * 1000);
  });

  it('completes a stop with 12 minutes of focus with 120 XP and the matching Coins', async () => {
    const started = await startFree();
    clock = new Date(started.startedAt.getTime() + 720_000);
    const stopped = await command('stop', started);
    expect(stopped).toMatchObject({ state: 'completed', terminalReason: 'manual-stop', xpAwarded: 120, durationValidSeconds: 720 });
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ userId })).toMatchObject({ xpTotal: 120 });
    expect(await dataSource!.getRepository(CoinBalance).findOneByOrFail({ userId })).toMatchObject({ balance: 6 });
  });

  it('cancels a stop with 3 minutes of focus without XP', async () => {
    const started = await startFree();
    clock = new Date(started.startedAt.getTime() + 180_000);
    expect(await command('stop', started)).toMatchObject({ state: 'cancelled', xpAwarded: 0 });
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ userId })).toMatchObject({ xpTotal: 0 });
  });

  it('contributes exactly once to the Raid in Guild mode', async () => {
    const guild = await dataSource!.getRepository(Guild).save({ name: 'Ordem do Foco', createdByUser: { id: userId } });
    const mission = (await dataSource!.getRepository(Mission).find({ take: 1 }))[0]!;
    const raid = await dataSource!.getRepository(Raid).save({
      guildId: guild.id, missionId: mission.id, goalXp: 100_000, startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000),
    });
    const started = await startFree({ mode: 'guild', raidId: raid.id });
    expect(started).toMatchObject({ kind: 'free', mode: 'guild', raidId: raid.id });
    clock = new Date(started.startedAt.getTime() + 720_000);
    await command('stop', started);
    expect(raids.recordContributionInTransaction).toHaveBeenCalledTimes(1);
    expect(raids.recordContributionInTransaction).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ raidId: raid.id, xpContributed: 120 }));
  });

  it('completes on its own at the continuous limit when the server reads the active session', async () => {
    const started = await startFree();
    clock = new Date(started.startedAt.getTime() + (CONTINUOUS_LIMIT_SECONDS + 30) * 1000);
    const completed = await start.active(userId);
    expect(completed).toMatchObject({
      state: 'completed', terminalReason: 'auto-complete', cappedReason: 'continuous-limit',
      durationValidSeconds: CONTINUOUS_LIMIT_SECONDS, xpAwarded: 2400,
    });
  });

  it('shifts the ceiling by a 30 minute pause on resume', async () => {
    const started = await startFree();
    clock = new Date(started.startedAt.getTime() + 600_000);
    const paused = await command('pause', started);
    clock = new Date(clock.getTime() + 1_800_000);
    const resumed = await command('resume', paused);
    expect(resumed.runDeadlineAt!.getTime()).toBe(started.runDeadlineAt!.getTime() + 1_800_000);
  });

  it('counts the pauses of a Foco livre and keeps the count on resume and stop', async () => {
    const started = await startFree();
    expect(started.pauseCount).toBe(0);
    clock = new Date(started.startedAt.getTime() + 600_000);
    const paused = await command('pause', started);
    clock = new Date(clock.getTime() + 60_000);
    const resumed = await command('resume', paused);
    clock = new Date(clock.getTime() + 60_000);
    const pausedAgain = await command('pause', resumed);
    expect([paused.pauseCount, resumed.pauseCount, pausedAgain.pauseCount]).toEqual([1, 1, 2]);
    clock = new Date(clock.getTime() + 60_000);
    const stopped = await command('stop', pausedAgain);
    expect(stopped.pauseCount).toBe(2);
  });

  it('does not advance the cadence', async () => {
    for (let index = 0; index < 3; index += 1) {
      const cycle = await start.start(userId, 'device-a', {}, key());
      clock = new Date(cycle.startedAt.getTime() + 1_500_000);
      await command('complete', cycle);
    }
    const free = await startFree();
    clock = new Date(free.startedAt.getTime() + 720_000);
    await command('stop', free);

    const sessions = new SessionsService(dataSource!.getRepository(StudySession), {} as never, {} as never);
    expect(await sessions.focusCycle(userId, clock)).toMatchObject({ completedInCycle: 3 });
    const history = await sessions.history(userId, { date: saoPauloDayKey(clock) } as never);
    expect(history.items.filter((item) => item.kind === 'free')).toHaveLength(1);
    expect(history.items.find((item) => item.kind === 'free')!.cyclePosition).toBeNull();
  });
});
