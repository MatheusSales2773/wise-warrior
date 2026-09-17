import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SessionsService } from './sessions.service';
import { StudySession } from './entities/study-session.entity';
import { ProgressionService } from '../progression/progression.service';
import { RaidsService } from '../raids/raids.service';
import { MAX_CONTINUOUS_SESSION_SECONDS } from './domain/session-validator';

function queryBuilderReturning(total: number) {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ total: String(total) }),
  };
}

const mockRepo = {
  save: jest.fn(),
  create: jest.fn((data) => data),
  findOne: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockProgression = { awardXp: jest.fn() };
const mockRaids = { recordContribution: jest.fn() };

describe('SessionsService', () => {
  let service: SessionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.createQueryBuilder.mockReturnValue(queryBuilderReturning(0));
    mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getRepositoryToken(StudySession), useValue: mockRepo },
        { provide: ProgressionService, useValue: mockProgression },
        { provide: RaidsService, useValue: mockRaids },
      ],
    }).compile();
    service = module.get(SessionsService);
  });

  describe('start', () => {
    it('rejects guild mode without raidId', async () => {
      await expect(
        service.start('user-1', { subject: 'Cálculo', mode: 'guild' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a solo session with server timestamps', async () => {
      const session = await service.start('user-1', {
        subject: 'Cálculo',
        mode: 'solo',
      });
      expect(session.userId).toBe('user-1');
      expect(session.raidId).toBeNull();
      expect(session.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('complete', () => {
    it('throws NotFoundException when the session does not belong to the user', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.complete('user-1', 'session-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('awards XP for a valid solo session', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        mode: 'solo',
        raidId: null,
        startedAt: new Date(Date.now() - 25 * 60 * 1000),
        endedAt: null,
      });

      const result = await service.complete('user-1', 'session-1');

      expect(result.discardedReason).toBeNull();
      expect(result.xpAwarded).toBeGreaterThan(0);
      expect(mockProgression.awardXp).toHaveBeenCalledWith(
        'user-1',
        result.xpAwarded,
      );
      expect(mockRaids.recordContribution).not.toHaveBeenCalled();
    });

    it('discards a session exceeding the antifraud limit and skips XP entirely', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'session-2',
        userId: 'user-1',
        mode: 'solo',
        raidId: null,
        startedAt: new Date(Date.now() - (MAX_CONTINUOUS_SESSION_SECONDS + 60) * 1000),
        endedAt: null,
      });

      const result = await service.complete('user-1', 'session-2');

      expect(result.discardedReason).toBe('continuous-session-exceeds-limit');
      expect(result.xpAwarded).toBe(0);
      expect(mockProgression.awardXp).not.toHaveBeenCalled();
    });

    it('records a raid contribution for a valid guild-mode session', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'session-3',
        userId: 'user-1',
        mode: 'guild',
        raidId: 'raid-1',
        startedAt: new Date(Date.now() - 25 * 60 * 1000),
        endedAt: null,
      });

      const result = await service.complete('user-1', 'session-3');

      expect(mockRaids.recordContribution).toHaveBeenCalledWith(
        'raid-1',
        'user-1',
        'session-3',
        result.xpAwarded,
      );
    });

    it('rejects completing a session that already ended', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'session-4',
        userId: 'user-1',
        startedAt: new Date(),
        endedAt: new Date(),
      });
      await expect(service.complete('user-1', 'session-4')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('recent', () => {
    it('returns only the public fields of up to five ended sessions', async () => {
      mockRepo.find.mockResolvedValue([
        {
          id: 'session-1', userId: 'user-1', subject: 'Cálculo', mode: 'solo',
          startedAt: new Date('2026-01-01T10:00:00Z'), endedAt: new Date('2026-01-01T10:25:00Z'),
          durationValidSeconds: 1500, xpAwarded: 25, discardedReason: null,
          lastHeartbeatAt: new Date(), raidId: 'internal-raid',
        },
      ]);

      const result = await service.recent('user-1');
      expect(result).toEqual([
        expect.objectContaining({
          id: 'session-1', subject: 'Cálculo', mode: 'solo',
          startedAt: new Date('2026-01-01T10:00:00Z'), endedAt: new Date('2026-01-01T10:25:00Z'),
          durationValidSeconds: 1500, xpAwarded: 25, discardedReason: null,
        }),
      ]);
      expect(Object.keys(result[0]!)).toEqual([
        'id', 'subject', 'mode', 'startedAt', 'endedAt', 'durationValidSeconds', 'xpAwarded', 'discardedReason',
      ]);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', endedAt: expect.anything() },
        order: { endedAt: 'DESC', id: 'DESC' },
        take: 5,
      });
    });

    it('returns an empty list when there is no ended activity', async () => {
      mockRepo.find.mockResolvedValue([]);
      await expect(service.recent('user-1')).resolves.toEqual([]);
    });
  });

  describe('metrics', () => {
    it('returns UTC-calendar cadence and streak metrics from valid sessions only', async () => {
      const cadenceBuilder = queryBuilderReturning(0) as ReturnType<typeof queryBuilderReturning> & Record<string, jest.Mock>;
      cadenceBuilder.addSelect = jest.fn().mockReturnThis();
      cadenceBuilder.groupBy = jest.fn().mockReturnThis();
      cadenceBuilder.getRawMany = jest.fn().mockResolvedValue([
        { date: '2026-09-16', sessionCount: '2', validSeconds: '1800' },
        { date: '2026-09-17', sessionCount: '4', validSeconds: '3600' },
      ]);
      const historicalBuilder = queryBuilderReturning(0) as ReturnType<typeof queryBuilderReturning> & Record<string, jest.Mock>;
      historicalBuilder.groupBy = jest.fn().mockReturnThis();
      historicalBuilder.orderBy = jest.fn().mockReturnThis();
      historicalBuilder.getRawMany = jest.fn().mockResolvedValue([
        { date: '2026-09-15' }, { date: '2026-09-16' }, { date: '2026-09-17' },
      ]);
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(cadenceBuilder)
        .mockReturnValueOnce(historicalBuilder);

      const result = await service.metrics('user-1', new Date('2026-09-17T23:59:59.999Z'));

      expect(result.currentStreakDays).toBe(3);
      expect(result.longestStreakDays).toBe(3);
      expect(result.sessionsToday).toBe(4);
      expect(result.dailyGoal).toBe(4);
      expect(result.validSecondsToday).toBe(3600);
      expect(result.cadence.windowStart).toBe('2026-07-24');
      expect(result.cadence.days).toHaveLength(56);
      expect(result.cadence.days.at(-1)).toEqual({
        date: '2026-09-17', sessionCount: 4, validSeconds: 3600, intensity: 4,
      });
      expect(cadenceBuilder.andWhere).toHaveBeenCalledWith(
        'session.endedAt >= :windowStart',
        { windowStart: new Date('2026-07-24T00:00:00.000Z') },
      );
      expect(cadenceBuilder.andWhere).toHaveBeenCalledWith(
        'session.endedAt < :windowEndExclusive',
        { windowEndExclusive: new Date('2026-09-18T00:00:00.000Z') },
      );
      expect(cadenceBuilder.andWhere).toHaveBeenCalledWith('session.discardedReason IS NULL');
      expect(historicalBuilder.andWhere).toHaveBeenCalledWith('session.discardedReason IS NULL');
    });
  });
});
