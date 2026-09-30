import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProgressionService } from '../progression/progression.service';
import { CosmeticItem } from './entities/cosmetic-item.entity';
import { User } from './entities/user.entity';
import { UserCosmeticItem } from './entities/user-cosmetic-item.entity';
import { UsersService } from './users.service';

const mockUsers = {
  findOne: jest.fn(),
};

const mockUserCosmetics = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
};

const mockCosmeticItems = {};

const mockProgression = {
  getCharacterSnapshot: jest.fn(),
  getProjection: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUsers },
        {
          provide: getRepositoryToken(UserCosmeticItem),
          useValue: mockUserCosmetics,
        },
        { provide: getRepositoryToken(CosmeticItem), useValue: mockCosmeticItems },
        { provide: ProgressionService, useValue: mockProgression },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('derives profile level boundaries from the character XP projection', async () => {
    const xpTotal = 1_501;
    mockUsers.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'hero@wise.app',
      displayName: 'Hero',
      planTier: 'premium',
    });
    mockProgression.getCharacterSnapshot.mockResolvedValue({
      xpTotal,
      level: 2,
      title: 'Scholar',
    });
    mockProgression.getProjection.mockReturnValue({
      level: 2,
      levelStartXp: 1_414,
      nextLevelXp: 2_598,
    });

    await expect(service.getProfile('user-1')).resolves.toEqual({
      id: 'user-1',
      email: 'hero@wise.app',
      displayName: 'Hero',
      planTier: 'premium',
      level: 2,
      xpTotal,
      levelStartXp: 1_414,
      nextLevelXp: 2_598,
      title: 'Scholar',
    });
    expect(mockProgression.getCharacterSnapshot).toHaveBeenCalledWith('user-1');
    expect(mockProgression.getProjection).toHaveBeenCalledWith(xpTotal);
  });

  it('uses the zero-XP projection when the character is missing without writing', async () => {
    mockUsers.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'hero@wise.app',
      displayName: 'Hero',
      planTier: 'free',
    });
    mockProgression.getCharacterSnapshot.mockResolvedValue(null);
    mockProgression.getProjection.mockReturnValue({
      level: 1,
      levelStartXp: 0,
      nextLevelXp: 1_414,
    });

    await expect(service.getProfile('user-1')).resolves.toEqual({
      id: 'user-1',
      email: 'hero@wise.app',
      displayName: 'Hero',
      planTier: 'free',
      level: 1,
      xpTotal: 0,
      levelStartXp: 0,
      nextLevelXp: 1_414,
      title: null,
    });
    expect(mockProgression.getCharacterSnapshot).toHaveBeenCalledWith('user-1');
    expect(mockProgression.getProjection).toHaveBeenCalledWith(0);
    expect(mockUserCosmetics.save).not.toHaveBeenCalled();
  });
});
