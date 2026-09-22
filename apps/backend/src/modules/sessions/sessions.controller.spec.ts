import { SessionsController } from './sessions.controller';
import type { SessionsService } from './sessions.service';
import type { StudySessionStartService } from './study-session-start.service';
import type { Response } from 'express';

describe('SessionsController metrics contract', () => {
  it('passes the authenticated user to the metrics service', async () => {
    const sessions = { metrics: jest.fn().mockResolvedValue({ dailyGoal: 4 }) } as unknown as SessionsService;
    const controller = new SessionsController(sessions, {} as never);

    await expect(controller.metrics({ sub: 'user-1' } as never)).resolves.toEqual({ dailyGoal: 4 });
    expect(sessions.metrics).toHaveBeenCalledWith('user-1');
  });
});

describe('SessionsController start and restore contract', () => {
  const user = { sub: 'user-1', sessionId: 'device-1' } as never;

  it('returns 204 when no active Study Session exists', async () => {
    const studySessionStart = { active: jest.fn().mockResolvedValue(null) } as unknown as StudySessionStartService;
    const controller = new SessionsController({} as SessionsService, studySessionStart);
    const status = jest.fn();
    const response = { status } as unknown as Response;

    await expect(controller.active(user, response)).resolves.toBeUndefined();
    expect(status).toHaveBeenCalledWith(204);
    expect(studySessionStart.active).toHaveBeenCalledWith('user-1', 'device-1');
  });

  it('forwards the authenticated Session and idempotency key to start', async () => {
    const snapshot = { id: 'study-1', canControl: true };
    const studySessionStart = { start: jest.fn().mockResolvedValue(snapshot) } as unknown as StudySessionStartService;
    const controller = new SessionsController({} as SessionsService, studySessionStart);

    await expect(controller.start(user, { plannedDurationSeconds: 900 }, 'request-1')).resolves.toBe(snapshot);
    expect(studySessionStart.start).toHaveBeenCalledWith('user-1', 'device-1', { plannedDurationSeconds: 900 }, 'request-1');
  });
});
