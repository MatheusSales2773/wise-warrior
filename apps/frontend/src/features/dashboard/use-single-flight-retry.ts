import type { UseQueryResult } from '@tanstack/react-query';
import { useRef } from 'react';

/** A retry that joins the request already in flight instead of starting another one. */
export function useSingleFlightRetry(query: Pick<UseQueryResult<unknown>, 'refetch'>) {
  const retryInFlight = useRef<Promise<unknown> | null>(null);
  return () => {
    if (retryInFlight.current) return retryInFlight.current;
    const request = query.refetch().finally(() => { retryInFlight.current = null; });
    retryInFlight.current = request;
    return request;
  };
}
