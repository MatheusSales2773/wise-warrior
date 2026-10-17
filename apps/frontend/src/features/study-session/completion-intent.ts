import {
  completeStudySession,
  type StudySessionSnapshot,
  type StudySessionTransitionRequest,
  type StudySessionTransitionResult,
} from './api';

export type StudySessionCompletionIntent = {
  request: StudySessionTransitionRequest;
  snapshot: StudySessionSnapshot;
  status: 'ready' | 'pending' | 'retry' | 'waiting' | 'succeeded' | 'conflict';
  retryReady: boolean;
  result: StudySessionTransitionResult | null;
  error: unknown;
  promise: Promise<StudySessionTransitionResult> | null;
};

let retainedIntent: StudySessionCompletionIntent | null = null;
let serverCompletion: StudySessionTransitionResult | null = null;

export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getRetainedCompletionIntent(): StudySessionCompletionIntent | null {
  return retainedIntent;
}

export function syncCompletionIntentWithSnapshot(snapshot: StudySessionSnapshot | null | undefined): void {
  if (!retainedIntent || !snapshot) return;
  if (!matchesActiveRunningSession(retainedIntent, snapshot)) retainedIntent = null;
}

export function getOrCreateCompletionIntent(
  snapshot: StudySessionSnapshot,
): StudySessionCompletionIntent {
  syncCompletionIntentWithSnapshot(snapshot);
  if (retainedIntent) return retainedIntent;

  retainedIntent = {
    request: {
      id: snapshot.id,
      expectedVersion: snapshot.version,
      idempotencyKey: newIdempotencyKey(),
    },
    snapshot,
    status: 'ready',
    retryReady: false,
    result: null,
    error: null,
    promise: null,
  };
  return retainedIntent;
}

export function getCompletionIntentForSnapshot(
  snapshot: StudySessionSnapshot | null | undefined,
): StudySessionCompletionIntent | null {
  return snapshot && retainedIntent && matchesActiveRunningSession(retainedIntent, snapshot)
    ? retainedIntent
    : null;
}

export function getCompletionIntentForSession(
  studySessionId: string | undefined,
): StudySessionCompletionIntent | null {
  if (!studySessionId || retainedIntent?.request.id !== studySessionId) return null;
  return retainedIntent;
}

export function markCompletionIntentReadyAtSnapshot(
  snapshot: StudySessionSnapshot,
): StudySessionCompletionIntent | null {
  const intent = getCompletionIntentForSnapshot(snapshot);
  if (!intent || intent.status !== 'waiting') return null;

  intent.snapshot = snapshot;
  intent.retryReady = true;
  return intent;
}

export function submitCompletionIntent(
  intent: StudySessionCompletionIntent,
): Promise<StudySessionTransitionResult> {
  if (intent.promise) return intent.promise;

  intent.status = 'pending';
  intent.error = null;
  const promise = completeStudySession(intent.request)
    .then((snapshot) => {
      intent.status = 'succeeded';
      intent.result = snapshot;
      return snapshot;
    })
    .catch((error: unknown) => {
      intent.error = error;
      if (isProblemType(error, 'https://wise.app/errors/study-session-completion-too-early')) {
        intent.status = 'waiting';
        intent.retryReady = false;
      } else if (isCompletionStateConflict(error)) {
        intent.status = 'conflict';
        if (retainedIntent === intent) retainedIntent = null;
      } else {
        intent.status = 'retry';
      }
      throw error;
    })
    .finally(() => {
      if (intent.promise === promise) intent.promise = null;
    });
  intent.promise = promise;
  return promise;
}

export function completionIntentCanRetryAt(
  intent: StudySessionCompletionIntent,
  snapshot: StudySessionSnapshot,
): boolean {
  return intent.status === 'waiting'
    && intent.retryReady
    && intent.request.id === snapshot.id
    && intent.request.expectedVersion === snapshot.version;
}

/**
 * The server completed an expired focus while reading the active session (ADR-011 item 6) and returns
 * that result only once: keep it until the screen shows it, even if another reader fetched it.
 */
export function retainServerCompletion(result: StudySessionTransitionResult): void {
  serverCompletion = result;
  if (retainedIntent?.request.id === result.id) retainedIntent = null;
}

export function takeServerCompletion(): StudySessionTransitionResult | null {
  const result = serverCompletion;
  serverCompletion = null;
  return result;
}

export function clearCompletionIntent(): void {
  retainedIntent = null;
}

function isCompletionStateConflict(error: unknown): boolean {
  return isProblemType(error, 'https://wise.app/errors/study-session-version-conflict')
    || isProblemType(error, 'https://wise.app/errors/study-session-transition-not-allowed');
}

function isProblemType(error: unknown, expectedType: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const responseData = (error as { response?: { data?: unknown } }).response?.data;
  return typeof responseData === 'object'
    && responseData !== null
    && (responseData as { type?: unknown }).type === expectedType;
}

function matchesActiveRunningSession(
  intent: StudySessionCompletionIntent,
  snapshot: StudySessionSnapshot,
): boolean {
  return intent.request.id === snapshot.id
    && intent.request.expectedVersion === snapshot.version
    && snapshot.state === 'running';
}
