import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Text, View, useWindowDimensions } from 'react-native';
import { Screen, WiseButton, WiseCard, WiseText } from '@/design-system';
import {
  pauseStudySession,
  resumeStudySession,
  startStudySession,
  stopStudySession,
  type StudySessionSnapshot,
  type StudySessionTransitionResult,
  type StudySessionTransitionAction,
  type StudySessionTransitionRequest,
} from './api';
import { FREE_FOCUS, plannedSeconds, type FocusChoice } from './focus-choice';
import { activeStudySessionQueryKey, invalidateStudySessionResult, recentStudySessionSubjectsQueryKey, useActiveStudySession, useFocusCycle } from './queries';
import { breakRemainingSeconds, clearBreak, currentBreak, startBreak, type BreakKind, type BreakRun } from './pomodoro-break';
import { stopSessionSounds, unlockSessionSounds } from './sounds';
import { elapsedStudySeconds, formatRemainingTime, isFreeFocus, remainingStudySeconds } from './timer';
import { MAX_SUBJECT_LENGTH, validateSubject, type SubjectValidation } from './subject';
import { useDevicePreference, useDevicePreferencesLoaded } from '@/core/preferences/device-preferences';
import { useIsOnline } from '@/core/query/online-manager';
import { ForgeHistory } from './forge-history';
import { ForgeAnvil, ForgeColumns } from './forge-anvil';
import { BreakOffer, BreakStage } from './forge-break';
import { ForgePrepCard, ForgeStartButton, type ForgeRaid, type SessionMode } from './forge-prep-card';
import { ForgePageGradient, ForgeHeader } from './forge-primitives';
import { ForgeReadyHero, ForgeReadySummary, ForgeRulesCard, ForgeTodayCard } from './forge-ready';
import { ForgeActiveSupport, ForgeSessionCard, type ForgeSessionControl } from './forge-session-card';
import { styles } from './forge-styles';
import { STOP_COPY, stopKindFor, type StopKind } from './stop-confirmation';
import { ForgeSyncIndicator } from './sync-indicator';
import { forgeSyncStatus } from './sync-status';
import { isApiError } from '@/core/api/api-error';
import { joinRaid, type ActiveRaid } from '@/features/guild/api';
import { activeRaidQueryOptions, guildKeys, myGuildQueryOptions } from '@/features/guild/queries';
import {
  clearCompletionIntent,
  completionIntentCanRetryAt,
  getCompletionIntentForSession,
  getCompletionIntentForSnapshot,
  getOrCreateCompletionIntent,
  getRetainedCompletionIntent,
  markCompletionIntentReadyAtSnapshot,
  newIdempotencyKey,
  submitCompletionIntent,
  syncCompletionIntentWithSnapshot,
  takeServerCompletion,
  type StudySessionCompletionIntent,
} from './completion-intent';
import { useStudySessionAppActive } from './use-study-session-app-active';

type TransitionAction = Exclude<StudySessionTransitionAction, 'complete'>;
type TransitionCommand = StudySessionTransitionRequest & { action: TransitionAction };

const TRANSITION_HANDLERS: Record<TransitionAction, (command: StudySessionTransitionRequest) => Promise<StudySessionTransitionResult>> = {
  pause: pauseStudySession,
  resume: resumeStudySession,
  stop: stopStudySession,
};

const TRANSITION_COPY: Record<TransitionAction, { status: string; action: string; button: string }> = {
  pause: { status: 'Pausando sessão.', action: 'pausar', button: 'Pausando sessão…' },
  resume: { status: 'Retomando sessão.', action: 'retomar', button: 'Retomando sessão…' },
  stop: { status: 'Encerrando sessão.', action: 'encerrar', button: 'Encerrando sessão…' },
};

const STUDY_SESSION_VERSION_CONFLICT = 'https://wise.app/errors/study-session-version-conflict';
const RAID_ENDED = 'https://wise.app/errors/raid-ended';
const DAILY_LIMIT_REACHED = 'https://wise.app/errors/daily-limit-reached';

export type { SessionMode } from './forge-prep-card';

const NO_SUBJECT_LABEL = 'Sem matéria';
/** Below this width the Forja is the phone layout: compact header, preparation without a card, start button in the footer. */
const COMPACT_WIDTH = 600;

function subjectError(validation: SubjectValidation): string | undefined {
  if (validation.status === 'too-long') return `A Matéria tem ${validation.length} caracteres; o máximo é ${MAX_SUBJECT_LENGTH}.`;
  if (validation.status === 'invalid-characters') return 'A Matéria não pode conter quebras de linha nem caracteres de controle.';
  return undefined;
}

/**
 * The Raid a guild-mode session would contribute to: the active Raid of the user's Guild. Without a
 * Guild, without a Raid or on any failure there is none and the option stays hidden. A Raid that ends
 * while cached is caught by the server, which answers the start with 409.
 */
