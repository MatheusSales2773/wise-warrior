/** Where a Study Session stands against the server, shown on the Forja (#17). */
export type ForgeSyncStatus = 'online' | 'offline' | 'syncing' | 'failed';

/**
 * Offline wins, because nothing can be confirmed then. Then a request in flight (syncing), then a failure to
 * reconcile with the server. The server stays the source of truth for time and XP in every case.
 */
export function forgeSyncStatus({ online, syncing, failed }: { online: boolean; syncing: boolean; failed: boolean }): ForgeSyncStatus {
  if (!online) return 'offline';
  if (syncing) return 'syncing';
  if (failed) return 'failed';
  return 'online';
}

export const FORGE_SYNC_COPY: Record<ForgeSyncStatus, { label: string; message: string }> = {
  online: { label: 'Sincronizado', message: 'Sua sessão está salva no servidor.' },
  offline: { label: 'Sem conexão', message: 'O tempo continua contando no servidor. Sincronizamos assim que a rede voltar.' },
  syncing: { label: 'Sincronizando…', message: 'Conferindo sua sessão com o servidor.' },
  failed: { label: 'Falha ao sincronizar', message: 'Não conseguimos confirmar sua sessão com o servidor.' },
};
