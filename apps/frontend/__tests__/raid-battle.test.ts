import type { RaidRankingEntry } from '@/features/guild/api';
import { XP_PER_FOCUS_HOUR, assignHeroes, bossLifePercent, formatBattleTimeLeft, formatFocusHours, raidParty, weeklyStrikes } from '@/features/guild/raid-battle';
import { raidSceneScale } from '@/features/guild/raid-scene';
import { RAID_SCENE_HEIGHT, RAID_SCENE_WIDTH, raidSceneBackground, raidSceneBoss, sentinelaSprite } from '@/features/guild/raid-scene-sprites';

const entry = (position: number, overrides: Partial<RaidRankingEntry> = {}): RaidRankingEntry => ({
  position,
  userId: `u${position}`,
  displayName: `Membro ${position}`,
  level: position + 1,
  title: null,
  contributionXp: (10 - position) * XP_PER_FOCUS_HOUR,
  isMe: false,
  ...overrides,
});

describe('formatFocusHours', () => {
  it('converts XP to focus hours at 10 XP per minute', () => {
    expect(formatFocusHours(120_000)).toBe('200h');
    expect(formatFocusHours(82_800)).toBe('138h');
  });

  it('shows whole hours for totals of 10h or more and one decimal below that', () => {
    expect(formatFocusHours(83_000)).toBe('138h');
    expect(formatFocusHours(1_500)).toBe('2,5h');
    expect(formatFocusHours(0)).toBe('0,0h');
  });

  it('keeps one decimal for what each member did', () => {
    expect(formatFocusHours(14_520, { precise: true })).toBe('24,2h');
    expect(formatFocusHours(6_780, { precise: true })).toBe('11,3h');
  });

  it('never rounds a member up past what they did', () => {
    expect(formatFocusHours(599, { precise: true })).toBe('0,9h');
  });
});

describe('bossLifePercent', () => {
  it('is what is left of the goal', () => {
    expect(bossLifePercent(82_800, 120_000, false)).toBe(31);
    expect(bossLifePercent(0, 1_500, false)).toBe(100);
  });

  it('drops to zero once the goal is reached', () => {
    expect(bossLifePercent(1_600, 1_500, true)).toBe(0);
  });
});

describe('formatBattleTimeLeft', () => {
  const hours = (count: number) => count * 60 * 60 * 1000;

  it('reads as days and hours, with "restantes" in the long form', () => {
    expect(formatBattleTimeLeft(hours(3 * 24 + 14))).toBe('3d 14h');
    expect(formatBattleTimeLeft(hours(3 * 24 + 14), { long: true })).toBe('3d 14h restantes');
  });

  it('switches to hours and minutes, then minutes, near the end', () => {
    expect(formatBattleTimeLeft(hours(5) + 20 * 60_000)).toBe('5h 20min');
    expect(formatBattleTimeLeft(45 * 60_000)).toBe('45min');
  });

  it('says the Raid is ending at zero', () => {
    expect(formatBattleTimeLeft(0, { long: true })).toBe('Encerrando…');
  });
});

describe('assignHeroes', () => {
  const members = ['Astaroth', 'Eldoria', 'Ravenstone', 'Brisa'].map((name) => ({ userId: `u-${name}`, isMe: false }));

  it('shows you with the Personagem hero', () => {
    expect(assignHeroes([{ userId: 'me', isMe: true }]).get('me')).toBe('erudito');
  });

  it('gives a party of five five different heroes', () => {
    const heroes = assignHeroes([...members, { userId: 'me', isMe: true }]);
    expect(new Set(heroes.values()).size).toBe(5);
  });

  it('keeps everyone on the same hero for the same ranking', () => {
    expect([...assignHeroes(members)]).toEqual([...assignHeroes(members)]);
  });
});

describe('raidParty', () => {
  it('puts the first five Participants of the ranking in the scene and calls you "Você"', () => {
    const party = raidParty([entry(1), entry(2, { isMe: true }), entry(3), entry(4), entry(5), entry(6)]);
    expect(party.map((member) => member.displayName)).toEqual(['Membro 1', 'Você', 'Membro 3', 'Membro 4', 'Membro 5']);
    expect(party[1]).toMatchObject({ isMe: true, hero: 'erudito', level: 3 });
  });
});

describe('weeklyStrikes', () => {
  it('lists the first rows with bars relative to the top contributor', () => {
    const strikes = weeklyStrikes([entry(1, { contributionXp: 1_000 }), entry(2, { contributionXp: 250 })], 4);
    expect(strikes.map((strike) => strike.fraction)).toEqual([1, 0.25]);
  });

  it('gives your row the last slot when you are further down', () => {
    const strikes = weeklyStrikes([entry(1), entry(2), entry(3), entry(4, { isMe: true })], 3);
    expect(strikes.map((strike) => strike.entry.userId)).toEqual(['u1', 'u2', 'u4']);
  });

  it('shows empty bars while nobody has contributed', () => {
    expect(weeklyStrikes([entry(1, { contributionXp: 0 })], 3)[0]!.fraction).toBe(0);
  });
});

describe('raid scene', () => {
  it('scales by whole numbers: ×6 on the 1080px desktop column and ×2 on a 342px phone', () => {
    expect(raidSceneScale(1080)).toBe(6);
    expect(raidSceneScale(342)).toBe(2);
    expect(raidSceneScale(1000)).toBe(5);
    expect(raidSceneScale(200)).toBe(2);
    expect(raidSceneScale(4000)).toBe(6);
  });

  it('keeps the exported pixel art rectangular and inside its palette', () => {
    for (const sprite of [raidSceneBackground, raidSceneBoss, sentinelaSprite]) {
      const width = sprite.rows[0]!.length;
      for (const row of sprite.rows) {
        expect(row).toHaveLength(width);
        for (const key of row.replace(/\./g, '')) {
          const index = key >= 'a' ? key.charCodeAt(0) - 97 : key.charCodeAt(0) - 65 + 26;
          expect(sprite.palette[index]).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
    expect(raidSceneBackground.rows).toHaveLength(RAID_SCENE_HEIGHT);
    expect(raidSceneBackground.rows[0]).toHaveLength(RAID_SCENE_WIDTH);
  });
});
