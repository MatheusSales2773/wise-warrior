import { useMutation, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
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

function ForgePageGradient() {
  return (
    <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill} testID="study-session-page-gradient" width="100%" height="100%">
      <Defs>
        <RadialGradient id="forgePageGlow" cx="50%" cy="0%" r="90%">
          <Stop offset="0" stopColor={theme.color.backgroundOverlay} />
          <Stop offset="0.5" stopColor={theme.color.backgroundRaised} />
          <Stop offset="1" stopColor={theme.color.backgroundCanvas} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#forgePageGlow)" />
    </Svg>
  );
}

function ForgeStageGradient() {
  return (
    <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill} testID="study-session-stage-gradient" width="100%" height="100%">
      <Defs>
        <RadialGradient id="forgeStageGlow" cx="50%" cy="45%" r="65%">
          <Stop offset="0" stopColor={theme.color.accentPrimary} stopOpacity="0.26" />
          <Stop offset="0.55" stopColor={theme.color.accentPrimary} stopOpacity="0.07" />
          <Stop offset="1" stopColor={theme.color.accentPrimary} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#forgeStageGlow)" />
    </Svg>
  );
}

function ForgeAction({ label, icon, onPress, primary = false, disabled = false, loading = false, testID, iconOnly = false, expanded }: {
  label: string;
  icon: 'stop' | 'pause' | 'play' | 'settings-outline';
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  iconOnly?: boolean;
  expanded?: boolean;
}) {
  const { width } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const blocked = disabled || loading;
  const content = <>
    <Ionicons accessibilityElementsHidden importantForAccessibility="no" name={icon} size={16} color={primary ? theme.color.backgroundCanvas : theme.color.textPrimary} />
    {!iconOnly ? <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>{label}</Text> : null}
  </>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading, expanded }}
      disabled={blocked}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.actionButton, primary ? styles.actionButtonPrimary : styles.actionButtonIcon, primary && width < 450 && styles.actionButtonPrimaryCompact, iconOnly && styles.actionButtonIcon, blocked && styles.actionButtonDisabled, focused && Platform.OS === 'web' && controlStyles.webFocus]}
      testID={testID}
    >
      {primary ? <LinearGradient colors={[theme.color.accentPrimary, theme.color.accentMuted]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.actionGradient} testID="study-session-primary-gradient">{content}</LinearGradient> : content}
    </Pressable>
  );
}

function ForgeTimer({ remaining, duration, phase, size, testID, accessibilityLabel }: {
  remaining: number;
  duration: number;
  phase: string;
  size: number;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const radius = 154;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, (duration - remaining) / duration));

  return (
    <View style={[styles.timerRingWrap, { width: size, height: size }]}>
      <Svg aria-hidden width={size} height={size} viewBox="0 0 340 340" style={styles.timerRing}>
        <Defs>
          <SvgGradient id="forgeRingGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.color.accentHighlight} />
            <Stop offset="1" stopColor={theme.color.accentPrimary} />
          </SvgGradient>
        </Defs>
        <Circle cx="170" cy="170" r={radius} fill="none" stroke={theme.color.borderSoft} strokeWidth="2" />
        <Circle cx="170" cy="170" r={radius} fill="none" stroke="url(#forgeRingGradient)" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
      </Svg>
      <View style={styles.timerCenter}>
        <WiseText color="accentPrimary" variant="caption">◈ {phase} ◈</WiseText>
        <Text accessibilityLiveRegion="none" aria-live="off" accessibilityLabel={accessibilityLabel} style={[styles.timerDigits, { fontSize: size < 290 ? 54 : 72 }]} testID={testID}>{formatRemainingTime(remaining)}</Text>
        <WiseText color="textTertiary" variant="mono">/ {formatRemainingTime(duration)}</WiseText>
      </View>
    </View>
  );
}

