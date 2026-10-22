import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ChatService } from '../chat/chat.service';
import { Guild } from '../guilds/entities/guild.entity';
import { GuildChatMessage } from '../guilds/entities/guild-chat-message.entity';
import type { GuildsService } from '../guilds/guilds.service';
import type { ProgressionService } from '../progression/progression.service';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { CosmeticItem } from './entities/cosmetic-item.entity';
import { User } from './entities/user.entity';
import { UserCosmeticItem } from './entities/user-cosmetic-item.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('PATCH /users/me against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;

  const ana = '00000000-0000-4000-8000-000000000c01';
  const bruno = '00000000-0000-4000-8000-000000000c02';
  const guildId = '00000000-0000-4000-8000-0000000000c1';

  const patch = (body: unknown, as: string | null = ana) => fetch(`${baseUrl}/api/v1/users/me`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as }),
    },
    body: JSON.stringify(body),
  });

  const getProfile = (as: string) => fetch(`${baseUrl}/api/v1/users/me`, {
    headers: { authorization: 'Bearer integration-token', 'x-test-user-id': as },
  });

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_rename_http');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    for (const [id, name] of [[ana, 'Ana'], [bruno, 'Bruno']] as const) {
      await dataSource.getRepository(User).insert({ id, email: `${name}@example.com`, passwordHash: 'hash', displayName: name, planTier: 'free' });
    }

    const users = new UsersService(
      dataSource.getRepository(User),
      dataSource.getRepository(UserCosmeticItem),
      dataSource.getRepository(CosmeticItem),
      { getCharacterSnapshot: async () => null, getProjection: () => ({ level: 1, levelStartXp: 0, nextLevelXp: 100 }) } as unknown as ProgressionService,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: JwtPayload }>();
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
    expect((await patch({ displayName: 'Novo Nome' }, null)).status).toBe(401);
  });

  it.each([[''], ['A'], ['   '], [' a '], ['x'.repeat(61)]])('rejects the name %j with 400', async (displayName) => {
    expect((await patch({ displayName })).status).toBe(400);
    expect(await dataSource!.getRepository(User).findOneByOrFail({ id: ana })).toEqual(expect.objectContaining({ displayName: 'Ana' }));
  });

  it('rejects a missing or non-string name with 400', async () => {
    expect((await patch({})).status).toBe(400);
    expect((await patch({ displayName: 42 })).status).toBe(400);
  });

  it('renames and returns the profile in the shape of GET /users/me', async () => {
    const response = await patch({ displayName: 'Ana, a Bruxa' });

    expect(response.status).toBe(200);
    const profile = await response.json() as { id: string; email: string; displayName: string };
    expect(profile).toEqual(await (await getProfile(ana)).json());
    expect(profile).toEqual(expect.objectContaining({ id: ana, email: 'Ana@example.com', displayName: 'Ana, a Bruxa' }));
  });

  it('saves the name without the spaces around it', async () => {
    const response = await patch({ displayName: '  Ana, a Bruxa  ' });

    expect(response.status).toBe(200);
    expect((await response.json() as { displayName: string }).displayName).toBe('Ana, a Bruxa');
  });

  it('accepts a name another user already has', async () => {
    expect((await patch({ displayName: 'Bruno' })).status).toBe(200);
    expect((await (await getProfile(ana)).json() as { displayName: string }).displayName).toBe('Bruno');
  });

  it('accepts saving the current name again', async () => {
    expect((await patch({ displayName: 'Ana' })).status).toBe(200);
  });

  it('shows the new name on the Mural, old messages included', async () => {
    await dataSource!.getRepository(Guild).insert({ id: guildId, name: 'Alpha', level: 1, createdBy: ana });
    await dataSource!.getRepository(GuildChatMessage).insert({ guildId, userId: ana, kind: 'message', body: 'oi, guilda' });
    const chat = new ChatService(
      dataSource!.getRepository(GuildChatMessage),
      { isMember: async () => true } as unknown as GuildsService,
      { get: () => undefined } as never,
    );

    await patch({ displayName: 'Ana, a Bruxa' });

    const { messages } = await chat.history(guildId, bruno) as unknown as { messages: Array<{ displayName: string; body: string }> };
    expect(messages).toEqual([expect.objectContaining({ body: 'oi, guilda', displayName: 'Ana, a Bruxa' })]);
  });
});
