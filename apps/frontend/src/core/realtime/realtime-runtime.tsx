import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getPublicApiUrl } from '@/config/environment';
import { recoverAuthenticationOnce } from '@/core/api/api-client';
import { getAccessToken } from '@/core/api/token-memory';
import { useAuth } from '@/core/auth/auth-context';
import { createRealtimeClient } from './realtime-client';

/** Keeps one realtime connection for the authenticated Session. Renders nothing. */
export function RealtimeRuntime() {
  const { status, sessionId } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status !== 'authenticated') return;
    // The REST base URL carries the API prefix; Socket.IO lives at the origin.
    const client = createRealtimeClient({
      url: new URL(getPublicApiUrl()).origin,
      queryClient,
      getToken: getAccessToken,
      recover: recoverAuthenticationOnce,
    });
    return () => client.dispose();
  }, [status, sessionId, queryClient]);

  return null;
}
