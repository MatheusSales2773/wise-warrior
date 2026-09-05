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
});