function DurationSettings({ selected, focusedDuration, startPending, onSelect, onFocus, onClose, inline = false }: {
  selected: PlannedDurationSeconds;
  focusedDuration: PlannedDurationSeconds | null;
  startPending: boolean;
  onSelect: (duration: PlannedDurationSeconds) => void;
  onFocus: (duration: PlannedDurationSeconds | null) => void;
  onClose: () => void;
  inline?: boolean;
}) {
  return <WiseCard style={inline ? styles.inlineSettingsCard : styles.sideCard}>
    <WiseText variant="subtitle">◈ Quanto tempo você vai focar?</WiseText>
    <View style={styles.presets} accessibilityRole="radiogroup">
      {STUDY_SESSION_PRESETS.map((duration) => (
        <Pressable
          accessibilityLabel={`${duration / 60} minutos`}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === duration, disabled: startPending }}
          disabled={startPending}
          key={duration}
          onPress={() => onSelect(duration)}
          onFocus={() => onFocus(duration)}
          onBlur={() => onFocus(focusedDuration === duration ? null : focusedDuration)}
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
    {inline ? null : <WiseText color="textSecondary" variant="body">Escolha uma duração e inicie sua sessão.</WiseText>}
    <WiseButton label="Fechar configurações" onPress={onClose} variant="secondary" />
  </WiseCard>;
}

function isVersionConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const responseData = (error as { response?: { data?: unknown } }).response?.data;
  return typeof responseData === 'object'
    && responseData !== null
    && (responseData as { type?: unknown }).type === STUDY_SESSION_VERSION_CONFLICT;
}

