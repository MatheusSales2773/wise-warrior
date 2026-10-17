import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import type { Server } from 'socket.io';
import { DataSource } from 'typeorm';
import {
  APPLICATION_MIGRATIONS,
  createIntegrationDatabase,
  type IntegrationDatabase,
} from '../../test/integration-database';
import { Guild } from '../guilds/entities/guild.entity';
import { GuildChatMessage } from '../guilds/entities/guild-chat-message.entity';
import { GuildMembership } from '../guilds/entities/guild-membership.entity';
import { GuildsService } from '../guilds/guilds.service';
import { User } from '../users/entities/user.entity';
import { Mission } from '../raids/entities/mission.entity';
import { Raid } from '../raids/entities/raid.entity';
import { RaidContribution } from '../raids/entities/raid-contribution.entity';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { CHAT_RETAINED_MESSAGES } from './chat-policy';
import { PresenceRegistry } from './presence.registry';

interface Ack {
  ok: boolean;
  // Acks are asserted structurally per test.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const USERS = ['u-ana', 'u-bruno', 'u-carla'].map((name, index) => ({
  id: `00000000-0000-4000-8000-00000000010${index}`,
  name,
}));
const [ANA, BRUNO, CARLA] = USERS as [(typeof USERS)[number], (typeof USERS)[number], (typeof USERS)[number]];
const GUILD_A = '00000000-0000-4000-8000-0000000000a1';
const GUILD_B = '00000000-0000-4000-8000-0000000000b1';

