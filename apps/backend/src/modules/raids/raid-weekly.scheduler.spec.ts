import { Logger } from '@nestjs/common';
import { RaidWeeklyScheduler } from './raid-weekly.scheduler';
import type { RaidsService } from './raids.service';

describe('RaidWeeklyScheduler', () => {
  const now = new Date('2026-10-12T03:00:30Z');
  let runWeeklyClose: jest.Mock;
  let runDragonFury: jest.Mock;
  let scheduler: RaidWeeklyScheduler;

  beforeEach(() => {
    runWeeklyClose = jest.fn().mockResolvedValue({ closed: 0, opened: 0, closings: [] });
    runDragonFury = jest.fn().mockResolvedValue({ regenerated: 0 });
    scheduler = new RaidWeeklyScheduler({ runWeeklyClose, runDragonFury } as unknown as RaidsService, () => now);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('runs the closing with the injected clock', async () => {
    await scheduler.handleCron();

    expect(runWeeklyClose).toHaveBeenCalledWith(now);
  });

  it('catches up at startup without blocking it', async () => {
    let finish: () => void = () => undefined;
    runWeeklyClose.mockReturnValue(new Promise((resolve) => { finish = () => resolve({ closed: 1, opened: 1, closings: [] }); }));

    expect(scheduler.onApplicationBootstrap()).toBeUndefined();
    expect(runWeeklyClose).toHaveBeenCalledTimes(1);
    finish();
    await scheduler.run();
  });

  it('keeps a single run in flight when the minute ticks before the previous one ends', async () => {
    let finish: () => void = () => undefined;
    runWeeklyClose.mockReturnValueOnce(new Promise((resolve) => { finish = () => resolve({ closed: 0, opened: 0, closings: [] }); }));

    const first = scheduler.handleCron();
    const second = scheduler.handleCron();
    expect(runWeeklyClose).toHaveBeenCalledTimes(1);
    finish();
    await Promise.all([first, second]);

    await scheduler.handleCron();
    expect(runWeeklyClose).toHaveBeenCalledTimes(2);
  });

  it('logs a failure and tries again on the next tick instead of crashing', async () => {
    runWeeklyClose.mockRejectedValueOnce(new Error('MySQL indisponível'));

    await expect(scheduler.handleCron()).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalled();

    await scheduler.handleCron();
    expect(runWeeklyClose).toHaveBeenCalledTimes(2);
  });

  it('logs what it closed and opened', async () => {
    runWeeklyClose.mockResolvedValueOnce({ closed: 2, opened: 3, closings: [] });

    await scheduler.handleCron();

    expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('2 Raid(s) fechada(s), 3 aberta(s)'));
  });

  it('runs the Fúria do dragão after the closing, with the same injected clock', async () => {
    const order: string[] = [];
    runWeeklyClose.mockImplementation(async () => { order.push('close'); return { closed: 0, opened: 0, closings: [] }; });
    runDragonFury.mockImplementation(async () => { order.push('fury'); return { regenerated: 0 }; });

    await scheduler.handleCron();

    expect(order).toEqual(['close', 'fury']);
    expect(runDragonFury).toHaveBeenCalledWith(now);
  });

  it('applies the Fúria at startup too, and logs how many Raids it touched', async () => {
    runDragonFury.mockResolvedValueOnce({ regenerated: 2 });

    void scheduler.onApplicationBootstrap();
    await scheduler.run();

    expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('Fúria do dragão: 2 Raid(s)'));
  });
});
