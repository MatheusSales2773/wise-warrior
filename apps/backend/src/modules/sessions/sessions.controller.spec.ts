import { SessionsController } from './sessions.controller';
import type { SessionsService } from './sessions.service';
import type { StudySessionStartService } from './study-session-start.service';
import type { StudySessionTransitionService } from './study-session-transition.service';
import type { Response } from 'express';

describe('SessionsController metrics contract', () => {
  it('passes the authenticated user to the metrics service', async () => {
    const sessions = { metrics: jest.fn().mockResolvedValue({ dailyGoal: 4 }) } as unknown as SessionsService;
    const controller = new SessionsController(sessions, {} as never, {} as never);

    await expect(controller.metrics({ sub: 'user-1' } as never)).resolves.toEqual({ dailyGoal: 4 });
    expect(sessions.metrics).toHaveBeenCalledWith('user-1');
  });
});

describe('SessionsController start and restore contract', () => {
  const user = { sub: 'user-1', sessionId: 'device-1' } as never;

  it('returns 204 when no active Study Session exists', async () => {
    const studySessionStart = { active: jest.fn().mockResolvedValue(null) } as unknown as StudySessionStartService;
    const controller = new SessionsController({} as SessionsService, studySessionStart, {} as never);
    const status = jest.fn();
    const response = { status } as unknown as Response;

    await expect(controller.active(user, response)).resolves.toBeUndefined();
    expect(status).toHaveBeenCalledWith(204);
    expect(studySessionStart.active).toHaveBeenCalledWith('user-1', 'device-1');
  });

  it('forwards the authenticated Session and idempotency key to start', async () => {
    const snapshot = { id: 'study-1', canControl: true };
    const studySessionStart = { start: jest.fn().mockResolvedValue(snapshot) } as unknown as StudySessionStartService;
    const controller = new SessionsController({} as SessionsService, studySessionStart, {} as never);

    await expect(controller.start(user, { plannedDurationSeconds: 900 }, 'request-1')).resolves.toBe(snapshot);
    expect(studySessionStart.start).toHaveBeenCalledWith('user-1', 'device-1', { plannedDurationSeconds: 900 }, 'request-1');
  });

  it('forwards the authenticated Session, expected version and idempotency key to pause', async () => {
    const snapshot = { id: 'study-1', state: 'paused', version: 2 };
    const transitions = { pause: jest.fn().mockResolvedValue(snapshot) } as unknown as StudySessionTransitionService;
    const controller = new SessionsController({} as SessionsService, {} as never, transitions);

    await expect(controller.pause(user, 'study-1', { expectedVersion: 1 }, 'pause-1')).resolves.toBe(snapshot);
    expect(transitions.pause).toHaveBeenCalledWith({
      userId: 'user-1', authSessionId: 'device-1', studySessionId: 'study-1',
      dto: { expectedVersion: 1 }, idempotencyKey: 'pause-1',
    });
  });

  it('forwards the authenticated Session, expected version and idempotency key to resume', async () => {
    const snapshot = { id: 'study-1', state: 'running', version: 3 };
    const transitions = { resume: jest.fn().mockResolvedValue(snapshot) } as unknown as StudySessionTransitionService;
    const controller = new SessionsController({} as SessionsService, {} as never, transitions);

    await expect(controller.resume(user, 'study-1', { expectedVersion: 2 }, 'resume-1')).resolves.toBe(snapshot);
    expect(transitions.resume).toHaveBeenCalledWith({
      userId: 'user-1', authSessionId: 'device-1', studySessionId: 'study-1',
      dto: { expectedVersion: 2 }, idempotencyKey: 'resume-1',
    });
  });

  it('forwards the authenticated Session, expected version and idempotency key to stop', async () => {
    const snapshot = { id: 'study-1', state: 'cancelled', version: 2 };
    const transitions = { stop: jest.fn().mockResolvedValue(snapshot) } as unknown as StudySessionTransitionService;
    const controller = new SessionsController({} as SessionsService, {} as never, transitions);

    await expect(controller.stop(user, 'study-1', { expectedVersion: 1 }, 'stop-1')).resolves.toBe(snapshot);
    expect(transitions.stop).toHaveBeenCalledWith({
      userId: 'user-1', authSessionId: 'device-1', studySessionId: 'study-1',
      dto: { expectedVersion: 1 }, idempotencyKey: 'stop-1',
    });
  });
});
