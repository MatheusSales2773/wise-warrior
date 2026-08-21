import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProgressionService } from './progression.service';
import { Character } from './entities/character.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { xpThresholdForLevel } from './domain/progression-policy';

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
