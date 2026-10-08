import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Guild } from './entities/guild.entity';
import { GuildMembership } from './entities/guild-membership.entity';
import { GuildsService } from './guilds.service';

const manager = {
  create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
  save: jest.fn(),
  find: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  transaction: jest.fn(),
};
const queryBuilder = {
  leftJoin: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};
const mockGuilds = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(() => queryBuilder),
  manager,
};
const mockMemberships = {
  findOne: jest.fn(),
  count: jest.fn(),
  create: jest.fn((data: object) => ({ ...data })),
  save: jest.fn(),
  createQueryBuilder: jest.fn(() => queryBuilder),
};

const duplicateEntry = Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });

describe('GuildsService', () => {
  let service: GuildsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    manager.transaction.mockImplementation((work: (m: typeof manager) => unknown) => work(manager));
    manager.save.mockImplementation((entity: object) => Promise.resolve({ id: 'guild-1', ...entity }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuildsService,
        { provide: getRepositoryToken(Guild), useValue: mockGuilds },
        { provide: getRepositoryToken(GuildMembership), useValue: mockMemberships },
      ],
    }).compile();
    service = module.get(GuildsService);
  });

  describe('create', () => {
    it('creates the guild and its leader membership in one transaction', async () => {
      mockMemberships.findOne.mockResolvedValue(null);
      mockGuilds.findOne.mockResolvedValue(null);

      const guild = await service.create('user-1', { name: 'Ordem do Foco' });

      expect(guild.id).toBe('guild-1');
      expect(manager.transaction).toHaveBeenCalledTimes(1);
      expect(manager.save).toHaveBeenCalledTimes(2);
      expect(manager.create).toHaveBeenCalledWith(GuildMembership, { guildId: 'guild-1', userId: 'user-1', role: 'leader' });
    });

    it('refuses a user who already belongs to a guild', async () => {
      mockMemberships.findOne.mockResolvedValue({ guildId: 'other', userId: 'user-1' });

      await expect(service.create('user-1', { name: 'Nova' })).rejects.toBeInstanceOf(ConflictException);
      expect(manager.transaction).not.toHaveBeenCalled();
    });

    it('refuses a duplicated guild name', async () => {
      mockMemberships.findOne.mockResolvedValue(null);
      mockGuilds.findOne.mockResolvedValue({ id: 'guild-9' });

      await expect(service.create('user-1', { name: 'Existente' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('maps a lost race on the single-guild index to a conflict', async () => {
      mockMemberships.findOne.mockResolvedValue(null);
      mockGuilds.findOne.mockResolvedValue(null);
      manager.transaction.mockRejectedValue(duplicateEntry);

      await expect(service.create('user-1', { name: 'Corrida' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('create (name race)', () => {
    it('reports the name, not the membership, when the guild-name index is what lost the race', async () => {
      mockMemberships.findOne.mockResolvedValue(null);
      mockGuilds.findOne.mockResolvedValue(null);
      manager.transaction.mockRejectedValue(
        Object.assign(new Error("Duplicate entry 'X' for key 'guilds.UQ_guilds_name'"), { code: 'ER_DUP_ENTRY' }),
      );

      await expect(service.create('user-1', { name: 'X' })).rejects.toThrow('Já existe uma guilda com esse nome');
    });
  });

  describe('findMine', () => {
    it('returns the guild and the role of the caller', async () => {
      mockMemberships.findOne
        .mockResolvedValueOnce({ guildId: 'guild-1', userId: 'user-1', role: 'leader' })
        .mockResolvedValueOnce({ guildId: 'guild-1', userId: 'user-1', role: 'leader', user: { displayName: 'Ana' } });
      mockGuilds.findOne.mockResolvedValue({ id: 'guild-1', name: 'Ordem', level: 2 });
      mockMemberships.count.mockResolvedValue(3);

      await expect(service.findMine('user-1')).resolves.toEqual({
        guild: { id: 'guild-1', name: 'Ordem', level: 2, memberCount: 3, leader: { userId: 'user-1', displayName: 'Ana' } },
        role: 'leader',
      });
    });

    it('is a 404 for a user without guild', async () => {
      mockMemberships.findOne.mockResolvedValue(null);

      await expect(service.findMine('user-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    const row = (name: string, id: string) => ({ id, name, level: '1', memberCount: '2' });

    it('returns a page with a cursor when more rows exist', async () => {
      queryBuilder.getRawMany.mockResolvedValue([row('A', 'id-a'), row('B', 'id-b'), row('C', 'id-c')]);

      const page = await service.list({ limit: 2 });

      expect(queryBuilder.limit).toHaveBeenCalledWith(3);
      expect(page.items).toEqual([
        { id: 'id-a', name: 'A', level: 1, memberCount: 2 },
        { id: 'id-b', name: 'B', level: 1, memberCount: 2 },
      ]);
      expect(page.nextCursor).not.toBeNull();

      queryBuilder.getRawMany.mockResolvedValue([row('C', 'id-c')]);
      const next = await service.list({ limit: 2, cursor: page.nextCursor! });
      expect(next.nextCursor).toBeNull();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(expect.stringContaining('guild.name >'), { afterName: 'B', afterId: 'id-b' });
    });

    it('escapes LIKE wildcards in the search term', async () => {
      queryBuilder.getRawMany.mockResolvedValue([]);

      await service.list({ search: ' 100%_foco ' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('guild.name LIKE :search', { search: '%100\\%\\_foco%' });
    });

    it('rejects a malformed cursor', async () => {
      await expect(service.list({ cursor: 'not-a-cursor' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('addMember', () => {
    it('adds a member to an existing guild', async () => {
      mockGuilds.findOne.mockResolvedValue({ id: 'guild-1' });
      mockMemberships.findOne.mockResolvedValue(null);

      await service.addMember('guild-1', 'user-2');

      expect(mockMemberships.save).toHaveBeenCalledWith({ guildId: 'guild-1', userId: 'user-2', role: 'member' });
    });

    it('is idempotent for the guild the user is already in', async () => {
      mockGuilds.findOne.mockResolvedValue({ id: 'guild-1' });
      mockMemberships.findOne.mockResolvedValue({ guildId: 'guild-1', userId: 'user-2' });

      await service.addMember('guild-1', 'user-2');

      expect(mockMemberships.save).not.toHaveBeenCalled();
    });

    it('refuses a user who belongs to another guild', async () => {
      mockGuilds.findOne.mockResolvedValue({ id: 'guild-1' });
      mockMemberships.findOne.mockResolvedValue({ guildId: 'guild-2', userId: 'user-2' });

      await expect(service.addMember('guild-1', 'user-2')).rejects.toBeInstanceOf(ConflictException);
    });

    it('is a 404 for an unknown guild', async () => {
      mockGuilds.findOne.mockResolvedValue(null);

      await expect(service.addMember('missing', 'user-2')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('treats a concurrent join to the same guild as success and to another as a conflict', async () => {
      mockGuilds.findOne.mockResolvedValue({ id: 'guild-1' });
      mockMemberships.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ guildId: 'guild-1' });
      mockMemberships.save.mockRejectedValueOnce(duplicateEntry);
      await expect(service.addMember('guild-1', 'user-2')).resolves.toBeUndefined();

      mockMemberships.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ guildId: 'guild-2' });
      mockMemberships.save.mockRejectedValueOnce(duplicateEntry);
      await expect(service.addMember('guild-1', 'user-2')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listMembers', () => {
    const row = (id: string, userId: string, role: string, joinedAt: string) => ({
      membershipId: id, userId, displayName: userId.toUpperCase(), level: '2', title: null, role,
      joinedAt: new Date(joinedAt), joinedAtText: joinedAt.replace('T', ' ').replace('Z', '.123456'),
    });

    it('is a 404 for an unknown guild and a 403 for someone outside it', async () => {
      mockGuilds.findOne.mockResolvedValueOnce(null);
      await expect(service.listMembers('missing', 'user-1', {})).rejects.toBeInstanceOf(NotFoundException);

      mockGuilds.findOne.mockResolvedValue({ id: 'guild-1' });
      mockMemberships.findOne.mockResolvedValue(null);
      await expect(service.listMembers('guild-1', 'outsider', {})).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('pages members oldest first with a cursor and defaults a missing character to level 1', async () => {
      mockGuilds.findOne.mockResolvedValue({ id: 'guild-1' });
      mockMemberships.findOne.mockResolvedValue({ guildId: 'guild-1', userId: 'user-1' });
      queryBuilder.getRawMany.mockResolvedValue([
        row('m1', 'a', 'leader', '2026-09-01T10:00:00Z'),
        { ...row('m2', 'b', 'member', '2026-09-02T10:00:00Z'), level: null },
        row('m3', 'c', 'member', '2026-09-03T10:00:00Z'),
      ]);

      const page = await service.listMembers('guild-1', 'user-1', { limit: 2 });

      expect(queryBuilder.limit).toHaveBeenCalledWith(3);
      expect(page.items.map((member) => [member.userId, member.role, member.level])).toEqual([['a', 'leader', 2], ['b', 'member', 1]]);
      expect(page.nextCursor).not.toBeNull();

      queryBuilder.getRawMany.mockResolvedValue([row('m3', 'c', 'member', '2026-09-03T10:00:00Z')]);
      const next = await service.listMembers('guild-1', 'user-1', { limit: 2, cursor: page.nextCursor! });
      expect(next.nextCursor).toBeNull();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('membership.joinedAt >'),
        { afterJoinedAt: '2026-09-02 10:00:00.123456', afterId: 'm2' },
      );
    });

    it('rejects a malformed cursor', async () => {
      mockGuilds.findOne.mockResolvedValue({ id: 'guild-1' });
      mockMemberships.findOne.mockResolvedValue({ guildId: 'guild-1', userId: 'user-1' });
      await expect(service.listMembers('guild-1', 'user-1', { cursor: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('leave', () => {
    const member = (id: string, userId: string, role: 'leader' | 'member') => ({ id, userId, role, guildId: 'guild-1' });

    it('removes a regular member and leaves the leadership alone', async () => {
      manager.find.mockResolvedValue([member('m1', 'ana', 'leader'), member('m2', 'bruno', 'member')]);

      await service.leave('guild-1', 'bruno');

      expect(manager.delete).toHaveBeenCalledWith(GuildMembership, { id: 'm2' });
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('promotes the oldest remaining member when the leader leaves', async () => {
      manager.find.mockResolvedValue([member('m1', 'ana', 'leader'), member('m2', 'bruno', 'member'), member('m3', 'carla', 'member')]);

      await service.leave('guild-1', 'ana');

      expect(manager.delete).toHaveBeenCalledWith(GuildMembership, { id: 'm1' });
      expect(manager.update).toHaveBeenCalledWith(GuildMembership, { id: 'm2' }, { role: 'leader' });
    });

    it('ends the guild when its last member leaves', async () => {
      manager.find.mockResolvedValue([member('m1', 'ana', 'leader')]);

      await service.leave('guild-1', 'ana');

      expect(manager.delete).toHaveBeenCalledWith(Guild, { id: 'guild-1' });
      expect(manager.delete).not.toHaveBeenCalledWith(GuildMembership, expect.anything());
    });

    it('is a 404 for someone who is not in the guild', async () => {
      manager.find.mockResolvedValue([member('m1', 'ana', 'leader')]);

      await expect(service.leave('guild-1', 'intruder')).rejects.toBeInstanceOf(NotFoundException);
      expect(manager.delete).not.toHaveBeenCalled();
    });
  });
});