export function StudySessionScreen() {
  const { width } = useWindowDimensions();
  const wideLayout = width >= 1140;
  const ringSize = wideLayout ? 340 : Platform.OS === 'web' ? Math.min(310, width * 0.78) : Math.min(264, width * 0.68);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PlannedDurationSeconds>(1500);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      setSettingsOpen(false);
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
  const plannedDuration = snapshot?.plannedDurationSeconds ?? selected;
  const phase = snapshot?.state === 'paused'
    ? 'PAUSADA'
    : snapshot
      ? remaining > plannedDuration * 0.5 ? 'AQUECIMENTO' : remaining > plannedDuration * 0.15 ? 'FOCO PROFUNDO' : 'FORJA FINAL'
      : 'PRONTA PARA COMEÇAR';

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
    <Screen backgroundOverlay={<ForgePageGradient />} hasBottomNavigation safeAreaEdges={['right', 'left']} testID="study-session" title="Forja" contentContainerStyle={styles.screenContent}>
      <View style={styles.layout}>
        {active.isPending && !snapshot ? <WiseText variant="body">Buscando sua sessão ativa…</WiseText> : null}
        {active.isError && !snapshot ? (
          <WiseCard style={styles.messageCard} testID="study-session-load-error">
            <WiseText variant="body">Não foi possível consultar sua sessão. Verifique a conexão.</WiseText>
            <WiseButton label="Tentar novamente" onPress={() => void refreshActive()} variant="secondary" />
          </WiseCard>
        ) : null}
        {snapshot && !snapshot.canControl ? (
          <WiseCard style={styles.messageCard} testID="study-session-remote-conflict">
            <WiseText variant="subtitle">Foco em outro dispositivo</WiseText>
            <WiseText variant="body">Já existe uma sessão ativa nesta conta. Volte ao dispositivo que a iniciou para acompanhá-la.</WiseText>
            <WiseButton label="Atualizar estado" onPress={() => void refreshActive()} variant="secondary" />
          </WiseCard>
        ) : null}
        {displayedTerminalResult ? (
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
          <View style={[styles.forgeColumns, wideLayout && styles.forgeColumnsWide]} testID="study-session-active">
          <WiseCard style={[styles.stage, wideLayout && styles.stageWide]} testID="study-session-stage">
            <ForgeStageGradient />
            <View style={styles.stageHeader}>
              <WiseText color="accentPrimary" variant="caption">{snapshot.state === 'paused' ? 'Sessão pausada' : 'Sessão em andamento'}</WiseText>
              <WiseText color="accentHighlight" variant="label">{snapshot.plannedDurationSeconds / 60} min de foco</WiseText>
            </View>
            <View style={styles.stageBody}>
              <ForgeTimer
                remaining={remaining}
                duration={snapshot.plannedDurationSeconds}
                phase={phase}
                size={ringSize}
                testID="study-session-timer"
                accessibilityLabel={`Tempo restante: ${Math.floor(remaining / 60)} minutos e ${remaining % 60} segundos. Sessão ${snapshot.state === 'paused' ? 'pausada' : 'em andamento'}.`}
              />
            </View>
            <View style={[styles.stageActions, width < 450 && styles.stageActionsCompact]}>
            {settingsOpen && !wideLayout ? <WiseCard style={styles.inlineSettingsCard}>
              <WiseText variant="subtitle">◈ Configurações da sessão</WiseText>
              <View style={styles.statRow}><WiseText color="textSecondary" variant="body">Tempo de foco</WiseText><WiseText color="accentHighlight" variant="mono">{snapshot.plannedDurationSeconds / 60} min</WiseText></View>
              <WiseText color="textSecondary" variant="body">A duração não pode ser alterada durante a sessão.</WiseText>
              <WiseButton label="Fechar configurações" onPress={() => setSettingsOpen(false)} variant="secondary" />
            </WiseCard> : null}
            <View style={[styles.actionRow, width < 450 && styles.actionRowCompact]}>
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
                <ForgeAction
                  icon="stop"
                  iconOnly
                  label={transition.isPending && pendingAction === 'stop' ? TRANSITION_COPY.stop.button : stopLabel}
                  loading={transition.isPending && pendingAction === 'stop'}
                  disabled={transition.isPending || refreshingCanonicalSnapshot || completionPending}
                  onPress={() => changeSessionState('stop')}
                  testID="study-session-stop"
                />
                <ForgeAction
                  icon={snapshot.state === 'paused' ? 'play' : 'pause'}
                  primary
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
              </View>
            ) : null}
            <ForgeAction icon="settings-outline" iconOnly label="Configurações da sessão" expanded={settingsOpen} onPress={() => setSettingsOpen((open) => !open)} />
            </View>
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
            </View>
            <View style={styles.stageFeedback}>
              <WiseText accessibilityLiveRegion="polite" aria-live="polite" testID="study-session-state" variant="body">{sessionStatus}</WiseText>
            </View>
          </WiseCard>
          <View style={[styles.sideColumn, wideLayout && styles.sideColumnWide]}>
            {settingsOpen && wideLayout ? <WiseCard style={styles.sideCard}>
              <WiseText variant="subtitle">◈ Configurações da sessão</WiseText>
              <View style={styles.statRow}><WiseText color="textSecondary" variant="body">Tempo de foco</WiseText><WiseText color="accentHighlight" variant="mono">{snapshot.plannedDurationSeconds / 60} min</WiseText></View>
              <WiseText color="textSecondary" variant="body">A duração não pode ser alterada durante a sessão.</WiseText>
              <WiseButton label="Fechar configurações" onPress={() => setSettingsOpen(false)} variant="secondary" />
            </WiseCard> : <>
            <WiseCard style={styles.sideCard}>
              <WiseText variant="subtitle">◈ Sua sessão</WiseText>
              <View style={styles.statRow}><WiseText color="textSecondary" variant="body">Duração planejada</WiseText><WiseText color="accentHighlight" variant="mono">{snapshot.plannedDurationSeconds / 60} min</WiseText></View>
              <View style={styles.statRow}><WiseText color="textSecondary" variant="body">Foco válido</WiseText><WiseText color="accentHighlight" variant="mono">{formatRemainingTime(validFocusSeconds)}</WiseText></View>
              <WiseText color="textTertiary" variant="body">O tempo e a conclusão são confirmados pelo servidor.</WiseText>
            </WiseCard>
            <WiseCard style={styles.sideCard}>
              <WiseText variant="subtitle">◈ Como funciona</WiseText>
              <WiseText color="textSecondary" variant="body">Pause quando precisar. Ao retomar, o contador continua de onde parou.</WiseText>
              <WiseText color="textSecondary" variant="body">Sessões encerradas antes de 5 minutos não concedem XP.</WiseText>
            </WiseCard>
            </>}
          </View>
          </View>
        ) : null}
        {!displayedTerminalResult && !active.isPending && !active.isError && !snapshot ? (
          <View style={[styles.forgeColumns, wideLayout && styles.forgeColumnsWide]} testID="study-session-setup">
          <WiseCard style={[styles.stage, wideLayout && styles.stageWide]} testID="study-session-stage">
            <ForgeStageGradient />
            <View style={styles.stageHeader}>
              <WiseText color="accentPrimary" variant="caption">PREPARE SUA FORJA</WiseText>
              <WiseText color="accentHighlight" variant="label">{selected / 60} min selecionados</WiseText>
            </View>
            <View style={styles.stageBody}>
              <ForgeTimer remaining={selected} duration={selected} phase={phase} size={ringSize} />
            </View>
            <View style={[styles.stageActions, width < 450 && styles.stageActionsCompact]}>
              {settingsOpen && !wideLayout ? <DurationSettings selected={selected} focusedDuration={focusedDuration} startPending={start.isPending} onSelect={(duration) => { pendingKey.current = null; setSelected(duration); }} onFocus={setFocusedDuration} onClose={() => setSettingsOpen(false)} inline /> : null}
              <View style={[styles.actionRow, width < 450 && styles.actionRowCompact]}>
                <View style={styles.actionButtonPlaceholder} />
                <ForgeAction icon="play" primary label="Iniciar foco" loading={start.isPending} onPress={begin} testID="study-session-start" />
                <ForgeAction icon="settings-outline" iconOnly label="Configurar duração" expanded={settingsOpen} onPress={() => setSettingsOpen((open) => !open)} />
              </View>
              {start.isError ? <WiseText color="feedbackDanger" variant="body">Não foi possível confirmar o início. Tente novamente.</WiseText> : null}
            </View>
          </WiseCard>
          <View style={[styles.sideColumn, wideLayout && styles.sideColumnWide]}>
          {settingsOpen && wideLayout ? <DurationSettings selected={selected} focusedDuration={focusedDuration} startPending={start.isPending} onSelect={(duration) => { pendingKey.current = null; setSelected(duration); }} onFocus={setFocusedDuration} onClose={() => setSettingsOpen(false)} /> : <WiseCard style={styles.sideCard}>
            <WiseText variant="subtitle">◈ Seu progresso</WiseText>
            <WiseText color="textSecondary" variant="body">O foco válido e o XP aparecem ao concluir a sessão.</WiseText>
            <WiseText color="textTertiary" variant="body">Se encerrar antes de 5 minutos, a sessão não concede XP.</WiseText>
          </WiseCard>}
          </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { justifyContent: 'flex-start' },
  layout: { width: '100%', maxWidth: 1040, alignSelf: 'center', gap: theme.space.sectionGap },
  messageCard: { maxWidth: 580, alignSelf: 'center', padding: theme.space.cardInset, gap: theme.space.controlInset },
  forgeColumns: { width: '100%', gap: theme.space.cardInset },
  forgeColumnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  stage: { minWidth: 0 },
  stageWide: { flex: 1 },
  stageHeader: { minHeight: 65, paddingHorizontal: theme.space.cardInset, paddingVertical: theme.space.controlInset, borderBottomWidth: 1, borderBottomColor: theme.color.borderGhost, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.inlineTight },
  stageBody: { alignItems: 'center', justifyContent: 'center', paddingVertical: theme.space.controlInset, paddingHorizontal: theme.space.inlineTight },
  stageActions: { borderTopWidth: 1, borderTopColor: theme.color.borderGhost, paddingHorizontal: theme.space.cardInset, paddingVertical: theme.space.stackDefault, alignItems: 'center', gap: theme.space.stackTight },
  stageActionsCompact: { paddingHorizontal: theme.space.inlineTight },
  actionRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14 },
  actionRowCompact: { gap: theme.space.inlineTight },
  actionButton: { minHeight: theme.layout.touchTarget, borderWidth: 1, borderRadius: theme.radius.detail, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  actionButtonPrimary: { minWidth: 200, borderColor: theme.color.accentHighlight, shadowColor: theme.color.accentPrimary, shadowOpacity: 0.35, shadowRadius: 14, elevation: 4 },
  actionButtonPrimaryCompact: { minWidth: 0, flexGrow: 1, flexShrink: 1, maxWidth: 200 },
  actionButtonIcon: { width: theme.layout.touchTarget, height: theme.layout.touchTarget, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonPlaceholder: { width: theme.layout.touchTarget, height: theme.layout.touchTarget },
  actionGradient: { minHeight: theme.layout.touchTarget, width: '100%', paddingHorizontal: theme.space.controlInset, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space.inlineTight },
  actionLabel: { fontFamily: 'Cinzel-SemiBold', color: theme.color.textPrimary, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  actionLabelPrimary: { fontFamily: 'Cinzel-Bold', color: theme.color.backgroundCanvas },
  stageFeedback: { borderTopWidth: 1, borderTopColor: theme.color.borderGhost, padding: theme.space.controlInset },
  sideColumn: { width: '100%', gap: theme.space.cardInset },
  sideColumnWide: { maxWidth: 320 },
  sideCard: { padding: theme.space.stackDefault, gap: theme.space.controlInset },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space.inlineTight, borderBottomWidth: 1, borderBottomColor: theme.color.borderGhost, paddingBottom: theme.space.stackTight },
  timerRingWrap: { justifyContent: 'center', alignItems: 'center' },
  timerRing: { transform: [{ rotate: '-90deg' }] },
  timerCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: theme.space.inlineTight },
  timerDigits: { ...theme.type.display, color: theme.color.textPrimary, textAlign: 'center', lineHeight: 88, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  inlineSettingsCard: { width: '100%', padding: theme.space.controlInset, gap: theme.space.controlInset },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.stackTight },
  preset: { minWidth: theme.layout.touchTarget, minHeight: theme.layout.touchTarget, paddingHorizontal: theme.space.stackTight, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.color.borderEmphasis, borderRadius: theme.radius.control },
  selected: { backgroundColor: theme.color.surfaceCardActive, borderColor: theme.color.accentPrimary },
});
