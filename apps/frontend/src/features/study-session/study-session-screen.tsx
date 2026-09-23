import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Screen, WiseButton, WiseCard, WiseText, theme } from '@/design-system';
import { controlStyles } from '@/design-system/components/control-styles';
import {
  pauseStudySession,
  resumeStudySession,
  startStudySession,
  stopStudySession,
  STUDY_SESSION_PRESETS,
  type PlannedDurationSeconds,
  type StudySessionSnapshot,
  type StudySessionTransitionAction,
  type StudySessionTransitionRequest,
} from './api';
import { activeStudySessionQueryKey, useActiveStudySession } from './queries';
import { formatRemainingTime, remainingStudySeconds } from './timer';
import { FeedbackMessage } from '@/design-system/components/FeedbackMessage';
import { dashboardKeys } from '@/features/dashboard/queries';
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
  type StudySessionCompletionIntent,
} from './completion-intent';
import { useStudySessionAppActive } from './use-study-session-app-active';

type TransitionAction = Exclude<StudySessionTransitionAction, 'complete'>;
type TransitionCommand = StudySessionTransitionRequest & { action: TransitionAction };

const TRANSITION_HANDLERS: Record<TransitionAction, (command: StudySessionTransitionRequest) => Promise<StudySessionSnapshot>> = {
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

function isVersionConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const responseData = (error as { response?: { data?: unknown } }).response?.data;
  return typeof responseData === 'object'
    && responseData !== null
    && (responseData as { type?: unknown }).type === STUDY_SESSION_VERSION_CONFLICT;
}

