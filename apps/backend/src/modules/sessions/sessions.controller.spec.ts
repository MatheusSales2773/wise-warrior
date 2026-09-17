import { SessionsController } from './sessions.controller';
import type { SessionsService } from './sessions.service';

describe('SessionsController metrics contract', () => {
  it('passes the authenticated user to the metrics service', async () => {
    const sessions = { metrics: jest.fn().mockResolvedValue({ dailyGoal: 4 }) } as unknown as SessionsService;
    const controller = new SessionsController(sessions);

    await expect(controller.metrics({ sub: 'user-1' } as never)).resolves.toEqual({ dailyGoal: 4 });
    expect(sessions.metrics).toHaveBeenCalledWith('user-1');
  });
});
