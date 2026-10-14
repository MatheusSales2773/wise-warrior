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
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { Mission } from './entities/mission.entity';
import { Raid } from './entities/raid.entity';
import { RaidContribution } from './entities/raid-contribution.entity';
import { RaidParticipation } from './entities/raid-participation.entity';
import { GuildRaidsController } from './guild-raids.controller';
import { RAID_CLOCK } from './raid-clock';
import { RaidsController } from './raids.controller';
import { RaidsService } from './raids.service';

type RankingBody = {
  items: Array<{ position: number; userId: string; displayName: string; level: number; title: string | null; contributionXp: number }>;
  nextCursor: string | null;
};

const APRENDIZ_TITLE = 'c05e71c0-0000-4000-8000-000000000002';

describe('Ranking interno against MySQL', () => {
  jest.setTimeout(60_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let now: Date;
  let guildId: string;
  let raidId: string;

  const ana = '00000000-0000-4000-8000-000000000e01';
  const bruno = '00000000-0000-4000-8000-000000000e02';
  const carla = '00000000-0000-4000-8000-000000000e03';
  const diego = '00000000-0000-4000-8000-000000000e04';
  const outsider = '00000000-0000-4000-8000-000000000e05';

  const call = (method: string, path: string, as: string | null = ana, body?: unknown) => fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = async <T>(method: string, path: string, as: string = ana) => {
    const response = await call(method, path, as);
    expect(response.status).toBe(200);
    return await response.json() as T;
  };

  let sessionCounter = 0;
  /** A Contribuição pelo caminho real da conclusão: incremento atômico e Meta batida na transação. */
  const contribute = async (userId: string, xp: number) => {
    sessionCounter += 1;
    const studySessionId = `00000000-0000-4000-8000-${String(sessionCounter).padStart(12, '0')}`;
    await dataSource!.query(
      "INSERT INTO study_sessions (id, user_id, subject, mode, raid_id, started_at) VALUES (?, ?, NULL, 'guild', ?, NOW())",
      [studySessionId, userId, raidId],
    );
    const raids = app!.get(RaidsService);
    const progress = await dataSource!.transaction((manager) => raids.recordContributionInTransaction(manager, {
      raidId, userId, studySessionId, xpContributed: xp, endedAt: now,
    }));
    expect(progress).not.toBeNull();
  };
  const join = async (userId: string) => {
    expect((await call('POST', `/raids/${raidId}/join`, userId)).status).toBe(204);
  };

  beforeEach(async () => {
    now = new Date('2026-10-07T15:00:00Z');
    database = await createIntegrationDatabase('wise_raid_ranking');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    const everyone = [ana, bruno, carla, diego, outsider];
    const names = ['Ana', 'Bruno', 'Carla', 'Diego', 'Fora'];
    await dataSource.getRepository(User).insert(everyone.map((id, index) => ({
      id, email: `lifecycle${index}@example.com`, passwordHash: 'hash', displayName: names[index]!, planTier: 'free' as const,
    })));
    await dataSource.getRepository(Character).insert(everyone.map((userId, index) => ({
      userId, level: index === 0 ? 3 : 1, xpTotal: index === 0 ? 1200 : 0,
    })));
    await dataSource.getRepository(UserCosmeticItem).insert({ userId: ana, cosmeticItemId: APRENDIZ_TITLE, equipped: true });

    const repo = (entity: Parameters<DataSource['getRepository']>[0]) => ({
      provide: getRepositoryToken(entity as never),
      useValue: dataSource!.getRepository(entity),
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [GuildsController, GuildRaidsController, RaidsController],
      providers: [
        GuildsService,
        RaidsService,
        UsersService,
        ProgressionService,
        repo(Guild), repo(GuildMembership), repo(Raid), repo(RaidContribution), repo(RaidParticipation), repo(Mission),
        repo(User), repo(CosmeticItem), repo(UserCosmeticItem), repo(Character),
        { provide: RAID_CLOCK, useValue: () => now },
        { provide: RealtimeGateway, useValue: { emitToGuild: jest.fn(), emitToUser: jest.fn(), setGuildRoomResolver: jest.fn(), joinGuildRoom: jest.fn(), leaveGuildRoom: jest.fn() } },
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

    guildId = (await (await call('POST', '/guilds', ana, { name: 'Ordem do Foco' })).json() as { id: string }).id;
    for (const member of [bruno, carla, diego]) {
      expect((await call('POST', `/guilds/${guildId}/members`, member)).status).toBe(204);
    }
    raidId = (await json<{ id: string }>('GET', `/guilds/${guildId}/raids/active`)).id;
  });

  afterEach(async () => {
    await app?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  describe('Ranking interno', () => {
    it('orders by Contribution, then by who reached the total first, with Participants without Contribution last', async () => {
      for (const member of [ana, bruno, carla, diego]) await join(member);
      await contribute(diego, 150);
      await contribute(bruno, 300); // bruno reaches 300 first
      await contribute(ana, 150);
      await contribute(ana, 150); // ana ties at 300, later

      const ranking = await json<RankingBody>('GET', `/raids/${raidId}/ranking`);
      expect(ranking).toEqual({
        items: [
          { position: 1, userId: bruno, displayName: 'Bruno', level: 1, title: null, contributionXp: 300 },
          { position: 2, userId: ana, displayName: 'Ana', level: 3, title: 'Aprendiz', contributionXp: 300 },
          { position: 3, userId: diego, displayName: 'Diego', level: 1, title: null, contributionXp: 150 },
          { position: 4, userId: carla, displayName: 'Carla', level: 1, title: null, contributionXp: 0 },
        ],
        nextCursor: null,
      });
    });

    it('paginates by cursor without repeating or skipping rows', async () => {
      for (const member of [ana, bruno, carla, diego]) await join(member);
      await contribute(carla, 100);
      await contribute(ana, 200);

      const seen: RankingBody['items'] = [];
      let cursor: string | null = null;
      do {
        const query: string = cursor ? `?limit=1&cursor=${encodeURIComponent(cursor)}` : '?limit=1';
        const page: RankingBody = await json<RankingBody>('GET', `/raids/${raidId}/ranking${query}`);
        expect(page.items).toHaveLength(1);
        seen.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);

      expect(seen.map((row) => [row.position, row.userId])).toEqual([
        [1, ana], [2, carla], [3, bruno], [4, diego], // no Contribution: ordered by userId
      ]);
      expect((await call('GET', `/raids/${raidId}/ranking?cursor=nao-e-um-cursor`)).status).toBe(400);
      expect((await call('GET', `/raids/${raidId}/ranking?limit=0`)).status).toBe(400);
    });

    it('drops an ex-member from the ranking while the collective progress keeps the Contribution', async () => {
      for (const member of [ana, diego]) await join(member);
      await contribute(diego, 400);
      await contribute(ana, 100);
      expect((await call('DELETE', `/guilds/${guildId}/members/me`, diego)).status).toBe(204);

      const ranking = await json<RankingBody>('GET', `/raids/${raidId}/ranking`);
      expect(ranking.items.map((row) => [row.position, row.userId])).toEqual([[1, ana]]);
      expect((await json<{ progressXp: number }>('GET', `/guilds/${guildId}/raids/active`)).progressXp).toBe(500);
    });

    it('reports me.position on the active Raid, and null before the member participates', async () => {
      for (const member of [ana, bruno]) await join(member);
      await contribute(bruno, 100);
      type Me = { me: { participating: boolean; contributionXp: number; position: number | null } };
      expect((await json<Me>('GET', `/guilds/${guildId}/raids/active`, ana)).me).toEqual({ participating: true, contributionXp: 0, position: 2 });
      expect((await json<Me>('GET', `/guilds/${guildId}/raids/active`, bruno)).me).toEqual({ participating: true, contributionXp: 100, position: 1 });
      expect((await json<Me>('GET', `/guilds/${guildId}/raids/active`, carla)).me).toEqual({ participating: false, contributionXp: 0, position: null });
    });

    it('answers 403 to outsiders and 401 without a session', async () => {
      expect((await call('GET', `/raids/${raidId}/ranking`, outsider)).status).toBe(403);
      expect((await call('GET', `/raids/${raidId}/ranking`, null)).status).toBe(401);
    });
  });
});
