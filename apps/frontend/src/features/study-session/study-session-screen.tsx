import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen, WiseButton, WiseCard, WiseText, theme } from '@/design-system';
import { getActiveStudySession, startStudySession, STUDY_SESSION_PRESETS, type PlannedDurationSeconds } from './api';
import { formatRemainingTime, remainingStudySeconds } from './timer';

const activeKey = ['study-session', 'active'] as const;

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function StudySessionScreen() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PlannedDurationSeconds>(1500);
  const [now, setNow] = useState(0);
  const pendingKey = useRef<string | null>(null);
  const active = useQuery({ queryKey: activeKey, queryFn: ({ signal }) => getActiveStudySession(signal), staleTime: 0, retry: false });
  const start = useMutation({
    mutationFn: ({ duration, key }: { duration: PlannedDurationSeconds; key: string }) => startStudySession(duration, key),
    onSuccess(snapshot) {
      pendingKey.current = null;
      queryClient.setQueryData(activeKey, snapshot);
    },
    onError() {
      void active.refetch();
    },
  });

  const snapshot = active.data;
  const clockOffset = snapshot ? new Date(snapshot.serverNow).getTime() - snapshot.receivedAtMs : 0;
  useEffect(() => {
    if (!snapshot || snapshot.state !== 'running') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [snapshot]);
  const remaining = snapshot ? now === 0 ? snapshot.remainingSeconds : remainingStudySeconds(snapshot, now, clockOffset) : selected;

  const begin = () => {
    const key = pendingKey.current ?? newIdempotencyKey();
    pendingKey.current = key;
    start.mutate({ duration: selected, key });
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
            <WiseText variant="subtitle">Sessão em andamento</WiseText>
            <WiseText accessibilityLabel={`${Math.floor(remaining / 60)} minutos e ${remaining % 60} segundos restantes`} style={styles.timer} testID="study-session-timer" variant="display">{formatRemainingTime(remaining)}</WiseText>
            <WiseText color="textSecondary" variant="body">Foco de {snapshot.plannedDurationSeconds / 60} minutos iniciado. Seu tempo é confirmado pelo servidor.</WiseText>
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
                  style={[styles.preset, selected === duration && styles.selected]}
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