function useForgeRaid(): ForgeRaid | null {
  const mine = useQuery(myGuildQueryOptions());
  const guildId = mine.data?.guild.id;
  const raid = useQuery({ ...activeRaidQueryOptions(guildId ?? ''), enabled: guildId !== undefined });
  if (!guildId || !raid.data || raid.data.status === 'expired') return null;
  return { guildId, raid: raid.data };
}

function isVersionConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const responseData = (error as { response?: { data?: unknown } }).response?.data;
  return typeof responseData === 'object'
    && responseData !== null
    && (responseData as { type?: unknown }).type === STUDY_SESSION_VERSION_CONFLICT;
}

/** `initialMode` comes from the route: "Atacar com foco" on the Raid opens the Forja with `?modo=guilda`. */
export function StudySessionScreen({ initialMode = 'solo' }: { initialMode?: SessionMode } = {}) {
  const { width } = useWindowDimensions();
  const wideLayout = width >= 1140;
  const compactLayout = width < COMPACT_WIDTH;
  const ringSize = wideLayout ? 340 : Platform.OS === 'web' ? Math.min(310, width * 0.78) : Math.min(264, width * 0.68);
  const queryClient = useQueryClient();
  const [defaultDuration] = useDevicePreference('defaultFocusDuration');
  const [confirmBeforeStopping] = useDevicePreference('confirmBeforeStopping');
  // The open stop dialog, pinned to the session and the kind it was opened with: the valid focus keeps growing, and
  // the dialog must not turn a Cancelamento into an Encerramento antecipado while it is up.
  const [stopDialog, setStopDialog] = useState<{ sessionId: string; kind: StopKind } | null>(null);
  // The Forja opens on the device's default; a pick made here holds until the screen closes.
  const [picked, setSelected] = useState<FocusChoice | null>(null);
  const selected: FocusChoice = picked ?? defaultDuration;
  // Until the stored default is read, Iniciar would send the 25 min placeholder instead of the saved duration.
  const preferencesLoaded = useDevicePreferencesLoaded();
  const waitingForDefault = picked === null && !preferencesLoaded;
  const [subjectInput, setSubjectInput] = useState('');
  const [sessionMode, setSessionMode] = useState<SessionMode>(initialMode);
  const [raidEndedNotice, setRaidEndedNotice] = useState(false);
  const forgeRaid = useForgeRaid();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [breakRun, setBreakRun] = useState<BreakRun | null>(() => currentBreak(queryClient));
  const [sawActiveSession, setSawActiveSession] = useState(false);
  const [cycleFresh, setCycleFresh] = useState(true);
  const [breakNow, setBreakNow] = useState(() => Date.now());
  const [retryTransition, setRetryTransition] = useState<TransitionCommand | null>(null);
  const [terminalResult, setTerminalResult] = useState<StudySessionTransitionResult | null>(null);
  const [remoteEndNotice, setRemoteEndNotice] = useState(false);
  const [completionIntentState, setCompletionIntentState] = useState<StudySessionCompletionIntent | null>(
    () => getRetainedCompletionIntent(),
  );
  const [completionConflictVersion, setCompletionConflictVersion] = useState<{ id: string; version: number } | null>(null);
  const [foregroundSyncPending, setForegroundSyncPending] = useState(false);
  const pendingKey = useRef<string | null>(null);
  const announcedStatus = useRef<string | null>(null);
  const observedCompletionPromise = useRef<Promise<StudySessionTransitionResult> | null>(null);
  // The last session this screen saw active, to tell "ended elsewhere" from a Forja that never had one.
  const previousActiveSessionId = useRef<string | null>(null);
  const serverCompletionTaken = useRef(false);
  const requiresForegroundRefresh = useRef(false);
  const applicationActive = useStudySessionAppActive();
  const wasApplicationActive = useRef(applicationActive);
  const active = useActiveStudySession();
  const online = useIsOnline();
  const focusCycle = useFocusCycle();
  const refetchActive = active.refetch;
  const refreshActive = useCallback(async () => {
    const result = await refetchActive();
    if (!result.isError && result.status === 'success' && result.data) {
      syncCompletionIntentWithSnapshot(result.data);
      const readyIntent = markCompletionIntentReadyAtSnapshot(result.data);
      if (readyIntent) setCompletionIntentState(readyIntent);
    }
    return result;
  }, [refetchActive]);
  const activeSnapshot = active.data;
  // A session started elsewhere ends the local break and the previous result: drop them once, not on every render.
  if ((activeSnapshot != null) !== sawActiveSession) {
    setSawActiveSession(activeSnapshot != null);
    if (activeSnapshot != null && breakRun) setBreakRun(null);
    if (activeSnapshot != null && terminalResult && terminalResult.id !== activeSnapshot.id) setTerminalResult(null);
  }
  const hasActiveSession = activeSnapshot != null;
  useEffect(() => {
    if (hasActiveSession) clearBreak(queryClient);
  }, [hasActiveSession, queryClient]);
  const retainedCompletionIntent = activeSnapshot
    ? getCompletionIntentForSnapshot(activeSnapshot)
    : getRetainedCompletionIntent();
  const completionIntent = retainedCompletionIntent
    ?? (completionIntentState?.status === 'conflict'
      && (!activeSnapshot || (
        completionIntentState.request.id === activeSnapshot.id
        && completionIntentState.request.expectedVersion === activeSnapshot.version
      ))
      ? completionIntentState
      : null);
  const snapshot = activeSnapshot ?? completionIntent?.snapshot ?? null;
  const completionResult = completionIntent?.result ?? null;
  const displayedTerminalResult = completionResult ?? terminalResult;

  const settleTerminalResult = useCallback(async (result: StudySessionTransitionResult) => {
    setTerminalResult(result);
    setCycleFresh(false);
    await queryClient.cancelQueries({ queryKey: activeStudySessionQueryKey });
    queryClient.setQueryData(activeStudySessionQueryKey, null);
    await invalidateStudySessionResult(queryClient, result.mode);
    // Only now does the cycle include this focus, so the right break (short or long) can be offered.
    setCycleFresh(true);
  }, [queryClient]);

  // The read itself may have completed the expired focus on the server: show that result like a local completion.
  useEffect(() => {
    const serverResult = takeServerCompletion();
    serverCompletionTaken.current = serverResult !== null;
    if (serverResult) queueMicrotask(() => void settleTerminalResult(serverResult));
  }, [active.dataUpdatedAt, settleTerminalResult]);

  // D-005/D-006: a session that vanishes without a result from this device ended on another device. There is no
  // route for the result, so only warn — XP and Moedas arrive through their own events.
  useEffect(() => {
    if (activeSnapshot) {
      previousActiveSessionId.current = activeSnapshot.id;
      serverCompletionTaken.current = false;
      queueMicrotask(() => setRemoteEndNotice(false));
      return;
    }
    // A result from this device always wins: hide a warning that a racing event may have raised.
    if (terminalResult || completionResult) {
      previousActiveSessionId.current = null;
      queueMicrotask(() => setRemoteEndNotice(false));
      return;
    }
    if (!active.isSuccess || active.isFetching) return;
    const endedId = previousActiveSessionId.current;
    if (!endedId) return;
    previousActiveSessionId.current = null;
    // The read itself completed the expired focus: it has a result to show instead of the warning.
    if (serverCompletionTaken.current) return;
    queueMicrotask(() => setRemoteEndNotice(true));
  }, [active.isFetching, active.isSuccess, activeSnapshot, completionResult, terminalResult]);

  const observeCompletion = useCallback((intent: StudySessionCompletionIntent) => {
    const promise = intent.promise;
    if (!promise) return;
    if (observedCompletionPromise.current === promise) return;
    observedCompletionPromise.current = promise;
    void promise
      .then((result) => {
        setCompletionIntentState(intent);
        void settleTerminalResult(result);
      })
      .catch(async () => {
        setCompletionIntentState(intent);
        if (intent.status === 'waiting') {
          await refreshActive();
          setNow(Date.now());
          setCompletionIntentState(intent);
          return;
        }
        if (intent.status === 'conflict') {
          setCompletionConflictVersion({
            id: intent.request.id,
            version: intent.request.expectedVersion,
          });
          await refreshActive();
          setCompletionIntentState(intent);
        }
      })
      .finally(() => {
        if (observedCompletionPromise.current === promise) observedCompletionPromise.current = null;
      });
  }, [refreshActive, settleTerminalResult]);

  const executeCompletion = useCallback((intent: StudySessionCompletionIntent) => {
    setCompletionIntentState(intent);
    setCompletionConflictVersion(null);
    submitCompletionIntent(intent);
    observeCompletion(intent);
  }, [observeCompletion]);

  const start = useMutation({
    mutationFn: async ({ duration, key, subject, guild }: { duration: FocusChoice; key: string; subject: string | null; guild: ForgeRaid | null }) => {
      if (!guild) return startStudySession(duration, key, subject);
      // "Participar e iniciar": confirm the participation first; joining again is harmless on the server.
      if (!guild.raid.me.participating) {
        await joinRaid(guild.raid.id);
        queryClient.setQueryData<ActiveRaid | null>(
          guildKeys.raid(guild.guildId),
          (current) => (current ? { ...current, me: { ...current.me, participating: true } } : current),
        );
      }
      return startStudySession(duration, key, subject, guild.raid.id);
    },
    onSuccess(snapshot) {
      pendingKey.current = null;
      stopSessionSounds();
      setSubjectInput('');
      setSettingsOpen(false);
      setTerminalResult(null);
      clearBreak(queryClient);
      setBreakRun(null);
      clearCompletionIntent();
      setCompletionIntentState(null);
      queryClient.setQueryData(activeStudySessionQueryKey, snapshot);
      // The started Matéria is now the most recent one; a cached list would flash the old order on return.
      queryClient.removeQueries({ queryKey: recentStudySessionSubjectsQueryKey });
    },
    onError(error, { guild }) {
      // The Raid ended before the start: fall back to a solo session. Other conflicts keep the usual handling.
      if (guild && isApiError(error) && error.problemType === RAID_ENDED) {
        pendingKey.current = null;
        setSessionMode('solo');
        setRaidEndedNotice(true);
        void queryClient.invalidateQueries({ queryKey: [...guildKeys.all, 'raid'] });
      }
      void refreshActive();
    },
  });
  const dailyLimitReached = start.isError && isApiError(start.error) && start.error.problemType === DAILY_LIMIT_REACHED;
  const transition = useMutation({
    mutationFn: ({ action, ...request }: TransitionCommand) => TRANSITION_HANDLERS[action](request),
    async onSuccess(nextSnapshot, command) {
      setRetryTransition(null);
      if (command.action === 'stop') {
        stopSessionSounds();
        clearCompletionIntent();
        setCompletionIntentState(null);
        await settleTerminalResult(nextSnapshot);
        return;
      }
      syncCompletionIntentWithSnapshot(nextSnapshot);
      setCompletionIntentState(getCompletionIntentForSession(nextSnapshot.id));
      const currentSnapshot = queryClient.getQueryData<StudySessionSnapshot | null>(activeStudySessionQueryKey);
      if (!currentSnapshot || currentSnapshot.version <= nextSnapshot.version) {
        setNow(nextSnapshot.receivedAtMs);
        queryClient.setQueryData(activeStudySessionQueryKey, nextSnapshot);
      }
    },
    onError(error) {
      if (isVersionConflict(error)) {
        setRetryTransition(null);
        void refreshActive();
      }
    },
  });

  const completionPending = completionIntent?.status === 'pending';
  const completionRetryAvailable = completionIntent?.status === 'retry';
  const completionWaiting = completionIntent?.status === 'waiting';
  const snapshotId = snapshot?.id;
  const snapshotState = snapshot?.state;
  const clockOffset = snapshot ? new Date(snapshot.serverNow).getTime() - snapshot.receivedAtMs : 0;
  useEffect(() => {
    if (activeSnapshot) syncCompletionIntentWithSnapshot(activeSnapshot);
  }, [activeSnapshot]);

  useEffect(() => {
    if (!activeSnapshot || !active.isFetchedAfterMount || active.isFetching || active.isError) return;
    markCompletionIntentReadyAtSnapshot(activeSnapshot);
  }, [active.dataUpdatedAt, active.isError, active.isFetchedAfterMount, active.isFetching, activeSnapshot]);

  useEffect(() => {
    if (completionIntent?.status === 'pending' && completionIntent.promise) {
      observeCompletion(completionIntent);
    }
  }, [completionIntent, activeSnapshot, observeCompletion]);

  useEffect(() => {
    const returnedToForeground = applicationActive && !wasApplicationActive.current;
    wasApplicationActive.current = applicationActive;
    if (!returnedToForeground) return;

    requiresForegroundRefresh.current = true;
    setForegroundSyncPending(true);
    let mounted = true;
    void refreshActive().finally(() => {
      if (mounted) {
        setNow(Date.now());
        requiresForegroundRefresh.current = false;
        setForegroundSyncPending(false);
      }
    });
    return () => { mounted = false; };
  }, [applicationActive, refreshActive]);

  useEffect(() => {
    if (snapshotState !== 'running' || !applicationActive) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [snapshotId, snapshotState, applicationActive]);

  useEffect(() => {
    if (!breakRun || !applicationActive) return;
    const interval = setInterval(() => {
      const at = Date.now();
      setBreakNow(at);
      if (breakRemainingSeconds(breakRun, at) === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [breakRun, applicationActive]);

  const freeSnapshot = snapshot !== null && isFreeFocus(snapshot);
  // A Foco livre reports no remaining time; what is left is the time to the antifraude ceiling, which is when it concludes.
  const effectiveNow = snapshot && now === 0 ? snapshot.receivedAtMs : now;
  const projectedRemaining = snapshot
    ? now === 0 && !freeSnapshot ? snapshot.remainingSeconds : remainingStudySeconds(snapshot, effectiveNow, clockOffset)
    : plannedSeconds(selected);
  const elapsed = snapshot ? elapsedStudySeconds(snapshot, effectiveNow, clockOffset) : 0;
  const remaining = completionPending || completionRetryAvailable || (completionWaiting && !activeSnapshot)
    ? 0
    : projectedRemaining;
  const plannedDuration = snapshot ? snapshot.plannedDurationSeconds ?? 0 : plannedSeconds(selected);
  const plannedLabel = freeSnapshot ? 'Livre' : `${plannedDuration / 60} min`;
  const phase = snapshot?.state === 'paused'
    ? 'PAUSADA'
    : freeSnapshot
      ? 'FOCO LIVRE'
    : snapshot
      ? remaining > plannedDuration * 0.5 ? 'AQUECIMENTO' : remaining > plannedDuration * 0.15 ? 'FOCO PROFUNDO' : 'FORJA FINAL'
      : 'PRONTA PARA COMEÇAR';

  useEffect(() => {
    if (
      !activeSnapshot
      || activeSnapshot.state !== 'running'
      || !applicationActive
      || active.isFetching
      || foregroundSyncPending
      || requiresForegroundRefresh.current
      || projectedRemaining > 0
      || (completionConflictVersion?.id === activeSnapshot.id
        && completionConflictVersion.version === activeSnapshot.version)
    ) return;

    const intent = getOrCreateCompletionIntent(activeSnapshot);
    if (intent.status === 'ready'
      || (completionIntentCanRetryAt(intent, activeSnapshot) && projectedRemaining <= 0)
      || (intent.status === 'pending' && intent.promise)) {
      queueMicrotask(() => executeCompletion(intent));
    }
  }, [
    activeSnapshot,
    active.isFetching,
    applicationActive,
    completionConflictVersion,
    foregroundSyncPending,
    projectedRemaining,
    executeCompletion,
  ]);

  const pendingAction = transition.variables?.action;
  const validFocusSeconds = freeSnapshot
    ? elapsed
    : snapshot?.state === 'running'
      ? Math.max(snapshot.durationValidSeconds, plannedDuration - remaining)
      : snapshot?.durationValidSeconds ?? 0;
  const stopKind = stopKindFor(validFocusSeconds, snapshot?.kind);
  const stopLabel = STOP_COPY[stopKind].label;
  const pendingNonStopAction = pendingAction && pendingAction !== 'stop' ? pendingAction : null;
  const retryAvailable = Boolean(retryTransition && transition.isError && !transition.isPending);
  const versionConflict = isVersionConflict(transition.error);
  const completionStateConflict = completionIntent?.status === 'conflict'
    || Boolean(completionConflictVersion
      && snapshot?.id === completionConflictVersion.id
      && snapshot.version === completionConflictVersion.version);
  const completionOwnsControls = completionPending
    || completionRetryAvailable
    || completionStateConflict
    || (completionWaiting && (!activeSnapshot || active.isFetching || projectedRemaining <= 0));
  const needsCanonicalRefresh = versionConflict && (
    !snapshot || snapshot.version <= (transition.variables?.expectedVersion ?? 0)
  );
  const refreshingCanonicalSnapshot = needsCanonicalRefresh && active.isFetching;
  const sessionStatus = completionPending
    ? 'Confirmando conclusão…'
    : completionWaiting
      ? 'Sincronizando o prazo para confirmar a conclusão.'
      : completionRetryAvailable
        ? 'A conclusão ainda não foi confirmada. Tente novamente com segurança.'
        : transition.isPending
          ? `${pendingAction ? TRANSITION_COPY[pendingAction].status : 'Atualizando sessão.'} Os controles estão ocupados até a confirmação.`
    : refreshingCanonicalSnapshot
      ? 'A sessão mudou. Atualizando o estado canônico.'
      : needsCanonicalRefresh
        ? 'A sessão mudou. Atualize o estado antes de continuar.'
        : snapshot?.state === 'paused'
      ? freeSnapshot ? 'Foco livre pausado. O cronômetro está parado.' : 'Sessão pausada. O contador está congelado.'
      : freeSnapshot
        ? 'Foco livre em andamento. O cronômetro está contando.'
        : 'Sessão em andamento. O contador está ativo.';
  useEffect(() => {
    if (!snapshot || announcedStatus.current === sessionStatus) return;
    announcedStatus.current = sessionStatus;
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(sessionStatus, { queue: true });
    }
  }, [sessionStatus, snapshot]);

  const subjectValidation = validateSubject(subjectInput);
  const subjectMessage = subjectError(subjectValidation);

  const changeSubject = (text: string) => {
    const next = validateSubject(text);
    // A retry keeps its key only while the request stays identical; another Matéria is a new start.
    if (JSON.stringify(next) !== JSON.stringify(subjectValidation)) pendingKey.current = null;
    setSubjectInput(text);
  };

  const guildSession = sessionMode === 'guild' ? forgeRaid : null;
  const startLabel = guildSession && !guildSession.raid.me.participating ? 'Participar e iniciar' : 'Iniciar foco';

  const changeSessionMode = (mode: SessionMode) => {
    // Another mode is another start request, so it needs a new key.
    if (mode !== sessionMode) pendingKey.current = null;
    setRaidEndedNotice(false);
    setSessionMode(mode);
  };

  const begin = () => {
    if (subjectValidation.status !== 'valid') return;
    const key = pendingKey.current ?? newIdempotencyKey();
    pendingKey.current = key;
    setRaidEndedNotice(false);
    unlockSessionSounds();
    start.mutate({ duration: selected, key, subject: subjectValidation.subject, guild: guildSession });
  };

  const changeSessionState = (action: TransitionAction) => {
    if (!snapshot || transition.isPending || retryAvailable || refreshingCanonicalSnapshot) return;
    const command = retryTransition?.id === snapshot.id && retryTransition.action === action
      ? retryTransition
      : { id: snapshot.id, action, expectedVersion: snapshot.version, idempotencyKey: newIdempotencyKey() };
    setRetryTransition(command);
    transition.mutate(command);
  };

  const requestStop = () => {
    if (!confirmBeforeStopping || !snapshot) return changeSessionState('stop');
    setStopDialog({ sessionId: snapshot.id, kind: stopKind });
  };

  const confirmStop = () => {
    setStopDialog(null);
    changeSessionState('stop');
  };

  const retryLastTransition = () => {
    if (retryTransition) transition.mutate(retryTransition);
  };

  const startNewSession = () => {
    stopSessionSounds();
    pendingKey.current = null;
    clearBreak(queryClient);
    setBreakRun(null);
    clearCompletionIntent();
    setCompletionIntentState(null);
    setTerminalResult(null);
  };

  const beginBreak = (kind: BreakKind) => {
    stopSessionSounds();
    const at = Date.now();
    setBreakNow(at);
    setBreakRun(startBreak(queryClient, kind, at));
  };

  // A break is offered only after a focus completed in full; early stops and discards skip it.
  const nextBreak: BreakKind = focusCycle.data?.nextBreak ?? 'short';

  // #17: where the session stands against the server. Offline, TanStack Query pauses the requests and resumes
  // them, with a refetch of the active session, when the network comes back.
  const syncStatus = forgeSyncStatus({
    online,
    syncing: foregroundSyncPending || (active.isFetching && !active.isPending) || transition.isPending || start.isPending || completionPending,
    failed: (active.isError && snapshot !== null) || (transition.isError && !transition.isPending) || completionRetryAvailable,

  });
  const showSync = activeSnapshot != null || completionPending || completionRetryAvailable;

  const sessionControl: ForgeSessionControl = completionRetryAvailable && completionIntent
    ? { kind: 'retry-completion', onRetry: () => executeCompletion(completionIntent) }
    : completionWaiting && (!activeSnapshot || active.isError) && !active.isFetching
      ? { kind: 'refresh-waiting', onRefresh: () => void refreshActive() }
      : completionStateConflict
        ? { kind: 'refresh-conflict', fetching: active.isFetching, onRefresh: () => void refreshActive() }
        : retryAvailable && retryTransition
          ? { kind: 'retry-transition', label: `Tentar ${TRANSITION_COPY[retryTransition.action].action} novamente`, onRetry: retryLastTransition }
          : !completionOwnsControls && snapshot
            ? {
              kind: 'controls',
              stop: {
                label: transition.isPending && pendingAction === 'stop' ? TRANSITION_COPY.stop.button : stopLabel,
                loading: transition.isPending && pendingAction === 'stop',
                disabled: transition.isPending || refreshingCanonicalSnapshot || completionPending,
                onPress: requestStop,
              },
              main: {
                icon: snapshot.state === 'paused' ? 'play' : 'pause',
                label: transition.isPending && pendingNonStopAction
                  ? TRANSITION_COPY[pendingNonStopAction].button
                  : needsCanonicalRefresh
                    ? refreshingCanonicalSnapshot ? 'Atualizando estado…' : 'Atualizar estado'
                    : snapshot.state === 'paused' ? 'Retomar sessão' : 'Pausar sessão',
                loading: (transition.isPending && pendingAction !== 'stop') || refreshingCanonicalSnapshot,
                disabled: transition.isPending || refreshingCanonicalSnapshot || completionPending,
                onPress: () => needsCanonicalRefresh
                  ? void refreshActive()
                  : changeSessionState(snapshot.state === 'paused' ? 'resume' : 'pause'),
                testID: snapshot.state === 'paused' ? 'study-session-resume' : 'study-session-pause',
              },
            }
            : { kind: 'none' };

  const selectDuration = (duration: FocusChoice) => {
    pendingKey.current = null;
    setSelected(duration);
  };

  const showSetup = !displayedTerminalResult && !breakRun && !active.isPending && !active.isError && !snapshot;
  const startDisabled = subjectValidation.status !== 'valid' || waitingForDefault;
  const prepCard = (
    <ForgePrepCard
      compact={compactLayout}
      selected={selected}
      startPending={start.isPending}
      startLabel={startLabel}
      startDisabled={startDisabled}
      subjectInput={subjectInput}
      subjectMessage={subjectMessage}
      selectedSubject={subjectValidation.status === 'valid' ? subjectValidation.subject : null}
      forgeRaid={forgeRaid}
      sessionMode={sessionMode}
      raidEndedNotice={raidEndedNotice}
      dailyLimitReached={dailyLimitReached}
      startFailed={start.isError}
      onChangeSubject={changeSubject}
      onChangeMode={changeSessionMode}
      onSelectDuration={selectDuration}
      onStart={begin}
    />
  );
  const startFooter = showSetup && compactLayout
    ? <View style={styles.footerBar}><ForgeStartButton disabled={startDisabled} label={startLabel} loading={start.isPending} onPress={begin} /></View>
    : undefined;

  return (
    <Screen avoidKeyboard footer={startFooter} backgroundOverlay={<ForgePageGradient />} hasBottomNavigation safeAreaEdges={['right', 'left']} testID="study-session" title="Forja" titleHidden contentContainerStyle={styles.screenContent}>
      <View style={styles.layout}>
        <ForgeHeader compact={compactLayout} />
        {showSync ? <ForgeSyncIndicator onRetry={() => void refreshActive()} status={syncStatus} /> : null}
        {remoteEndNotice ? (
          <WiseText accessibilityLiveRegion="polite" aria-live="polite" color="textSecondary" testID="study-session-remote-end" variant="body">
            Sessão encerrada em outro dispositivo
          </WiseText>
        ) : null}
        {active.isPending && !snapshot ? <WiseText variant="body">Buscando sua sessão ativa…</WiseText> : null}
        {active.isError && !snapshot ? (
          <WiseCard style={styles.messageCard} testID="study-session-load-error">
            <WiseText variant="body">Não foi possível consultar sua sessão. Verifique a conexão.</WiseText>
            <WiseButton label="Tentar novamente" onPress={() => void refreshActive()} variant="secondary" />
          </WiseCard>
        ) : null}
        {breakRun && !activeSnapshot ? (
          <BreakStage
            onFinish={startNewSession}
            onSkip={startNewSession}
            remaining={breakRemainingSeconds(breakRun, breakNow)}
            ringSize={ringSize}
            run={breakRun}
          />
        ) : null}
        {displayedTerminalResult && !breakRun ? (
          <WiseCard style={styles.messageCard} testID="study-session-result">
            <WiseText accessibilityLiveRegion="polite" aria-live="polite" variant="subtitle">
              {displayedTerminalResult.state === 'discarded'
                ? 'Sessão não contabilizada'
                : displayedTerminalResult.state === 'completed'
                  ? 'Sessão concluída'
                  : displayedTerminalResult.state === 'cancelled'
                    ? 'Sessão cancelada'
                    : displayedTerminalResult.state === 'stopped_early'
                      ? 'Sessão encerrada antecipadamente'
                      : 'Sessão encerrada'}
            </WiseText>
            <WiseText
              color={displayedTerminalResult.subject ? 'textPrimary' : 'textTertiary'}
              numberOfLines={3}
              testID="study-session-result-subject"
              variant="body"
            >
              {displayedTerminalResult.subject ?? NO_SUBJECT_LABEL}
            </WiseText>
            <WiseText variant="body">Foco válido: {formatRemainingTime(displayedTerminalResult.durationValidSeconds)}</WiseText>
            <WiseText variant="body">XP confirmado: {displayedTerminalResult.xpAwarded}</WiseText>
            {displayedTerminalResult.raidContribution ? (
              <WiseText accessibilityLiveRegion="polite" aria-live="polite" color={displayedTerminalResult.raidContribution.status === 'counted' ? 'textPrimary' : 'textSecondary'} variant="body" testID="study-session-result-raid-contribution">
                {displayedTerminalResult.raidContribution.status === 'counted'
                  ? `+${displayedTerminalResult.raidContribution.xpContributed} XP para a Raid da Guilda.`
                  : displayedTerminalResult.raidContribution.status === 'outside-raid-window'
                    ? 'Esta sessão não contou para a Raid: terminou fora da janela da Raid.'
                    : 'Esta sessão não contou para a Raid: não houve XP validado.'}
              </WiseText>
            ) : null}
            {displayedTerminalResult.state === 'discarded' ? (
              <WiseText color="textSecondary" variant="body">
                {displayedTerminalResult.discardedReason === 'continuous-session-exceeds-limit'
                  ? 'A duração ultrapassou o limite de foco permitido.'
                  : 'O limite diário de foco foi atingido.'}
              </WiseText>
            ) : null}
            {displayedTerminalResult.state === 'completed' && !isFreeFocus(displayedTerminalResult) && cycleFresh && !focusCycle.isFetching ? (
              <BreakOffer kind={nextBreak} completedInCycle={focusCycle.data?.completedInCycle ?? null} onStart={beginBreak} />
            ) : null}
            {displayedTerminalResult.cappedReason ? (
              <WiseText color="textSecondary" testID="study-session-result-capped" variant="body">
                {displayedTerminalResult.cappedReason === 'daily-limit'
                  ? 'XP limitado pelo teto diário.'
                  : 'XP limitado ao máximo de sessão contínua.'}
              </WiseText>
            ) : null}
            <WiseButton
              label="Nova sessão"
              onPress={startNewSession}
              size="large"
              testID="study-session-new"
              variant={displayedTerminalResult.state === 'completed' ? 'secondary' : 'primary'}
            />
          </WiseCard>
        ) : null}
        {snapshot && !displayedTerminalResult ? (
          <ForgeColumns
            wide={wideLayout}
            testID="study-session-active"
            anvil={
              <ForgeAnvil
                wide={wideLayout}
                header={<>
                  <Text
                    accessibilityRole="header"
                    allowFontScaling
                    numberOfLines={2}
                    style={snapshot.subject ? styles.subjectTitle : styles.subjectTitleEmpty}
                    testID="study-session-subject"
                  >
                    {snapshot.subject ?? NO_SUBJECT_LABEL}
                  </Text>
                  <Text accessibilityRole="header" allowFontScaling style={styles.stageTitle}>{snapshot.state === 'paused' ? 'Sessão pausada' : 'Sessão em andamento'}</Text>
                  <Text allowFontScaling style={styles.stageMeta}>
                    {freeSnapshot ? 'Foco livre' : `${plannedLabel} de foco`}{snapshot.mode === 'guild' ? ' · Sessão de guilda' : ''}
                  </Text>
                </>}
                reading={freeSnapshot ? { elapsed } : { remaining, duration: plannedDuration }}
                phase={phase}
                ringSize={ringSize}
                timerTestID="study-session-timer"
                timerAccessibilityLabel={freeSnapshot
                  ? `Tempo de foco: ${Math.floor(elapsed / 3600)} horas, ${Math.floor((elapsed % 3600) / 60)} minutos e ${elapsed % 60} segundos. Foco livre ${snapshot.state === 'paused' ? 'pausado' : 'em andamento'}.`
                  : `Tempo restante: ${Math.floor(remaining / 60)} minutos e ${remaining % 60} segundos. Sessão ${snapshot.state === 'paused' ? 'pausada' : 'em andamento'}.`}
              >
                <ForgeSessionCard
                  wide={wideLayout}
                  plannedLabel={plannedLabel}
                  settingsOpen={settingsOpen}
                  control={sessionControl}
                  stopConfirmation={stopDialog?.sessionId === snapshot.id ? { kind: stopDialog.kind, onConfirm: confirmStop, onDecline: () => setStopDialog(null) } : null}
                  transitionError={transition.isError ? { versionConflict, needsCanonicalRefresh, refreshFailed: active.isError && !active.isFetching } : null}
                  completionError={completionRetryAvailable}
                  completionConflict={completionStateConflict ? { fetching: active.isFetching } : null}
                  sessionStatus={sessionStatus}
                  onToggleSettings={() => setSettingsOpen((open) => !open)}
                  onCloseSettings={() => setSettingsOpen(false)}
                />
              </ForgeAnvil>
            }
            support={<ForgeActiveSupport wide={wideLayout} settingsOpen={settingsOpen} plannedLabel={plannedLabel} validFocusSeconds={validFocusSeconds} pauseCount={snapshot.pauseCount} onCloseSettings={() => setSettingsOpen(false)} />}
          />
        ) : null}
        {showSetup ? (
          <ForgeColumns
            wide={wideLayout}
            testID="study-session-setup"
            anvil={
              <ForgeAnvil
                wide={wideLayout}
                reading={selected === FREE_FOCUS ? { elapsed: 0 } : { remaining: selected, duration: selected }}
                elapsedCaption="conta até você parar"
                phase={phase}
                ringSize={ringSize}
              >
                <ForgeReadyHero compact={compactLayout} />
                {compactLayout ? prepCard : <ForgeReadySummary selected={selected} />}
              </ForgeAnvil>
            }
            support={<>
              {compactLayout ? null : prepCard}
              <ForgeRulesCard />
              <ForgeTodayCard />
            </>}
          />
        ) : null}
        <ForgeHistory showToday={!showSetup} wide={wideLayout} />
      </View>
    </Screen>
  );
}
