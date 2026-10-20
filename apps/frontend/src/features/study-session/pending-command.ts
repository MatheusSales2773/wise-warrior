/**
 * Commands this device sent over REST, and the ones it confirmed last. The server publishes `studySession:changed`
 * before answering the HTTP request, so the device can receive its own event while the local cache still holds
 * the previous version, or after the response already replaced it. Both tell the echo apart from a real change
 * made on another device.
 */
export type PendingStudySessionCommand =
  | { kind: 'start' }
  | { kind: 'transition'; studySessionId: string; version: number };

/** The session and version a confirmed command wrote. */
export type StudySessionCommandEcho = { studySessionId: string; version: number };

type ChangedEvent = StudySessionCommandEcho & { state: string };

type HeldEvent = { event: ChangedEvent; apply: () => void };

/** Enough for the echoes still on their way; a version is never written twice, so an old entry is harmless. */
const CONFIRMED_LIMIT = 8;

const pending = new Map<PendingStudySessionCommand, HeldEvent[]>();
const confirmed: StudySessionCommandEcho[] = [];

export function beginStudySessionCommand(command: PendingStudySessionCommand): void {
  pending.set(command, []);
}

/**
 * `result` is what the server answered, or `null` when the request failed. A failed request may still have been
 * applied (the connection dropped after the commit), so every event held for it is applied now; a confirmed one
 * only drops the event it wrote itself.
 */
export function settleStudySessionCommand(
  command: PendingStudySessionCommand,
  result: StudySessionCommandEcho | null,
): void {
  const held = pending.get(command) ?? [];
  pending.delete(command);
  if (result) {
    confirmed.push(result);
    if (confirmed.length > CONFIRMED_LIMIT) confirmed.shift();
  }
  for (const { event, apply } of held) {
    if (!result || !sameEcho(event, result)) apply();
  }
}

/**
 * Holds the event an in-flight command of this device may have produced until that command settles. A start
 * cannot know its session yet, so it holds any new running session; if the start fails or answers another
 * session, the held event is applied then.
 */
export function holdOwnStudySessionEcho(event: ChangedEvent, apply: () => void): boolean {
  for (const [command, held] of pending) {
    const own = command.kind === 'start'
      ? event.version === 1 && event.state === 'running'
      : command.studySessionId === event.studySessionId && command.version === event.version;
    if (own) {
      held.push({ event, apply });
      return true;
    }
  }
  return false;
}

/** The echo of a command this device already confirmed, arriving after its response. */
export function isConfirmedStudySessionEcho(event: ChangedEvent): boolean {
  return confirmed.some((echo) => sameEcho(event, echo));
}

function sameEcho(event: StudySessionCommandEcho, echo: StudySessionCommandEcho): boolean {
  return event.studySessionId === echo.studySessionId && event.version === echo.version;
}
