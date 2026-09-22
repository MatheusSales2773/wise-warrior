import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Screen, WiseButton, WiseCard, WiseText, theme } from '@/design-system';
import { controlStyles } from '@/design-system/components/control-styles';
import {
  pauseStudySession,
  resumeStudySession,
  startStudySession,
  STUDY_SESSION_PRESETS,
  type PlannedDurationSeconds,
  type StudySessionSnapshot,
} from './api';
import { activeStudySessionQueryKey, useActiveStudySession } from './queries';
import { formatRemainingTime, remainingStudySeconds } from './timer';
import { FeedbackMessage } from '@/design-system/components/FeedbackMessage';

type TransitionAction = 'pause' | 'resume';
type TransitionCommand = {
  id: string;
  action: TransitionAction;
  expectedVersion: number;
  idempotencyKey: string;
};

const STUDY_SESSION_VERSION_CONFLICT = 'https://wise.app/errors/study-session-version-conflict';

function isVersionConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const responseData = (error as { response?: { data?: unknown } }).response?.data;
  return typeof responseData === 'object'
    && responseData !== null
    && (responseData as { type?: unknown }).type === STUDY_SESSION_VERSION_CONFLICT;
}

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function StudySessionScreen() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PlannedDurationSeconds>(1500);
  const [focusedDuration, setFocusedDuration] = useState<PlannedDurationSeconds | null>(null);
  const [now, setNow] = useState(0);
  const [retryTransition, setRetryTransition] = useState<TransitionCommand | null>(null);
  const pendingKey = useRef<string | null>(null);
  const announcedStatus = useRef<string | null>(null);
  const active = useActiveStudySession();
  const start = useMutation({
    mutationFn: ({ duration, key }: { duration: PlannedDurationSeconds; key: string }) => startStudySession(duration, key),
    onSuccess(snapshot) {
      pendingKey.current = null;
      queryClient.setQueryData(activeStudySessionQueryKey, snapshot);
    },
    onError() {
      void active.refetch();
    },
  });
  const transition = useMutation({
    mutationFn: (command: TransitionCommand) => command.action === 'pause'
      ? pauseStudySession(command.id, command.expectedVersion, command.idempotencyKey)
      : resumeStudySession(command.id, command.expectedVersion, command.idempotencyKey),
    onSuccess(nextSnapshot) {
      setRetryTransition(null);
      const currentSnapshot = queryClient.getQueryData<StudySessionSnapshot | null>(activeStudySessionQueryKey);
      if (!currentSnapshot || currentSnapshot.version <= nextSnapshot.version) {
        setNow(nextSnapshot.receivedAtMs);
        queryClient.setQueryData(activeStudySessionQueryKey, nextSnapshot);
      }
    },
    onError(error) {
      if (isVersionConflict(error)) {
        setRetryTransition(null);
        void active.refetch();
      }
    },
  });

  const snapshot = active.data;
  const snapshotId = snapshot?.id;
  const snapshotState = snapshot?.state;
  const clockOffset = snapshot ? new Date(snapshot.serverNow).getTime() - snapshot.receivedAtMs : 0;
  useEffect(() => {
    if (snapshotState !== 'running') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [snapshotId, snapshotState]);
  const remaining = snapshot ? now === 0 ? snapshot.remainingSeconds : remainingStudySeconds(snapshot, now, clockOffset) : selected;
  const pendingAction = transition.variables?.action;
  const retryAvailable = Boolean(retryTransition && transition.isError && !transition.isPending);
  const versionConflict = isVersionConflict(transition.error);
  const needsCanonicalRefresh = versionConflict && (
    !snapshot || snapshot.version <= (transition.variables?.expectedVersion ?? 0)
  );
  const refreshingCanonicalSnapshot = needsCanonicalRefresh && active.isFetching;
  const sessionStatus = transition.isPending
    ? pendingAction === 'pause'
      ? 'Pausando sessão. Os controles estão ocupados até a confirmação.'
      : 'Retomando sessão. Os controles estão ocupados até a confirmação.'
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
    if (!snapshot?.canControl || transition.isPending) return;
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
            <WiseButton label="Tentar novamente" onPress={() => void active.refetch()} variant="secondary" />
          </WiseCard>
        ) : null}
        {snapshot && !snapshot.canControl ? (
          <WiseCard testID="study-session-remote-conflict">
            <WiseText variant="subtitle">Foco em outro dispositivo</WiseText>
            <WiseText variant="body">Já existe uma sessão ativa nesta conta. Volte ao dispositivo que a iniciou para acompanhá-la.</WiseText>
            <WiseButton label="Atualizar estado" onPress={() => void active.refetch()} variant="secondary" />
          </WiseCard>
        ) : null}
        {snapshot?.canControl ? (
          <WiseCard testID="study-session-active">
            <WiseText variant="subtitle">{snapshot.state === 'paused' ? 'Sessão pausada' : 'Sessão em andamento'}</WiseText>
            <WiseText accessibilityLiveRegion="none" aria-live="off" accessibilityLabel={`Tempo restante: ${Math.floor(remaining / 60)} minutos e ${remaining % 60} segundos. Sessão ${snapshot.state === 'paused' ? 'pausada' : 'em andamento'}.`} style={styles.timer} testID="study-session-timer" variant="display">{formatRemainingTime(remaining)}</WiseText>
            <WiseText color="textSecondary" variant="body">Foco de {snapshot.plannedDurationSeconds / 60} minutos iniciado. Seu tempo é confirmado pelo servidor.</WiseText>
            <WiseText accessibilityLiveRegion="polite" aria-live="polite" testID="study-session-state" variant="body">{sessionStatus}</WiseText>
            {retryAvailable && retryTransition ? (
              <WiseButton
                label={`Tentar ${retryTransition.action === 'pause' ? 'pausar' : 'retomar'} novamente`}
                onPress={retryLastTransition}
                variant="secondary"
                testID="study-session-transition-retry"
              />
            ) : (
              <WiseButton
                label={transition.isPending
                  ? pendingAction === 'pause' ? 'Pausando sessão…' : 'Retomando sessão…'
                  : needsCanonicalRefresh
                    ? refreshingCanonicalSnapshot ? 'Atualizando estado…' : 'Atualizar estado'
                    : snapshot.state === 'paused' ? 'Retomar sessão' : 'Pausar sessão'}
                loading={transition.isPending || refreshingCanonicalSnapshot}
                disabled={transition.isPending || refreshingCanonicalSnapshot}
                onPress={() => needsCanonicalRefresh
                  ? void active.refetch()
                  : changeSessionState(snapshot.state === 'paused' ? 'resume' : 'pause')}
                testID={snapshot.state === 'paused' ? 'study-session-resume' : 'study-session-pause'}
              />
            )}
            {transition.isError ? (
              <FeedbackMessage
                variant="error"
                title={versionConflict ? 'A sessão mudou desde a última confirmação.' : 'Não foi possível confirmar a transição'}
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
          </WiseCard>
        ) : null}
        {!active.isPending && !active.isError && !snapshot ? (
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
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.stackTight, marginVertical: theme.space.sectionGap },
  preset: { minWidth: theme.layout.touchTarget, minHeight: theme.layout.touchTarget, paddingHorizontal: theme.space.cardInset, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.color.borderEmphasis, borderRadius: theme.radius.control },
  selected: { backgroundColor: theme.color.surfaceCardActive, borderColor: theme.color.accentPrimary },
  timer: { textAlign: 'center', marginVertical: theme.space.sectionGap },
});
