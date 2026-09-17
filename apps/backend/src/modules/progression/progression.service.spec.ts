import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProgressionService } from './progression.service';
import { Character } from './entities/character.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  MAX_SUPPORTED_XP_TOTAL,
  xpThresholdForLevel,
} from './domain/progression-policy';

const mockCharacterRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockRealtimeGateway = {
  emitToUser: jest.fn(),
  emitToGuild: jest.fn(),
};

describe('ProgressionService', () => {
  let service: ProgressionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressionService,
        { provide: getRepositoryToken(Character), useValue: mockCharacterRepo },
        { provide: RealtimeGateway, useValue: mockRealtimeGateway },
      ],
    }).compile();
    service = module.get(ProgressionService);
  });

  it('throws NotFoundException when the character does not exist', async () => {
    mockCharacterRepo.findOne.mockResolvedValue(null);
    await expect(service.awardXp('user-1', 100)).rejects.toThrow(NotFoundException);
  });

  it('projects the current level boundaries for a profile read', () => {
    const xpTotal = xpThresholdForLevel(5) + 1;

    expect(service.getProjection(xpTotal)).toEqual({
      level: 5,
      levelStartXp: xpThresholdForLevel(5),
      nextLevelXp: xpThresholdForLevel(6),
    });
  });

  it('exposes a narrow character snapshot through the progression service', async () => {
    mockCharacterRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      xpTotal: 1_501,
      level: 2,
      title: 'Scholar',
    });

    await expect(service.getCharacterSnapshot('user-1')).resolves.toEqual({
      xpTotal: 1_501,
      level: 2,
      title: 'Scholar',
    });
  });

  it('rejects a character whose persisted level disagrees with its XP', async () => {
    mockCharacterRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      xpTotal: 1_501,
      level: 3,
    });

    await expect(service.getCharacterSnapshot('user-1')).rejects.toThrow(
      'nível persistido inconsistente com xpTotal',
    );
  });

  it('returns no character snapshot for a legacy user without a character', async () => {
    mockCharacterRepo.findOne.mockResolvedValue(null);

    await expect(service.getCharacterSnapshot('user-1')).resolves.toBeNull();
  });

  it('projects coherent boundaries at the supported XP ceiling', () => {
    const projection = service.getProjection(MAX_SUPPORTED_XP_TOTAL);

    expect(projection.levelStartXp).toBeLessThanOrEqual(MAX_SUPPORTED_XP_TOTAL);
    expect(MAX_SUPPORTED_XP_TOTAL).toBeLessThan(projection.nextLevelXp);
    expect(projection.nextLevelXp).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });

  it('persists accumulated XP and emits progress:xpUpdated', async () => {
    mockCharacterRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      xpTotal: 0,
      level: 1,
    });
    mockCharacterRepo.save.mockImplementation((c) => c);

    const result = await service.awardXp('user-1', 100);

    expect(result.newXpTotal).toBe(100);
    expect(result.leveledUp).toBe(false);
    expect(mockCharacterRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ xpTotal: 100, level: 1 }),
    );
    expect(mockRealtimeGateway.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'progress:xpUpdated',
      expect.objectContaining({ xpTotal: 100 }),
    );
    expect(mockRealtimeGateway.emitToUser).not.toHaveBeenCalledWith(
      'user-1',
      'notification:levelup',
      expect.anything(),
    );
  });

  it.each([-1, 1.5, NaN, Infinity])(
    'rejects invalid XP gain %p before persistence or notification',
    async (xpGained) => {
      mockCharacterRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        xpTotal: 100,
        level: 1,
      });

      await expect(service.awardXp('user-1', xpGained)).rejects.toThrow();

      expect(mockCharacterRepo.save).not.toHaveBeenCalled();
      expect(mockRealtimeGateway.emitToUser).not.toHaveBeenCalled();
    },
  );

  it('emits notification:levelup when XP crosses a threshold', async () => {
    const threshold = xpThresholdForLevel(2);
    mockCharacterRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      xpTotal: threshold - 10,
      level: 1,
    });
    mockCharacterRepo.save.mockImplementation((c) => c);

    const result = await service.awardXp('user-1', 10);

    expect(result.leveledUp).toBe(true);
    expect(mockRealtimeGateway.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'notification:levelup',
      { previousLevel: 1, newLevel: 2 },
    );
  });
});
