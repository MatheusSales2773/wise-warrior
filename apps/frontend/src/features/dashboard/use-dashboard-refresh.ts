import type { UseQueryResult } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

const SUCCESS_VISIBLE_MS = 4_000;

/**
 * "Atualizar", pull-to-refresh and the partial-failure message of the Acampamento, over every query the screen
 * registers. A card's query joins the refresh by being added to `queries`, with no change to this hook.
 */
export function useDashboardRefresh(queries: readonly UseQueryResult<unknown>[]) {
  const [refreshSucceeded, setRefreshSucceeded] = useState(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshInProgress = useRef(false);
  const refreshing = queries.some((query) => query.isRefetching);
  const anyError = queries.some((query) => query.isError);
  const statusMessage = refreshing ? 'Atualizando dados' : refreshSucceeded ? 'Dados atualizados' : null;
  const partialErrorMessage = anyError ? 'Alguns dados não foram atualizados.' : null;

  const refresh = async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    setRefreshSucceeded(false);
    const request = Promise.all(queries.map((query) => query.refetch()))
      .then((results) => setRefreshSucceeded(results.every((result) => !result.isError)))
      .finally(() => { refreshInFlight.current = null; });
    refreshInFlight.current = request;
    return request;
  };

  useEffect(() => {
    if (refreshing) {
      refreshInProgress.current = true;
      return;
    }
    if (!refreshInProgress.current) return;
    refreshInProgress.current = false;
    setRefreshSucceeded(!anyError);
  }, [anyError, refreshing]);

  useEffect(() => {
    if (!refreshSucceeded) return;
    const timeout = setTimeout(() => setRefreshSucceeded(false), SUCCESS_VISIBLE_MS);
    return () => clearTimeout(timeout);
  }, [refreshSucceeded]);

  useEffect(() => {
    if (Platform.OS === 'ios' && statusMessage) {
      AccessibilityInfo.announceForAccessibilityWithOptions(statusMessage, { queue: true });
    }
  }, [statusMessage]);

  return { partialErrorMessage, refresh, refreshing, statusMessage };
}
