/**
 * Commands this device sent over REST but has not confirmed yet. The server publishes `studySession:changed`
 * before answering the HTTP request, so the device can receive its own event while the local cache still holds
 * the previous version. Remembering the version the command is about to write tells that echo apart from a real
 * change made on another device, without waiting for the response.
 */
type PendingStudySessionCommand =
  | { kind: 'start' }
  | { kind: 'transition'; studySessionId: string; version: number };

type ChangedEvent = { studySessionId: string; version: number; state: string };

const pending: PendingStudySessionCommand[] = [];

export function beginStudySessionCommand(command: PendingStudySessionCommand): void {
  pending.push(command);
}

export function endStudySessionCommand(command: PendingStudySessionCommand): void {
  const index = pending.indexOf(command);
  if (index >= 0) pending.splice(index, 1);
}

/** The event that this device's own in-flight command just produced. */
export function isOwnStudySessionCommand(event: ChangedEvent): boolean {
  return pending.some((command) => command.kind === 'start'
    ? event.version === 1 && event.state === 'running'
    : command.studySessionId === event.studySessionId && command.version === event.version);
}
