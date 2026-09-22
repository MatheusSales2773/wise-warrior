import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { StudySession } from './entities/study-session.entity';
import { StudySessionStartService } from './study-session-start.service';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';

describe('canonical Study Session start against MySQL', () => {
  jest.setTimeout(30_000);
  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  const userId = '00000000-0000-4000-8000-000000000070';
  const createService = () => new StudySessionStartService(
    dataSource!, new UsersService({} as never, {} as never, {} as never, {} as never),
  );

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_study_start');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert({ id: userId, email: 'focus@example.com', passwordHash: 'hash', displayName: 'Focus', planTier: 'free' });
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  it('returns absence, defaults to 25 minutes and restores only for the initiating Session', async () => {
    const service = createService();
    expect(await service.active(userId, 'device-a')).toBeNull();
    for (const invalidBody of [
      { plannedDurationSeconds: null }, 42, 'x', true, [], null,
    ]) {
      await expect(service.start(userId, 'device-a', invalidBody as never, 'invalid-request')).rejects.toThrow();
    }

    const started = await service.start(userId, 'device-a', {}, 'request-a');
    expect(started).toMatchObject({ mode: 'solo', subject: null, state: 'running', plannedDurationSeconds: 1500, remainingSeconds: 1500, version: 1, canControl: true });
    expect(started.runDeadlineAt!.getTime() - started.startedAt.getTime()).toBe(1_500_000);
    expect(await service.active(userId, 'device-a')).toMatchObject({ id: started.id, canControl: true });
    expect(await service.active(userId, 'device-b')).toMatchObject({ id: started.id, canControl: false });
    const persisted = await dataSource!.getRepository(StudySession).findOneByOrFail({ id: started.id });
    expect(persisted).toMatchObject({ subject: null, raidId: null, mode: 'solo', initiatingSessionId: 'device-a' });
  });

  it('serializes concurrent starts and preserves the first receipt', async () => {
    const service = createService();
    const results = await Promise.allSettled([
      service.start(userId, 'device-a', { plannedDurationSeconds: 900 }, 'request-a'),
      service.start(userId, 'device-b', { plannedDurationSeconds: 3000 }, 'request-b'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await dataSource!.getRepository(StudySession).count({ where: { userId, state: 'running' } })).toBe(1);
    const winner = results.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof service.start>>> => result.status === 'fulfilled')!.value;
    const repeated = await service.start(userId, winner.canControl ? 'device-a' : 'device-b', { plannedDurationSeconds: winner.plannedDurationSeconds as 900 | 3000 }, winner.plannedDurationSeconds === 900 ? 'request-a' : 'request-b');
    expect(repeated.id).toBe(winner.id);
    expect(repeated.serverNow).toEqual(winner.serverNow);
    await expect(service.start(userId, 'device-a', { plannedDurationSeconds: winner.plannedDurationSeconds === 900 ? 3000 : 900 }, winner.plannedDurationSeconds === 900 ? 'request-a' : 'request-b')).rejects.toThrow(ConflictException);
  });
});
