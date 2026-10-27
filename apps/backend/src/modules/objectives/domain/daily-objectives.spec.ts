import {
  DEFAULT_DAILY_OBJECTIVES,
  dailyObjectiveProgress,
  getDailyObjectives,
  type DailyObjectiveDefinition,
} from './daily-objectives';

const byId = (id: string) => DEFAULT_DAILY_OBJECTIVES.find((objective) => objective.id === id)!;
const oneSession = byId('one-session');
const fourSessions = byId('four-sessions');
const fiftyMinutes = byId('fifty-minutes');
const session = (validSeconds: number) => ({ validSeconds });

describe('daily objectives', () => {
  it('ships the three ADR-014 objectives with their coins', () => {
    expect(DEFAULT_DAILY_OBJECTIVES.map(({ id, title, coins }) => [id, title, coins])).toEqual([
      ['one-session', 'Conclua 1 sessão de foco', 5],
      ['four-sessions', 'Conclua 4 sessões hoje', 15],
      ['fifty-minutes', 'Faça uma sessão de 50 minutos', 10],
    ]);
  });

  describe('progress', () => {
    it('counts every finished session toward the session-count objectives', () => {
      const day = [session(60), session(0), session(1500)];
      expect(dailyObjectiveProgress(oneSession, day)).toEqual({ progress: 1, target: 1, completed: true });
      expect(dailyObjectiveProgress(fourSessions, day)).toEqual({ progress: 3, target: 4, completed: false });
    });

    it('caps the progress at the target once the objective is met', () => {
      const day = Array.from({ length: 6 }, () => session(900));
      expect(dailyObjectiveProgress(fourSessions, day)).toEqual({ progress: 4, target: 4, completed: true });
    });

    it('starts at zero on an empty day', () => {
      expect(dailyObjectiveProgress(oneSession, [])).toEqual({ progress: 0, target: 1, completed: false });
    });

    it('needs one single session of 50 valid minutes, not 50 minutes across sessions', () => {
      expect(dailyObjectiveProgress(fiftyMinutes, [session(1500), session(1500), session(1500)]).completed).toBe(false);
      expect(dailyObjectiveProgress(fiftyMinutes, [session(2999)]).completed).toBe(false);
      expect(dailyObjectiveProgress(fiftyMinutes, [session(900), session(3000)])).toEqual({ progress: 1, target: 1, completed: true });
    });
  });

  describe('server configuration', () => {
    const original = process.env.DAILY_OBJECTIVES;
    afterEach(() => {
      if (original === undefined) delete process.env.DAILY_OBJECTIVES;
      else process.env.DAILY_OBJECTIVES = original;
    });

    it('falls back to the default list when unset or invalid', () => {
      delete process.env.DAILY_OBJECTIVES;
      expect(getDailyObjectives()).toEqual(DEFAULT_DAILY_OBJECTIVES);
      for (const invalid of ['not json', '[]', '[{"id":"x"}]', '{"a":1}']) {
        process.env.DAILY_OBJECTIVES = invalid;
        expect(getDailyObjectives()).toEqual(DEFAULT_DAILY_OBJECTIVES);
      }
    });

    it('reads the list and the coins from the environment', () => {
      const custom: DailyObjectiveDefinition[] = [
        { id: 'one-session', title: 'Uma só', target: 1, coins: 7 },
        { id: 'long', title: 'Uma longa', target: 1, minValidMinutes: 30, coins: 3 },
      ];
      process.env.DAILY_OBJECTIVES = JSON.stringify(custom);
      expect(getDailyObjectives()).toEqual(custom);
    });
  });
});
