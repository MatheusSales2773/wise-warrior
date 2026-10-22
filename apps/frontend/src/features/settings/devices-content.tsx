import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { isApiError } from '@/core/api/api-error';
import { useAuth } from '@/core/auth/auth-context';
import { FeedbackMessage, WiseButton, WiseText, theme, type FeedbackMessageVariant } from '@/design-system';
import { formatSessionDate } from '@/features/dashboard/formatters';
import { revokeMyDeviceSession, revokeOtherMyDeviceSessions, type DeviceSession } from '@/features/profile/api';
import { describeDevice } from '@/features/profile/formatters';
import { deviceSessionsQueryOptions, profileKeys } from '@/features/profile/queries';

type Notice = { variant: FeedbackMessageVariant; title: string; message: string };
type Confirmation = { kind: 'one'; sessionId: string } | { kind: 'others' };
type DeviceToEnd = { sessionId: string; name: string };

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
    <View style={styles.deviceItem} testID={`settings-device-${device.id}`}>
      <View style={styles.deviceRow}>
        <View accessible accessibilityLabel={`${name}${current ? ', este dispositivo' : ''}. ${lastUsed}`} style={styles.deviceMain}>
          <WiseText variant="label">{name}</WiseText>
          <WiseText color="textSecondary" variant="body">{lastUsed}</WiseText>
        </View>
        {current
          ? <WiseText color="accentPrimary" testID={`settings-device-current-${device.id}`} variant="caption">ESTE DISPOSITIVO</WiseText>
          : confirming
            ? null
            : <WiseButton accessibilityLabel={`Encerrar ${name}`} label="Encerrar" onPress={onAsk} testID={`settings-device-end-${device.id}`} variant="danger" />}
      </View>
      {confirming ? (
        <ConfirmPanel testID={`settings-device-confirm-${device.id}`}>
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

/** "3 dispositivos ativos"; absent until the list loads. */
export function useActiveDevicesLabel(): string | undefined {
  const count = useQuery(deviceSessionsQueryOptions()).data?.length;
  if (count === undefined) return undefined;
  return `${count} ${count === 1 ? 'dispositivo ativo' : 'dispositivos ativos'}`;
}

export function DevicesContent() {
  const query = useQuery(deviceSessionsQueryOptions());
  const { sessionId: currentSessionId } = useAuth();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const reloadDevices = () => queryClient.invalidateQueries({ queryKey: profileKeys.devices() });

  const endOne = useMutation({
    mutationFn: ({ sessionId }: DeviceToEnd) => revokeMyDeviceSession(sessionId),
    onSuccess: () => {
      setConfirming(null);
      return reloadDevices();
    },
    onError: (error, { name }) => {
      setConfirming(null);
      if (isApiError(error) && error.status === 404) {
        setNotice(alreadyEndedNotice(name));
        return reloadDevices();
      }
      setNotice(failureNotice(error, 'encerrar o dispositivo'));
      return undefined;
    },
  });

  const endOthers = useMutation({
    mutationFn: () => revokeOtherMyDeviceSessions(),
    onSuccess: () => {
      setConfirming(null);
      return reloadDevices();
    },
    onError: (error) => {
      setConfirming(null);
      setNotice(failureNotice(error, 'encerrar os outros dispositivos'));
    },
  });

  const ask = (target: Confirmation) => {
    setNotice(null);
    setConfirming(target);
  };

  const body = (() => {
    if (query.isPending && !query.data) {
      return <WiseText color="textSecondary" testID="settings-devices-loading" variant="body">Carregando seus dispositivos…</WiseText>;
    }
    if (query.isError && !query.data) {
      return <View style={styles.stack} testID="settings-devices-error">
        <FeedbackMessage message="Não foi possível carregar seus dispositivos." title="Dispositivos indisponíveis" variant="error" />
        <WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void query.refetch()} variant="secondary" />
      </View>;
    }
    const devices = query.data ?? [];
    const others = devices.filter((device) => device.id !== currentSessionId).length;
    if (!devices.length) return <WiseText color="textSecondary" variant="body">Nenhum dispositivo conectado.</WiseText>;
    return (
      <>
        <View testID="settings-device-list">
          {devices.map((device, index) => (
            <View key={device.id} style={index > 0 && styles.divider}>
              <DeviceItem
                confirming={confirming?.kind === 'one' && confirming.sessionId === device.id}
                current={device.id === currentSessionId}
                device={device}
                ending={endOne.isPending && endOne.variables.sessionId === device.id}
                onAsk={() => ask({ kind: 'one', sessionId: device.id })}
                onCancel={() => setConfirming(null)}
                onConfirm={() => endOne.mutate({ sessionId: device.id, name: describeDevice(device) })}
              />
            </View>
          ))}
        </View>
        {others > 0 ? (confirming?.kind === 'others' ? (
          <ConfirmPanel testID="settings-devices-confirm-others">
            <WiseText variant="label">Encerrar os outros dispositivos?</WiseText>
            <WiseText color="textSecondary" variant="body">{`${others === 1 ? 'O outro dispositivo será desconectado' : `Os outros ${others} dispositivos serão desconectados`}. Este continua conectado.`}</WiseText>
            <View style={styles.confirmActions}>
              <WiseButton accessibilityLabel="Confirmar: encerrar os outros dispositivos" label="Encerrar" loading={endOthers.isPending} onPress={() => endOthers.mutate()} variant="danger" />
              <WiseButton accessibilityLabel="Manter os outros dispositivos conectados" disabled={endOthers.isPending} label="Manter" onPress={() => setConfirming(null)} variant="ghost" />
            </View>
          </ConfirmPanel>
        ) : (
          <WiseButton label="Encerrar os outros dispositivos" onPress={() => ask({ kind: 'others' })} testID="settings-devices-end-others" variant="danger" />
        )) : null}
      </>
    );
  })();

  return (
    <View style={styles.stack} testID="settings-devices">
      {notice ? <FeedbackMessage message={notice.message} testID="settings-devices-notice" title={notice.title} variant={notice.variant} /> : null}
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
