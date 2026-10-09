import { useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { isApiError } from '@/core/api/api-error';
import { useAuth } from '@/core/auth/auth-context';
import { FeedbackMessage, WiseButton, WiseText, theme, type FeedbackMessageVariant } from '@/design-system';
import { formatSessionDate } from '@/features/dashboard/formatters';
import { revokeAllMyDeviceSessions, revokeMyDeviceSession, type DeviceSession } from './api';
import { describeDevice } from './formatters';
import { profileKeys } from './queries';

type Notice = { variant: FeedbackMessageVariant; title: string; message: string };

function alreadyEndedNotice(name: string): Notice {
  return {
    variant: 'info',
    title: 'Dispositivo já desconectado',
    message: `${name} já tinha sido desconectado em outro lugar. A lista foi atualizada.`,
  };
}

function failureNotice(error: unknown, action: string): Notice {
  const offline = isApiError(error) && error.category === 'network';
  return {
    variant: 'error',
    title: 'Nada foi encerrado',
    message: `Não foi possível ${action}. ${offline ? 'Verifique sua conexão e tente novamente.' : 'Tente novamente em instantes.'}`,
  };
}

function ConfirmPanel({ children, testID }: { children: ReactNode; testID: string }) {
  return <View style={styles.confirm} testID={testID}>{children}</View>;
}

type DeviceItemProps = {
  current: boolean;
  device: DeviceSession;
  confirming: boolean;
  ending: boolean;
  onAsk(): void;
  onCancel(): void;
  onConfirm(): void;
};

function DeviceItem({ current, device, confirming, ending, onAsk, onCancel, onConfirm }: DeviceItemProps) {
  const name = describeDevice(device);
  const lastUsed = `Último acesso: ${formatSessionDate(device.lastUsedAt)}`;
  return (
    <View style={styles.deviceItem} testID={`profile-device-${device.id}`}>
      <View style={styles.deviceRow}>
        <View accessible accessibilityLabel={`${name}${current ? ', este dispositivo' : ''}. ${lastUsed}`} style={styles.deviceMain}>
          <WiseText variant="label">{name}</WiseText>
          <WiseText color="textSecondary" variant="body">{lastUsed}</WiseText>
        </View>
        {current
          ? <WiseText color="accentPrimary" testID={`profile-device-current-${device.id}`} variant="caption">ESTE DISPOSITIVO</WiseText>
          : confirming
            ? null
            : <WiseButton accessibilityLabel={`Encerrar ${name}`} label="Encerrar" onPress={onAsk} testID={`profile-device-end-${device.id}`} variant="danger" />}
      </View>
      {confirming ? (
        <ConfirmPanel testID={`profile-device-confirm-${device.id}`}>
          <WiseText variant="body">{`Encerrar o acesso de ${name}?`}</WiseText>
          <WiseText color="textSecondary" variant="body">Quem estiver usando esse dispositivo precisará entrar de novo.</WiseText>
          <View style={styles.confirmActions}>
            <WiseButton accessibilityLabel={`Confirmar: encerrar ${name}`} label="Encerrar" loading={ending} onPress={onConfirm} variant="danger" />
            <WiseButton accessibilityLabel={`Manter ${name} conectado`} disabled={ending} label="Manter" onPress={onCancel} variant="ghost" />
          </View>
        </ConfirmPanel>
      ) : null}
    </View>
  );
}

export function DevicesContent({ currentSessionId, query }: { currentSessionId: string | null; query: UseQueryResult<DeviceSession[]> }) {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const reloadDevices = () => queryClient.invalidateQueries({ queryKey: profileKeys.devices() });

  const endOne = useMutation({
    mutationFn: (sessionId: string) => revokeMyDeviceSession(sessionId),
    onSuccess: () => {
      setConfirming(null);
      return reloadDevices();
    },
    onError: (error, sessionId) => {
      setConfirming(null);
      if (isApiError(error) && error.status === 404) {
        const device = query.data?.find((candidate) => candidate.id === sessionId);
        setNotice(alreadyEndedNotice(device ? describeDevice(device) : 'O dispositivo'));
        return reloadDevices();
      }
      setNotice(failureNotice(error, 'encerrar o dispositivo'));
      return undefined;
    },
  });

  const endAll = useMutation({
    mutationFn: () => revokeAllMyDeviceSessions(),
    // Every Session is already revoked, this one included; leaving locally sends the student to login.
    onSuccess: () => logout().catch(() => reloadDevices()),
    onError: (error) => {
      setConfirming(null);
      setNotice(failureNotice(error, 'sair de todos os dispositivos'));
    },
  });

  const ask = (target: string) => {
    setNotice(null);
    setConfirming(target);
  };

  const body = (() => {
    if (query.isPending && !query.data) {
      return <WiseText color="textSecondary" testID="profile-devices-loading" variant="body">Carregando seus dispositivos…</WiseText>;
    }
    if (query.isError && !query.data) {
      return <View style={styles.stack} testID="profile-devices-error">
        <FeedbackMessage message="Não foi possível carregar seus dispositivos." title="Dispositivos indisponíveis" variant="error" />
        <WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void query.refetch()} variant="secondary" />
      </View>;
    }
    const devices = query.data ?? [];
    if (!devices.length) return <WiseText color="textSecondary" variant="body">Nenhum dispositivo com sessão ativa.</WiseText>;
    return (
      <>
        <View testID="profile-device-list">
          {devices.map((device, index) => (
            <View key={device.id} style={index > 0 && styles.divider}>
              <DeviceItem
                confirming={confirming === device.id}
                current={device.id === currentSessionId}
                device={device}
                ending={endOne.isPending && endOne.variables === device.id}
                onAsk={() => ask(device.id)}
                onCancel={() => setConfirming(null)}
                onConfirm={() => endOne.mutate(device.id)}
              />
            </View>
          ))}
        </View>
        {confirming === 'all' ? (
          <ConfirmPanel testID="profile-devices-confirm-all">
            <WiseText variant="label">Sair de todos os dispositivos?</WiseText>
            <WiseText color="textSecondary" variant="body">Todos os dispositivos serão desconectados, inclusive este. Você voltará para a tela de entrada.</WiseText>
            <View style={styles.confirmActions}>
              <WiseButton accessibilityLabel="Confirmar: sair de todos os dispositivos" label="Sair de todos" loading={endAll.isPending} onPress={() => endAll.mutate()} variant="danger" />
              <WiseButton accessibilityLabel="Cancelar saída de todos os dispositivos" disabled={endAll.isPending} label="Cancelar" onPress={() => setConfirming(null)} variant="ghost" />
            </View>
          </ConfirmPanel>
        ) : (
          <WiseButton label="Sair de todos os dispositivos" onPress={() => ask('all')} testID="profile-devices-end-all" variant="danger" />
        )}
      </>
    );
  })();

  return (
    <View style={styles.stack} testID="profile-devices">
      <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">Dispositivos conectados</WiseText>
      {notice ? <FeedbackMessage message={notice.message} testID="profile-devices-notice" title={notice.title} variant={notice.variant} /> : null}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.space.stackDefault },
  divider: { borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderSubtle, borderStyle: 'dashed' },
  deviceItem: { gap: theme.space.stackTight, paddingVertical: theme.space.stackTight },
  deviceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.stackTight },
  deviceMain: { flexGrow: 1, flexBasis: 160, gap: theme.space.inlineHairline },
  confirm: {
    gap: theme.space.inlineTight,
    padding: theme.space.controlInset,
    backgroundColor: theme.color.surfaceInset,
    borderLeftWidth: theme.border.focus,
    borderLeftColor: theme.color.feedbackDanger,
    borderRadius: theme.radius.detail,
  },
  confirmActions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.inlineTight, marginTop: theme.space.inlineHairline },
});
