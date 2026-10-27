import { furyDays, furyRule, lastHitText, studyDaysSummary, timeAndPosition } from '@/features/dashboard/raid-card-model';

const weekDays = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];

describe('furyDays', () => {
  it('marks Dia de estudo, missed, today and upcoming days with their three-letter names', () => {
    const days = furyDays({ weekDays, studyDays: ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09'], today: '2026-10-10' });

    expect(days.map((day) => day.abbreviation)).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']);
    expect(days.map((day) => day.state)).toEqual(['studied', 'studied', 'studied', 'missed', 'studied', 'today', 'upcoming']);
  });

  it('counts a day studied today as studied, not as today', () => {
    const days = furyDays({ weekDays, studyDays: ['2026-10-05'], today: '2026-10-05' });

    expect(days[0]?.state).toBe('studied');
    expect(days.slice(1).every((day) => day.state === 'upcoming')).toBe(true);
  });

  it('counts the days with study', () => {
    expect(studyDaysSummary(furyDays({ weekDays, studyDays: ['2026-10-05', '2026-10-09'], today: '2026-10-10' }))).toBe('2 de 7 dias com estudo');
    expect(studyDaysSummary(furyDays({ weekDays, studyDays: [], today: '2026-10-05' }))).toBe('0 de 7 dias com estudo');
  });
});

describe('Fúria rule', () => {
  it('states the percent the boss recovers', () => {
    expect(furyRule(5)).toBe('O chefe recupera 5% da vida a cada dia sem estudo na guilda.');
    expect(furyRule(10)).toBe('O chefe recupera 10% da vida a cada dia sem estudo na guilda.');
  });
});

describe('lastHitText', () => {
  it('names the author, the XP and the minutes, leaving the minutes out without a Study Session', () => {
    expect(lastHitText({ displayName: 'Lia', xp: 400, focusMinutes: 40 })).toBe('Último golpe: Lia · +400 XP · 40 min');
    expect(lastHitText({ displayName: 'Lia', xp: 400, focusMinutes: null })).toBe('Último golpe: Lia · +400 XP');
  });
});

describe('timeAndPosition', () => {
  const left = ((3 * 24 + 14) * 60 + 5) * 60_000;

  it('joins the time left and the place, and leaves the place out for who is not a Participant', () => {
    expect(timeAndPosition(left, 4, { long: true })).toBe('3d 14h restantes · você: 4º');
    expect(timeAndPosition(left, 4, { long: false })).toBe('3d 14h · você: 4º');
    expect(timeAndPosition(left, null, { long: true })).toBe('3d 14h restantes');
  });
});