describe('guild chat and presence against MySQL and Socket.IO', () => {
  jest.setTimeout(60_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let port = 0;
  const clients: ClientSocket[] = [];

  afterEach(async () => {
    clients.splice(0).forEach((client) => client.disconnect());
    await app?.close();
    app = undefined;
    try {
      if (dataSource?.isInitialized) await dataSource.destroy();
    } finally {
      await database?.close();
    }
  });

  async function setup(): Promise<{ gateway: ChatGateway; service: ChatService }> {
    database = await createIntegrationDatabase('wise_chat_integration');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    for (const user of USERS) {
      await dataSource.getRepository(User).insert({
        id: user.id,
        email: `${user.name}@example.com`,
        passwordHash: 'hash',
        displayName: user.name,
        planTier: 'free',
      });
    }
    for (const [guildId, name] of [[GUILD_A, 'Alpha'], [GUILD_B, 'Beta']] as const) {
      await dataSource.getRepository(Guild).insert({ id: guildId, name, level: 1, createdBy: ANA.id });
    }
    // Ana and Bruno are in Alpha; Carla is alone in Beta.
    for (const [guildId, userId] of [[GUILD_A, ANA.id], [GUILD_A, BRUNO.id], [GUILD_B, CARLA.id]] as const) {
      await dataSource.getRepository(GuildMembership).insert({ guildId, userId, role: 'member' });
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
        TypeOrmModule.forRoot({ ...database.options(APPLICATION_MIGRATIONS), autoLoadEntities: true }),
        TypeOrmModule.forFeature([Guild, GuildMembership, GuildChatMessage]),
      ],
      providers: [
        ChatGateway,
        ChatService,
        PresenceRegistry,
        // GuildsService also pulls in Raid collaborators; chat only needs the membership lookups.
        {
          provide: GuildsService,
          useFactory: () => {
            const memberships = dataSource!.getRepository(GuildMembership);
            return {
              isMember: async (guildId: string, userId: string) => (await memberships.countBy({ guildId, userId })) > 0,
              guildIdsOf: async (userId: string) => (await memberships.findBy({ userId })).map((row) => row.guildId),
            };
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;

    const gateway = app.get(ChatGateway);
    // Stands in for RealtimeGateway's JWT middleware (covered in realtime.gateway.spec.ts).
    (gateway.server as Server).use((socket, next) => {
      socket.data.userId = socket.handshake.auth.userId;
      next();
    });
    return { gateway, service: app.get(ChatService) };
  }

  async function open(userId: string): Promise<ClientSocket> {
    const client = connect(`http://localhost:${port}`, { auth: { userId }, forceNew: true, reconnection: false });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    return client;
  }

  const call = (client: ClientSocket, event: string, payload: unknown): Promise<Ack> =>
    client.timeout(5_000).emitWithAck(event, payload);

  const nextEvent = <T>(client: ClientSocket, event: string): Promise<T> =>
    new Promise((resolve) => client.once(event, resolve));

  // Auto-join runs asynchronously after the handshake; the join command is the synchronous barrier.
  async function connectJoined(userId: string, guildId: string): Promise<ClientSocket> {
    const client = await open(userId);
    expect((await call(client, 'chat:join', { guildId })).ok).toBe(true);
    return client;
  }

  it('fans a persisted message out to every connected member of the guild, in order', async () => {
    await setup();
    const ana = await connectJoined(ANA.id, GUILD_A);
    const bruno = await connectJoined(BRUNO.id, GUILD_A);
    const received: string[] = [];
    bruno.on('chat:message', (message) => received.push(message.body));

    const first = await call(ana, 'chat:send', { guildId: GUILD_A, body: '  primeira ' });
    const second = await call(ana, 'chat:send', { guildId: GUILD_A, body: 'segunda' });
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(first).toMatchObject({ ok: true, message: { body: 'primeira', displayName: 'u-ana', userId: ANA.id } });
    expect(second.message.seq).toBeGreaterThan(first.message.seq);
    expect(received).toEqual(['primeira', 'segunda']);
    expect(await dataSource!.getRepository(GuildChatMessage).count({ where: { guildId: GUILD_A } })).toBe(2);
  });

  it('never delivers or accepts messages across guilds', async () => {
    await setup();
    const ana = await connectJoined(ANA.id, GUILD_A);
    const carla = await connectJoined(CARLA.id, GUILD_B);
    const leaked: unknown[] = [];
    carla.on('chat:message', (message) => leaked.push(message));

    expect((await call(carla, 'chat:join', { guildId: GUILD_A }))).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await call(carla, 'chat:send', { guildId: GUILD_A, body: 'intruso' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await call(carla, 'chat:history', { guildId: GUILD_A })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await call(carla, 'chat:sync', { guildId: GUILD_A, afterSeq: 0 })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    await call(ana, 'chat:send', { guildId: GUILD_A, body: 'só para Alpha' });
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(leaked).toEqual([]);
    expect(await dataSource!.getRepository(GuildChatMessage).count()).toBe(1);
  });

  it('joins the member to the guild room automatically on connection', async () => {
    await setup();
    const ana = await open(ANA.id);
    const bruno = await connectJoined(BRUNO.id, GUILD_A);
    const incoming = nextEvent<{ body: string }>(ana, 'chat:message');
    await call(bruno, 'chat:send', { guildId: GUILD_A, body: 'oi Ana' });
    expect((await incoming).body).toBe('oi Ana');
  });

  it('paginates history newest-first pages in chronological order without gaps', async () => {
    const { service } = await setup();
    for (let index = 1; index <= 7; index += 1) {
      await dataSource!.getRepository(GuildChatMessage).insert({ guildId: GUILD_A, userId: ANA.id, body: `m${index}` });
    }
    const bruno = await connectJoined(BRUNO.id, GUILD_A);

    const latest = await call(bruno, 'chat:history', { guildId: GUILD_A, limit: 3 });
    expect(latest.messages.map((m: { body: string }) => m.body)).toEqual(['m5', 'm6', 'm7']);
    const middle = await call(bruno, 'chat:history', { guildId: GUILD_A, limit: 3, before: latest.nextBefore });
    expect(middle.messages.map((m: { body: string }) => m.body)).toEqual(['m2', 'm3', 'm4']);
    const oldest = await call(bruno, 'chat:history', { guildId: GUILD_A, limit: 3, before: middle.nextBefore });
    expect(oldest.messages.map((m: { body: string }) => m.body)).toEqual(['m1']);
    expect(oldest.nextBefore).toBeNull();
    expect((await service.history(GUILD_A, ANA.id, undefined, 1000)).messages).toHaveLength(7);
  });

  it('recovers messages missed while disconnected exactly once on reconnection', async () => {
    await setup();
    const ana = await connectJoined(ANA.id, GUILD_A);
    let bruno = await connectJoined(BRUNO.id, GUILD_A);
    const seen = new Map<number, string>();
    bruno.on('chat:message', (m) => seen.set(m.seq, m.body));
    await call(ana, 'chat:send', { guildId: GUILD_A, body: 'antes' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const lastSeq = Math.max(...seen.keys());

    bruno.disconnect();
    await call(ana, 'chat:send', { guildId: GUILD_A, body: 'perdida 1' });
    await call(ana, 'chat:send', { guildId: GUILD_A, body: 'perdida 2' });

    bruno = await open(BRUNO.id);
    bruno.on('chat:message', (m) => seen.set(m.seq, m.body));
    const synced = await call(bruno, 'chat:sync', { guildId: GUILD_A, afterSeq: lastSeq });
    await call(ana, 'chat:send', { guildId: GUILD_A, body: 'depois' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    synced.messages.forEach((m: { seq: number; body: string }) => seen.set(m.seq, m.body));

    expect(synced.messages.map((m: { body: string }) => m.body)).toEqual(['perdida 1', 'perdida 2']);
    expect([...seen.entries()].sort(([a], [b]) => a - b).map(([, body]) => body)).toEqual(['antes', 'perdida 1', 'perdida 2', 'depois']);
  });

  it('broadcasts presence when the first device connects and the last one leaves', async () => {
    await setup();
    const ana = await connectJoined(ANA.id, GUILD_A);
    const events: Array<{ userId: string; online: boolean }> = [];
    ana.on('member:online', (event) => events.push(event));

    const bruno1 = await open(BRUNO.id);
    const bruno2 = await open(BRUNO.id);
    await call(bruno1, 'chat:join', { guildId: GUILD_A });
    const joined = await call(bruno2, 'chat:join', { guildId: GUILD_A });
    expect(joined.onlineUserIds.sort()).toEqual([ANA.id, BRUNO.id].sort());

    bruno1.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(events).toEqual([{ guildId: GUILD_A, userId: BRUNO.id, online: true }]);
    bruno2.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(events.at(-1)).toEqual({ guildId: GUILD_A, userId: BRUNO.id, online: false });
  });

  it('delivers concurrent messages in seq order', async () => {
    await setup();
    const ana = await connectJoined(ANA.id, GUILD_A);
    const bruno = await connectJoined(BRUNO.id, GUILD_A);
    const seqs: number[] = [];
    bruno.on('chat:message', (message) => seqs.push(message.seq));

    await Promise.all([1, 2, 3, 4].map((n) => call(ana, 'chat:send', { guildId: GUILD_A, body: `c${n}` })));
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(seqs).toHaveLength(4);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  });

  it('rejects invalid content and rate-limits floods without persisting them', async () => {
    await setup();
    const ana = await connectJoined(ANA.id, GUILD_A);

    expect(await call(ana, 'chat:send', { guildId: GUILD_A, body: '   ' })).toMatchObject({ ok: false, error: { code: 'EMPTY' } });
    expect(await call(ana, 'chat:send', { guildId: GUILD_A, body: 'x'.repeat(501) })).toMatchObject({ ok: false, error: { code: 'TOO_LONG' } });
    expect(await call(ana, 'chat:send', { guildId: GUILD_A, body: 'k'.repeat(40) })).toMatchObject({ ok: false, error: { code: 'ABUSIVE' } });
    expect(await call(ana, 'chat:send', { body: 'sem guilda' })).toMatchObject({ ok: false, error: { code: 'BAD_REQUEST' } });
    // The three content rejections above already used 3 of the 5 slots in the window.
    for (let index = 0; index < 2; index += 1) {
      expect((await call(ana, 'chat:send', { guildId: GUILD_A, body: `ok ${index}` })).ok).toBe(true);
    }
    const limited = await call(ana, 'chat:send', { guildId: GUILD_A, body: 'demais' });
    expect(limited).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
    expect(limited.error.retryAfterMs).toBeGreaterThan(0);
    expect(await dataSource!.getRepository(GuildChatMessage).count()).toBe(2);
  });

  it('keeps only the latest messages per guild', async () => {
    const { service } = await setup();
    const repository = dataSource!.getRepository(GuildChatMessage);
    for (let index = 1; index <= CHAT_RETAINED_MESSAGES; index += 1) {
      await repository.insert({ guildId: GUILD_A, userId: ANA.id, body: `m${index}` });
    }
    await repository.insert({ guildId: GUILD_B, userId: CARLA.id, body: 'outra guilda' });

    await service.send(GUILD_A, ANA.id, 'nova');

    const kept = await repository.find({ where: { guildId: GUILD_A }, order: { seq: 'ASC' } });
    expect(kept).toHaveLength(CHAT_RETAINED_MESSAGES);
    expect(kept[0]?.body).toBe('m2');
    expect(kept.at(-1)?.body).toBe('nova');
    expect(await repository.count({ where: { guildId: GUILD_B } })).toBe(1);
  });
  describe('Avisos do Mural (raid_hit)', () => {
    async function contribution(userId: string, xp: number): Promise<string> {
      const raids = dataSource!.getRepository(Raid);
      let raid = await raids.findOneBy({ guildId: GUILD_A });
      if (!raid) {
        const mission = await dataSource!.getRepository(Mission).findOneOrFail({ where: {} });
        raid = await raids.save(raids.create({
          guildId: GUILD_A, missionId: mission.id, goalXp: 1000,
          startsAt: new Date('2026-10-05T03:00:00Z'), endsAt: new Date('2026-10-12T02:59:59Z'),
        }));
      }
      const saved = await dataSource!.getRepository(RaidContribution).save({ raidId: raid.id, userId, xpContributed: xp });
      return saved.id;
    }
    const announce = (service: ChatService, contributionId: string, userId: string, xp: number) =>
      dataSource!.transaction((manager) => service.recordRaidHit(manager, { guildId: GUILD_A, userId, contributionId, xp }));

    it('stores a structured Aviso with a sequence, in the history and in the reconnection sync', async () => {
      const { service } = await setup();
      const first = await service.send(GUILD_A, ANA.id, 'oi');
      const notice = await announce(service, await contribution(BRUNO.id, 75), BRUNO.id, 75);

      expect(notice).toMatchObject({ kind: 'raid_hit', guildId: GUILD_A, userId: BRUNO.id, displayName: 'u-bruno', xp: 75, body: '' });
      expect(notice!.seq).toBeGreaterThan(first.seq);
      expect((await service.history(GUILD_A, ANA.id)).messages.map((m) => m.kind)).toEqual(['message', 'raid_hit']);
      expect((await service.messagesAfter(GUILD_A, ANA.id, first.seq)).messages).toEqual([notice]);
    });

    it('shows the author\'s current name, not the one at the time of the Golpe', async () => {
      const { service } = await setup();
      await announce(service, await contribution(BRUNO.id, 75), BRUNO.id, 75);
      await dataSource!.getRepository(User).update({ id: BRUNO.id }, { displayName: 'Bruno Novo' });

      expect((await service.history(GUILD_A, ANA.id)).messages[0]).toMatchObject({ kind: 'raid_hit', displayName: 'Bruno Novo' });
    });

    it('does not announce the same Contribution twice', async () => {
      const { service } = await setup();
      const id = await contribution(BRUNO.id, 75);
      expect(await announce(service, id, BRUNO.id, 75)).not.toBeNull();
      expect(await announce(service, id, BRUNO.id, 75)).toBeNull();
      expect(await dataSource!.getRepository(GuildChatMessage).countBy({ kind: 'raid_hit' })).toBe(1);
    });

    it('removes the Aviso with its Contribution', async () => {
      const { service } = await setup();
      const id = await contribution(BRUNO.id, 75);
      await announce(service, id, BRUNO.id, 75);
      await dataSource!.getRepository(RaidContribution).delete({ id });
      expect(await dataSource!.getRepository(GuildChatMessage).countBy({ kind: 'raid_hit' })).toBe(0);
    });

    it('gives a member message sent during the Golpe transaction a higher seq than the Aviso', async () => {
      const { service } = await setup();
      const id = await contribution(BRUNO.id, 75);
      const runner = dataSource!.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      const notice = await service.recordRaidHit(runner.manager, { guildId: GUILD_A, userId: BRUNO.id, contributionId: id, xp: 75 });
      let sent = false;
      const message = service.send(GUILD_A, ANA.id, 'durante o golpe').then((view) => { sent = true; return view; });
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(sent).toBe(false); // waits for the Aviso to commit
      await runner.commitTransaction();
      await runner.release();

      expect((await message).seq).toBeGreaterThan(notice!.seq);
    });

    it('leaves no Aviso behind when the Contribution transaction rolls back', async () => {
      const { service } = await setup();
      const id = await contribution(BRUNO.id, 75);
      await expect(dataSource!.transaction(async (manager) => {
        await service.recordRaidHit(manager, { guildId: GUILD_A, userId: BRUNO.id, contributionId: id, xp: 75 });
        throw new Error('rollback');
      })).rejects.toThrow('rollback');
      expect(await dataSource!.getRepository(GuildChatMessage).countBy({ kind: 'raid_hit' })).toBe(0);
      expect(await announce(service, id, BRUNO.id, 75)).not.toBeNull();
    });

    it('removes the Avisos of an account that is deleted', async () => {
      const { service } = await setup();
      await announce(service, await contribution(BRUNO.id, 75), BRUNO.id, 75);
      await dataSource!.getRepository(User).delete({ id: BRUNO.id });
      expect(await dataSource!.getRepository(GuildChatMessage).countBy({ kind: 'raid_hit' })).toBe(0);
    });

    it('prunes Avisos together with messages, keeping only the latest', async () => {
      const { service } = await setup();
      for (let index = 0; index < CHAT_RETAINED_MESSAGES + 2; index += 1) {
        await announce(service, await contribution(BRUNO.id, 1), BRUNO.id, 1);
      }
      await service.trim(GUILD_A);
      expect(await dataSource!.getRepository(GuildChatMessage).countBy({ guildId: GUILD_A })).toBe(CHAT_RETAINED_MESSAGES);
    });

    it('ignores a forged kind or xp sent through chat:send', async () => {
      await setup();
      const ana = await connectJoined(ANA.id, GUILD_A);
      const ack = await call(ana, 'chat:send', { guildId: GUILD_A, body: 'oi', kind: 'raid_hit', xp: 9999, contributionId: 'x' });
      expect(ack.message).toMatchObject({ kind: 'message', xp: null, body: 'oi' });
      expect(await dataSource!.getRepository(GuildChatMessage).countBy({ kind: 'raid_hit' })).toBe(0);
    });

    it('never lets a member send an Aviso through chat:send', async () => {
      const { service } = await setup();
      const sent = await service.send(GUILD_A, ANA.id, 'falso aviso');
      expect(sent.kind).toBe('message');
      expect(sent.xp).toBeNull();
    });
  });
});