export function StudySessionScreen() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PlannedDurationSeconds>(1500);
  const [focusedDuration, setFocusedDuration] = useState<PlannedDurationSeconds | null>(null);
  const [now, setNow] = useState(0);
  const [retryTransition, setRetryTransition] = useState<TransitionCommand | null>(null);
  const [terminalResult, setTerminalResult] = useState<StudySessionSnapshot | null>(null);
  const [completionIntentState, setCompletionIntentState] = useState<StudySessionCompletionIntent | null>(
    () => getRetainedCompletionIntent(),
  );
  const [completionConflictVersion, setCompletionConflictVersion] = useState<{ id: string; version: number } | null>(null);
  const [foregroundSyncPending, setForegroundSyncPending] = useState(false);
  const pendingKey = useRef<string | null>(null);
  const announcedStatus = useRef<string | null>(null);
  const observedCompletionPromise = useRef<Promise<StudySessionSnapshot> | null>(null);
  const requiresForegroundRefresh = useRef(false);
  const applicationActive = useStudySessionAppActive();
  const wasApplicationActive = useRef(applicationActive);
  const active = useActiveStudySession();
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

  const settleTerminalResult = useCallback(async (result: StudySessionSnapshot) => {
    setTerminalResult(result);
    await queryClient.cancelQueries({ queryKey: activeStudySessionQueryKey });
    queryClient.setQueryData(activeStudySessionQueryKey, null);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.profile() }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.recentActivity() }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.metrics() }),
    ]);
  }, [queryClient]);

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
    mutationFn: ({ duration, key }: { duration: PlannedDurationSeconds; key: string }) => startStudySession(duration, key),
    onSuccess(snapshot) {
      pendingKey.current = null;
      setTerminalResult(null);
      clearCompletionIntent();
      setCompletionIntentState(null);
      queryClient.setQueryData(activeStudySessionQueryKey, snapshot);
    },
    onError() {
      void refreshActive();
    },
  });
  const transition = useMutation({
    mutationFn: ({ action, ...request }: TransitionCommand) => TRANSITION_HANDLERS[action](request),
    async onSuccess(nextSnapshot, command) {
      setRetryTransition(null);
      if (command.action === 'stop') {
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

  const projectedRemaining = snapshot
    ? now === 0 ? snapshot.remainingSeconds : remainingStudySeconds(snapshot, now, clockOffset)
    : selected;
  const remaining = completionPending || completionRetryAvailable || (completionWaiting && !activeSnapshot)
    ? 0
    : projectedRemaining;

  useEffect(() => {
    if (
      !activeSnapshot
      || !activeSnapshot.canControl
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
  const validFocusSeconds = snapshot?.state === 'running'
    ? Math.max(snapshot.durationValidSeconds, snapshot.plannedDurationSeconds - remaining)
    : snapshot?.durationValidSeconds ?? 0;
  const stopLabel = validFocusSeconds < 300 ? 'Cancelar sessão' : 'Encerrar antecipadamente';
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
      ? 'Sessão pausada. O contador está congelado.'
      : 'Sessão em andamento. O contador está ativo.';
  useEffect(() => {
    if (!snapshot?.canControl || announcedStatus.current === sessionStatus) return;
    announcedStatus.current = sessionStatus;
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(sessionStatus, { queue: true });
    }
  }, [sessionStatus, snapshot?.canControl]);

  const begin = () => {
    const key = pendingKey.current ?? newIdempotencyKey();
    pendingKey.current = key;
    start.mutate({ duration: selected, key });
  };

  const changeSessionState = (action: TransitionAction) => {
    if (!snapshot?.canControl || transition.isPending || retryAvailable || refreshingCanonicalSnapshot) return;
    const command = retryTransition?.id === snapshot.id && retryTransition.action === action
      ? retryTransition
      : { id: snapshot.id, action, expectedVersion: snapshot.version, idempotencyKey: newIdempotencyKey() };
    setRetryTransition(command);
    transition.mutate(command);
  };

  const retryLastTransition = () => {
    if (retryTransition) transition.mutate(retryTransition);
  };

  return (
    <Screen hasBottomNavigation testID="study-session" title="Forja">
      <View style={styles.layout}>
        <WiseText color="textSecondary" variant="body">Escolha seu tempo de foco.</WiseText>
        {active.isPending && !snapshot ? <WiseText variant="body">Buscando sua sessão ativa…</WiseText> : null}
        {active.isError && !snapshot ? (
          <WiseCard testID="study-session-load-error">
            <WiseText variant="body">Não foi possível consultar sua sessão. Verifique a conexão.</WiseText>
            <WiseButton label="Tentar novamente" onPress={() => void refreshActive()} variant="secondary" />
          </WiseCard>
        ) : null}
        {snapshot && !snapshot.canControl ? (
          <WiseCard testID="study-session-remote-conflict">
            <WiseText variant="subtitle">Foco em outro dispositivo</WiseText>
            <WiseText variant="body">Já existe uma sessão ativa nesta conta. Volte ao dispositivo que a iniciou para acompanhá-la.</WiseText>
            <WiseButton label="Atualizar estado" onPress={() => void refreshActive()} variant="secondary" />
          </WiseCard>
        ) : null}
        {displayedTerminalResult ? (
          <WiseCard testID="study-session-result">
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
            <WiseText variant="body">Foco válido: {formatRemainingTime(displayedTerminalResult.durationValidSeconds)}</WiseText>
            <WiseText variant="body">XP confirmado: {displayedTerminalResult.xpAwarded}</WiseText>
            {displayedTerminalResult.state === 'discarded' ? (
              <WiseText color="textSecondary" variant="body">
                {displayedTerminalResult.discardedReason === 'continuous-session-exceeds-limit'
                  ? 'A duração ultrapassou o limite de foco permitido.'
                  : 'O limite diário de foco foi atingido.'}
              </WiseText>
            ) : null}
            <WiseButton
              label="Nova sessão"
              onPress={() => {
                pendingKey.current = null;
                clearCompletionIntent();
                setCompletionIntentState(null);
                setTerminalResult(null);
              }}
              size="large"
              testID="study-session-new"
            />
          </WiseCard>
        ) : null}
        {snapshot?.canControl && !displayedTerminalResult ? (
          <WiseCard testID="study-session-active">
            <WiseText variant="subtitle">{snapshot.state === 'paused' ? 'Sessão pausada' : 'Sessão em andamento'}</WiseText>
            <WiseText accessibilityLiveRegion="none" aria-live="off" accessibilityLabel={`Tempo restante: ${Math.floor(remaining / 60)} minutos e ${remaining % 60} segundos. Sessão ${snapshot.state === 'paused' ? 'pausada' : 'em andamento'}.`} style={styles.timer} testID="study-session-timer" variant="display">{formatRemainingTime(remaining)}</WiseText>
            <WiseText color="textSecondary" variant="body">Foco de {snapshot.plannedDurationSeconds / 60} minutos iniciado. Seu tempo é confirmado pelo servidor.</WiseText>
            <WiseText accessibilityLiveRegion="polite" aria-live="polite" testID="study-session-state" variant="body">{sessionStatus}</WiseText>
            {completionRetryAvailable && completionIntent ? (
              <WiseButton
                label="Tentar confirmar novamente"
                onPress={() => executeCompletion(completionIntent)}
                variant="secondary"
                testID="study-session-completion-retry"
              />
            ) : completionWaiting && (!activeSnapshot || active.isError) && !active.isFetching ? (
              <WiseButton
                label="Atualizar estado"
                onPress={() => void refreshActive()}
                variant="secondary"
                testID="study-session-completion-refresh"
              />
            ) : completionStateConflict ? (
              <WiseButton
                label={active.isFetching ? 'Atualizando estado…' : 'Atualizar estado'}
                loading={active.isFetching}
                disabled={active.isFetching}
                onPress={() => void refreshActive()}
                variant="secondary"
                testID="study-session-completion-refresh"
              />
            ) : retryAvailable && retryTransition ? (
              <WiseButton
                label={`Tentar ${TRANSITION_COPY[retryTransition.action].action} novamente`}
                onPress={retryLastTransition}
                variant="secondary"
                testID="study-session-transition-retry"
              />
            ) : !completionOwnsControls ? (
              <View style={styles.controls}>
                <WiseButton
                  label={transition.isPending && pendingNonStopAction
                    ? TRANSITION_COPY[pendingNonStopAction].button
                      : needsCanonicalRefresh
                        ? refreshingCanonicalSnapshot ? 'Atualizando estado…' : 'Atualizar estado'
                        : snapshot.state === 'paused' ? 'Retomar sessão' : 'Pausar sessão'}
                  loading={(transition.isPending && pendingAction !== 'stop') || refreshingCanonicalSnapshot}
                  disabled={transition.isPending || refreshingCanonicalSnapshot || completionPending}
                  onPress={() => needsCanonicalRefresh
                    ? void refreshActive()
                    : changeSessionState(snapshot.state === 'paused' ? 'resume' : 'pause')}
                  testID={snapshot.state === 'paused' ? 'study-session-resume' : 'study-session-pause'}
                />
                <WiseButton
                  label={transition.isPending && pendingAction === 'stop' ? TRANSITION_COPY.stop.button : stopLabel}
                  loading={transition.isPending && pendingAction === 'stop'}
                  disabled={transition.isPending || refreshingCanonicalSnapshot || completionPending}
                  onPress={() => changeSessionState('stop')}
                  variant="secondary"
                  testID="study-session-stop"
                />
              </View>
            ) : null}
            {transition.isError ? (
              <FeedbackMessage
                variant="error"
                title={versionConflict ? 'A sessão mudou desde a última confirmação.' : 'Não foi possível confirmar a ação'}
                message={versionConflict
                  ? needsCanonicalRefresh
                    ? active.isError && !active.isFetching
                      ? 'Não foi possível atualizar o estado. O último snapshot confirmado continua visível; atualize antes de enviar outra ação.'
                      : 'Atualizando o snapshot confirmado para liberar um novo comando seguro.'
                    : 'O estado atual foi carregado. Confira a sessão e envie uma nova ação.'
                  : 'A sessão continua no último estado confirmado. Tente novamente para repetir o mesmo comando com segurança.'}
                testID="study-session-transition-error"
              />
            ) : null}
            {completionRetryAvailable ? (
              <FeedbackMessage
                variant="error"
                title="Não foi possível confirmar a conclusão."
                message="O último snapshot continua visível. Tente novamente para recuperar o resultado usando a mesma confirmação."
                testID="study-session-completion-error"
              />
            ) : null}
            {completionStateConflict ? (
              <FeedbackMessage
                variant="error"
                title="A sessão mudou antes da conclusão."
                message={active.isFetching
                  ? 'Atualizando o snapshot canônico da sessão.'
                  : 'Atualize o estado para continuar com a versão confirmada pelo servidor.'}
                testID="study-session-completion-conflict"
              />
            ) : null}
          </WiseCard>
        ) : null}
        {!displayedTerminalResult && !active.isPending && !active.isError && !snapshot ? (
          <WiseCard testID="study-session-setup">
            <WiseText variant="subtitle">Quanto tempo você vai focar?</WiseText>
            <View style={styles.presets}>
              {STUDY_SESSION_PRESETS.map((duration) => (
                <Pressable
                  accessibilityLabel={`${duration / 60} minutos`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected === duration, disabled: start.isPending }}
                  disabled={start.isPending}
                  key={duration}
                  onPress={() => { pendingKey.current = null; setSelected(duration); }}
                  onFocus={() => setFocusedDuration(duration)}
                  onBlur={() => setFocusedDuration((focused) => focused === duration ? null : focused)}
                  style={[
                    styles.preset,
                    selected === duration && styles.selected,
                    focusedDuration === duration && Platform.OS === 'web' && controlStyles.webFocus,
                  ]}
                  testID={`study-duration-${duration / 60}`}
                >
                  <WiseText variant="label">{duration / 60} min</WiseText>
                </Pressable>
              ))}
            </View>
            <WiseText color="textSecondary" variant="body">Duração escolhida: {selected / 60} minutos</WiseText>
            <WiseButton label="Iniciar foco" loading={start.isPending} onPress={begin} size="large" testID="study-session-start" />
            {start.isError ? <WiseText color="feedbackDanger" variant="body">Não foi possível confirmar o início. Tente novamente.</WiseText> : null}
          </WiseCard>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: { width: '100%', maxWidth: 580, alignSelf: 'center', gap: theme.space.sectionGap },
  controls: { gap: theme.space.stackDefault },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.stackTight, marginVertical: theme.space.sectionGap },
  preset: { minWidth: theme.layout.touchTarget, minHeight: theme.layout.touchTarget, paddingHorizontal: theme.space.cardInset, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.color.borderEmphasis, borderRadius: theme.radius.control },
  selected: { backgroundColor: theme.color.surfaceCardActive, borderColor: theme.color.accentPrimary },
  timer: { textAlign: 'center', marginVertical: theme.space.sectionGap },
});
