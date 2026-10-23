import {
  DEFAULT_WEEKLY_OBJECTIVES,
  getWeeklyObjectives,
  weeklyObjectiveProgress,
  type WeeklyObjectiveDefinition,
} from './weekly-objectives';

const byId = (id: string) => DEFAULT_WEEKLY_OBJECTIVES.find((objective) => objective.id === id)!;
const fiveDays = byId('five-days');
const fiveHours = byId('five-hours');
const threeSubjects = byId('three-subjects');
const session = (endedAt: string, validSeconds = 900, subject: string | null = null) => ({
  endedAt: new Date(endedAt),
  validSeconds,
  subject,
});

describe('weekly objectives', () => {
  it('ships the three ADR-014 objectives with their coins', () => {
    expect(DEFAULT_WEEKLY_OBJECTIVES.map(({ id, title, coins }) => [id, title, coins])).toEqual([
      ['five-days', 'Estude em 5 dias diferentes', 40],
      ['five-hours', 'Estude 5h nesta semana', 50],
      ['three-subjects', 'Estude 3 matérias diferentes', 30],
    ]);
  });

  describe('progress', () => {
    it('counts distinct São Paulo days, not sessions', () => {
      const week = [
        session('2026-09-14T13:00:00.000Z'),
        session('2026-09-14T20:00:00.000Z'),
        session('2026-09-15T13:00:00.000Z'),
      ];
      expect(weeklyObjectiveProgress(fiveDays, week)).toEqual({ progress: 2, target: 5, completed: false });
    });

    it('completes at five different days and caps the progress at the target', () => {
      const week = ['14', '15', '16', '17', '18', '19'].map((day) => session(`2026-09-${day}T15:00:00.000Z`));
      expect(weeklyObjectiveProgress(fiveDays, week)).toEqual({ progress: 5, target: 5, completed: true });
    });

    it('puts 02:59:59 UTC on the previous São Paulo day', () => {
      const week = [session('2026-09-15T02:59:59.000Z'), session('2026-09-15T03:00:00.000Z')];
      expect(weeklyObjectiveProgress(fiveDays, week).progress).toBe(2);
      expect(weeklyObjectiveProgress(fiveDays, [session('2026-09-15T02:59:59.000Z'), session('2026-09-15T01:00:00.000Z')]).progress).toBe(1);
    });

    it('sums the valid focus in minutes toward the 5h objective', () => {
      const week = [session('2026-09-14T15:00:00.000Z', 9000), session('2026-09-15T15:00:00.000Z', 3000)];
      expect(weeklyObjectiveProgress(fiveHours, week)).toEqual({ progress: 200, target: 300, completed: false });
      const done = [...week, session('2026-09-16T15:00:00.000Z', 6000)];
      expect(weeklyObjectiveProgress(fiveHours, done)).toEqual({ progress: 300, target: 300, completed: true });
      expect(weeklyObjectiveProgress(fiveHours, [session('2026-09-16T15:00:00.000Z', 17_999)]).completed).toBe(false);
    });

    it('groups subjects like the Diário: ignoring case and edge spaces, leaving out sessions without one', () => {
      const week = [
        session('2026-09-14T15:00:00.000Z', 900, 'Cálculo'),
        session('2026-09-15T15:00:00.000Z', 900, ' cálculo '),
        session('2026-09-16T15:00:00.000Z', 900, null),
        session('2026-09-16T16:00:00.000Z', 900, '   '),
        session('2026-09-17T15:00:00.000Z', 900, 'Calculo'),
      ];
      expect(weeklyObjectiveProgress(threeSubjects, week)).toEqual({ progress: 2, target: 3, completed: false });
      const third = [...week, session('2026-09-18T15:00:00.000Z', 900, 'Física')];
      expect(weeklyObjectiveProgress(threeSubjects, third)).toEqual({ progress: 3, target: 3, completed: true });
    });

    it('starts at zero on an empty week', () => {
      for (const objective of DEFAULT_WEEKLY_OBJECTIVES) {
        expect(weeklyObjectiveProgress(objective, [])).toMatchObject({ progress: 0, completed: false });
      }
    });
  });

  describe('server configuration', () => {
    const original = process.env.WEEKLY_OBJECTIVES;
    afterEach(() => {
      if (original === undefined) delete process.env.WEEKLY_OBJECTIVES;
      else process.env.WEEKLY_OBJECTIVES = original;
    });

    it('falls back to the default list when unset or invalid', () => {
      delete process.env.WEEKLY_OBJECTIVES;
      expect(getWeeklyObjectives()).toEqual(DEFAULT_WEEKLY_OBJECTIVES);
      for (const invalid of ['not json', '[]', '[{"id":"x"}]', '[{"id":"x","title":"t","kind":"nope","target":1,"coins":1}]']) {
        process.env.WEEKLY_OBJECTIVES = invalid;
        expect(getWeeklyObjectives()).toEqual(DEFAULT_WEEKLY_OBJECTIVES);
      }
    });

    it('reads the list and the coins from the environment', () => {
      const custom: WeeklyObjectiveDefinition[] = [{ id: 'three-days', title: 'Três dias', kind: 'distinct-days', target: 3, coins: 9 }];
      process.env.WEEKLY_OBJECTIVES = JSON.stringify(custom);
      expect(getWeeklyObjectives()).toEqual(custom);
    });
  });
});
