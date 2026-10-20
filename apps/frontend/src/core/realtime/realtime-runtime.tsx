import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { View } from 'react-native';
import { getPublicApiUrl } from '@/config/environment';
import { recoverAuthenticationOnce } from '@/core/api/api-client';
import { getAccessToken } from '@/core/api/token-memory';
import { useAuth } from '@/core/auth/auth-context';
import { FeedbackMessage } from '@/design-system';
import { createRealtimeClient, type RealtimeStatus } from './realtime-client';
import { setActiveRealtime, useActiveRealtime } from './realtime-store';

const notices: Partial<Record<RealtimeStatus, { variant: 'warning' | 'error'; title: string; message: string }>> = {
  reconnecting: { variant: 'warning', title: 'Reconectando', message: 'Reconectando para manter seu progresso atualizado em tempo real.' },
  offline: { variant: 'error', title: 'Tempo real indisponível', message: 'Sem conexão em tempo real. Os dados são atualizados ao reabrir ou recarregar a tela.' },
};

/** Only a connection that is not up (after the first attempt) is worth a visible notice. */
export function RealtimeStatusNotice({ status }: { status: RealtimeStatus }) {
  const notice = notices[status];
  if (!notice) return null;
  return <View testID={`realtime-status-${status}`}><FeedbackMessage {...notice} /></View>;
}

/** Keeps one realtime connection for the authenticated Session and shows when it is down. */
export function RealtimeRuntime() {
  const { status, sessionId } = useAuth();
  const queryClient = useQueryClient();
  const realtime = useActiveRealtime();

  useEffect(() => {
    if (status !== 'authenticated') return;
    // The REST base URL carries the API prefix; Socket.IO lives at the origin.
    const client = createRealtimeClient({
      url: new URL(getPublicApiUrl()).origin,
      queryClient,
      getToken: getAccessToken,
      recover: recoverAuthenticationOnce,
    });
    const publish = () => setActiveRealtime({ channel: client, status: client.getStatus() });
    publish();
    const unsubscribe = client.subscribe(publish);
    return () => {
      unsubscribe();
      setActiveRealtime(null);
      client.dispose();
    };
  }, [status, sessionId, queryClient]);

  return <RealtimeStatusNotice status={realtime?.status ?? 'connecting'} />;
}
