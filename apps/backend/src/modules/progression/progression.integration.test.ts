import type { RowDataPacket } from 'mysql2/promise';
import { DataSource } from 'typeorm';
import {
  MAX_SUPPORTED_XP_TOTAL,
  xpThresholdForLevel,
} from './domain/progression-policy';
import { Character } from './entities/character.entity';
import { ProgressionService } from './progression.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { User } from '../users/entities/user.entity';
import {
  APPLICATION_MIGRATIONS,
  createIntegrationDatabase,
  type IntegrationDatabase,
} from '../../test/integration-database';

type Row = RowDataPacket & Record<string, unknown>;

describe('progression persistence against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    try {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
    } finally {
      await database?.close();
    }
  });

  async function setup(): Promise<void> {
    database = await createIntegrationDatabase('wise_progression_integration');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
  }

  async function seedCharacter(xpTotal = 0): Promise<{ userId: string }> {
    if (!dataSource) {
      throw new Error('Data source was not initialized');
    }

    const userId = '00000000-0000-4000-8000-000000000001';
    const characterId = '00000000-0000-4000-8000-000000000002';
    await dataSource.getRepository(User).insert({
      id: userId,
      email: 'progression@example.com',
      passwordHash: 'argon2-hash',
      displayName: 'Progression',
      planTier: 'free',
    });
    await dataSource.getRepository(Character).insert({
      id: characterId,
      userId,
      level: 1,
      xpTotal,
    });
    return { userId };
  }

  function progressionService(): ProgressionService {
    if (!dataSource) {
      throw new Error('Data source was not initialized');
    }
    const realtime = { emitToUser: jest.fn() } as unknown as RealtimeGateway;
    return new ProgressionService(dataSource.getRepository(Character), realtime);
  }

  it('hydrates BIGINT as number and preserves two sequential XP credits', async () => {
    await setup();
    const { userId } = await seedCharacter();
    const service = progressionService();

    const initiallyHydrated = await dataSource!.getRepository(Character).findOneBy({ userId });
    expect(initiallyHydrated?.xpTotal).toBe(0);
    expect(typeof initiallyHydrated?.xpTotal).toBe('number');

    await expect(service.awardXp(userId, 100)).resolves.toEqual(
      expect.objectContaining({ newXpTotal: 100, newLevel: 1 }),
    );
    await expect(service.awardXp(userId, 1_314)).resolves.toEqual(
      expect.objectContaining({
        newXpTotal: 1_414,
        newLevel: 2,
        leveledUp: true,
      }),
    );

    const rehydrated = await dataSource!.getRepository(Character).findOneBy({ userId });
    expect(rehydrated).toEqual(
      expect.objectContaining({
        xpTotal: 1_414,
        level: 2,
      }),
    );
    expect(typeof rehydrated?.xpTotal).toBe('number');

    const rawRows = (await dataSource!.query(
      `SELECT xp_total FROM ${database!.identifier}.characters WHERE user_id = ?`,
      [userId],
    )) as Row[];
    expect(String(rawRows[0]?.xp_total)).toBe('1414');
    expect(xpThresholdForLevel(2)).toBe(1_414);
  });

  it('rejects a credit that exceeds the supported total before persistence', async () => {
    await setup();
    const { userId } = await seedCharacter(MAX_SUPPORTED_XP_TOTAL);
    const service = progressionService();

    await expect(service.awardXp(userId, 1)).rejects.toThrow(
      'total de XP excede o limite suportado',
    );

    const rehydrated = await dataSource!.getRepository(Character).findOneBy({ userId });
    expect(rehydrated?.xpTotal).toBe(MAX_SUPPORTED_XP_TOTAL);
    expect(rehydrated?.level).toBe(1);
  });
});
