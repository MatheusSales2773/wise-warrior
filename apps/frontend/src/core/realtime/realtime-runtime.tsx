import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getPublicApiUrl } from '@/config/environment';
import { recoverAuthenticationOnce } from '@/core/api/api-client';
import { getAccessToken } from '@/core/api/token-memory';
import { useAuth } from '@/core/auth/auth-context';
import { FeedbackMessage } from '@/design-system';
import { createRealtimeClient, type RealtimeStatus } from './realtime-client';

/** Only a connection that is not up (after the first attempt) is worth a visible notice. */
export function RealtimeStatusNotice({ status }: { status: RealtimeStatus }) {
  if (status === 'reconnecting') {
    return <View testID="realtime-status-reconnecting"><FeedbackMessage message="Reconectando para manter seu progresso atualizado em tempo real." title="Reconectando" variant="warning" /></View>;
  }
  if (status === 'offline') {
    return <View testID="realtime-status-offline"><FeedbackMessage message="Sem conexão em tempo real. Os dados são atualizados ao reabrir ou recarregar a tela." title="Tempo real indisponível" variant="error" /></View>;
  }
  return null;
}

/** Keeps one realtime connection for the authenticated Session and shows when it is down. */
export function RealtimeRuntime() {
  const { status, sessionId } = useAuth();
  const queryClient = useQueryClient();
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    if (status !== 'authenticated') return;
    // The REST base URL carries the API prefix; Socket.IO lives at the origin.
    const client = createRealtimeClient({
      url: new URL(getPublicApiUrl()).origin,
      queryClient,
      getToken: getAccessToken,
      recover: recoverAuthenticationOnce,
    });
    const unsubscribe = client.subscribe(() => setRealtimeStatus(client.getStatus()));
    return () => {
      unsubscribe();
      client.dispose();
      setRealtimeStatus('connecting');
    };
  }, [status, sessionId, queryClient]);

  return <RealtimeStatusNotice status={realtimeStatus} />;
}
