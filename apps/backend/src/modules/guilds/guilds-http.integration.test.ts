import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { User } from '../users/entities/user.entity';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { Guild } from './entities/guild.entity';
import { GuildMembership } from './entities/guild-membership.entity';
import { GuildsController } from './guilds.controller';
import { GuildsService } from './guilds.service';

describe('Guilds HTTP contract against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;

  const ana = '00000000-0000-4000-8000-000000000a01';
  const bruno = '00000000-0000-4000-8000-000000000a02';
  const carla = '00000000-0000-4000-8000-000000000a03';

  const call = (method: string, path: string, as: string | null = ana, body?: unknown) => fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_guilds_http');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert([
      { id: ana, email: 'ana@example.com', passwordHash: 'hash', displayName: 'Ana', planTier: 'free' },
      { id: bruno, email: 'bruno@example.com', passwordHash: 'hash', displayName: 'Bruno', planTier: 'free' },
      { id: carla, email: 'carla@example.com', passwordHash: 'hash', displayName: 'Carla', planTier: 'free' },
    ]);

    const moduleRef = await Test.createTestingModule({
      controllers: [GuildsController],
      providers: [
        GuildsService,
        { provide: getRepositoryToken(Guild), useValue: dataSource.getRepository(Guild) },
        { provide: getRepositoryToken(GuildMembership), useValue: dataSource.getRepository(GuildMembership) },
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
    expect((await call('GET', '/guilds/me', null)).status).toBe(401);
    expect((await call('GET', '/guilds', null)).status).toBe(401);
  });

  it('reports 404 on /guilds/me until the user joins or creates a guild', async () => {
    expect((await call('GET', '/guilds/me')).status).toBe(404);

    const created = await call('POST', '/guilds', ana, { name: 'Ordem do Foco' });
    expect(created.status).toBe(201);

    const mine = await call('GET', '/guilds/me');
    expect(mine.status).toBe(200);
    expect(await mine.json()).toMatchObject({ guild: { name: 'Ordem do Foco', level: 1, memberCount: 1 }, role: 'leader' });
  });

  it('lets a second user find the guild, join it and see the member count grow', async () => {
    const { id } = await (await call('POST', '/guilds', ana, { name: 'Ordem do Foco' })).json() as { id: string };

    const found = await (await call('GET', '/guilds?search=foco', bruno)).json() as { items: Array<{ id: string; memberCount: number }> };
    expect(found.items).toEqual([expect.objectContaining({ id, memberCount: 1 })]);

    expect((await call('POST', `/guilds/${id}/members`, bruno)).status).toBe(204);
    expect((await call('POST', `/guilds/${id}/members`, bruno)).status).toBe(204);

    const mine = await (await call('GET', '/guilds/me', bruno)).json();
    expect(mine).toMatchObject({ guild: { id, memberCount: 2 }, role: 'member' });
  });

  it('enforces one guild per user', async () => {
    const first = await (await call('POST', '/guilds', ana, { name: 'Primeira' })).json() as { id: string };
    const second = await (await call('POST', '/guilds', bruno, { name: 'Segunda' })).json() as { id: string };

    expect((await call('POST', '/guilds', ana, { name: 'Terceira' })).status).toBe(409);
    expect((await call('POST', `/guilds/${second.id}/members`, ana)).status).toBe(409);
    expect((await call('POST', `/guilds/${first.id}/members`, bruno)).status).toBe(409);
    expect(await dataSource!.getRepository(Guild).count()).toBe(2);
  });

  it('keeps the database rule even when two joins race', async () => {
    const first = await (await call('POST', '/guilds', ana, { name: 'Primeira' })).json() as { id: string };
    const second = await (await call('POST', '/guilds', bruno, { name: 'Segunda' })).json() as { id: string };

    const results = await Promise.all([
      call('POST', `/guilds/${first.id}/members`, carla),
      call('POST', `/guilds/${second.id}/members`, carla),
    ]);

    expect(results.map((response) => response.status).sort()).toEqual([204, 409]);
    expect(await dataSource!.getRepository(GuildMembership).count({ where: { userId: carla } })).toBe(1);
  });

  it('pages the discovery list by name with a stable cursor', async () => {
    const owners = [ana, bruno, carla];
    for (const [index, name] of ['Alfa', 'Beta', 'Gama'].entries()) {
      await call('POST', '/guilds', owners[index], { name });
    }

    const first = await (await call('GET', '/guilds?limit=2')).json() as { items: Array<{ name: string }>; nextCursor: string | null };
    expect(first.items.map((item) => item.name)).toEqual(['Alfa', 'Beta']);
    expect(first.nextCursor).not.toBeNull();

    const second = await (await call('GET', `/guilds?limit=2&cursor=${first.nextCursor}`)).json() as { items: Array<{ name: string }>; nextCursor: string | null };
    expect(second.items.map((item) => item.name)).toEqual(['Gama']);
    expect(second.nextCursor).toBeNull();
  });

  it('treats search wildcards literally and rejects invalid query parameters', async () => {
    await call('POST', '/guilds', ana, { name: 'Foco 100%' });
    await call('POST', '/guilds', bruno, { name: 'Foco total' });

    const literal = await (await call('GET', '/guilds?search=100%25')).json() as { items: Array<{ name: string }> };
    expect(literal.items.map((item) => item.name)).toEqual(['Foco 100%']);

    expect((await call('GET', '/guilds?limit=21')).status).toBe(400);
    expect((await call('GET', '/guilds?cursor=bad')).status).toBe(400);
  });

  it('lists the members to the guild only, with a stable and complete cursor', async () => {
    const { id } = await (await call('POST', '/guilds', ana, { name: 'Ordem do Foco' })).json() as { id: string };
    await call('POST', `/guilds/${id}/members`, bruno);
    await call('POST', `/guilds/${id}/members`, carla);

    expect((await call('GET', `/guilds/${id}/members`, null)).status).toBe(401);
    const outsider = '00000000-0000-4000-8000-000000000a09';
    await dataSource!.getRepository(User).insert({ id: outsider, email: 'fora@example.com', passwordHash: 'hash', displayName: 'Fora', planTier: 'free' });
    expect((await call('GET', `/guilds/${id}/members`, outsider)).status).toBe(403);
    expect((await call('GET', '/guilds/00000000-0000-4000-8000-0000000000ff/members', ana)).status).toBe(404);

    // joined_at has second precision and the three joins land in the same second, so ties are broken by id:
    // the order is stable and complete, but not chronological. Assert what the contract promises.
    type MemberPage = { items: Array<{ userId: string; displayName: string; role: string; level: number }>; nextCursor: string | null };
    const first = await (await call('GET', `/guilds/${id}/members?limit=2`, bruno)).json() as MemberPage;
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await (await call('GET', `/guilds/${id}/members?limit=2&cursor=${first.nextCursor}`, bruno)).json() as MemberPage;
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();

    const all = [...first.items, ...second.items];
    expect(all.map((member) => member.displayName).sort()).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(all.filter((member) => member.role === 'leader').map((member) => member.displayName)).toEqual(['Ana']);
    expect(all.every((member) => member.level === 1)).toBe(true);

    const repeat = await (await call('GET', `/guilds/${id}/members?limit=2`, bruno)).json() as MemberPage;
    expect(repeat.items.map((member) => member.userId)).toEqual(first.items.map((member) => member.userId));
    expect((await call('GET', `/guilds/${id}/members?limit=51`, ana)).status).toBe(400);
  });

  it('shows the leader in the guild detail', async () => {
    const { id } = await (await call('POST', '/guilds', ana, { name: 'Ordem do Foco' })).json() as { id: string };

    const detail = await (await call('GET', `/guilds/${id}`, bruno)).json();
    expect(detail).toMatchObject({ id, memberCount: 1, leader: { userId: ana, displayName: 'Ana' } });
  });

  it('lets a member leave and passes leadership to the oldest remaining member', async () => {
    const { id } = await (await call('POST', '/guilds', ana, { name: 'Ordem do Foco' })).json() as { id: string };
    await call('POST', `/guilds/${id}/members`, bruno);
    await call('POST', `/guilds/${id}/members`, carla);
    // joined_at has second precision, so make "oldest" explicit instead of relying on the insertion order.
    const memberships = dataSource!.getRepository(GuildMembership);
    await memberships.update({ userId: ana }, { joinedAt: new Date('2026-01-01T10:00:00Z') });
    await memberships.update({ userId: bruno }, { joinedAt: new Date('2026-01-02T10:00:00Z') });
    await memberships.update({ userId: carla }, { joinedAt: new Date('2026-01-03T10:00:00Z') });

    expect((await call('DELETE', `/guilds/${id}/members/me`, carla)).status).toBe(204);
    expect((await call('GET', '/guilds/me', carla)).status).toBe(404);

    expect((await call('DELETE', `/guilds/${id}/members/me`, ana)).status).toBe(204);
    const mine = await (await call('GET', '/guilds/me', bruno)).json();
    expect(mine).toMatchObject({ role: 'leader', guild: { id, memberCount: 1, leader: { userId: bruno } } });
  });

  it('ends the guild when its last member leaves and lets the user start over', async () => {
    const { id } = await (await call('POST', '/guilds', ana, { name: 'Ordem do Foco' })).json() as { id: string };

    expect((await call('DELETE', `/guilds/${id}/members/me`, ana)).status).toBe(204);
    expect((await call('GET', `/guilds/${id}`, ana)).status).toBe(404);
    expect(await dataSource!.getRepository(Guild).count()).toBe(0);
    expect((await call('POST', '/guilds', ana, { name: 'Ordem do Foco' })).status).toBe(201);
  });

  it('rejects leaving a guild the user is not in', async () => {
    const { id } = await (await call('POST', '/guilds', ana, { name: 'Ordem do Foco' })).json() as { id: string };

    expect((await call('DELETE', `/guilds/${id}/members/me`, bruno)).status).toBe(404);
    expect(await dataSource!.getRepository(GuildMembership).count({ where: { guildId: id } })).toBe(1);
  });
});
