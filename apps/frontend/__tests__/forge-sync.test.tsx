import { fireEvent, render, screen } from '@testing-library/react-native';
import { ForgeSyncIndicator } from '@/features/study-session/sync-indicator';
import { FORGE_SYNC_COPY, forgeSyncStatus } from '@/features/study-session/sync-status';

describe('forgeSyncStatus', () => {
  it('puts offline first, then a request in flight, then a failure', () => {
    expect(forgeSyncStatus({ online: false, syncing: true, failed: true })).toBe('offline');
    expect(forgeSyncStatus({ online: true, syncing: true, failed: true })).toBe('syncing');
    expect(forgeSyncStatus({ online: true, syncing: false, failed: true })).toBe('failed');
    expect(forgeSyncStatus({ online: true, syncing: false, failed: false })).toBe('online');
  });
});

describe('ForgeSyncIndicator', () => {
  it.each(['online', 'offline', 'syncing', 'failed'] as const)('names the %s state in text, never by the dot alone', async (status) => {
    await render(<ForgeSyncIndicator onRetry={jest.fn()} status={status} />);

    expect(screen.getByTestId('study-session-sync-label')).toHaveTextContent(FORGE_SYNC_COPY[status].label);
    expect(screen.getByTestId(`study-session-sync-${status}`).props.accessibilityLabel).toBe(`${FORGE_SYNC_COPY[status].label}. ${FORGE_SYNC_COPY[status].message}`);
  });

  it('explains what happens offline, without a retry', async () => {
    await render(<ForgeSyncIndicator onRetry={jest.fn()} status="offline" />);

    expect(screen.getByText(/Sincronizamos assim que a rede voltar/)).toBeTruthy();
    expect(screen.queryByTestId('study-session-sync-retry')).toBeNull();
  });

  it('offers to sync again after a failure', async () => {
    const onRetry = jest.fn();
    await render(<ForgeSyncIndicator onRetry={onRetry} status="failed" />);

    await fireEvent.press(screen.getByTestId('study-session-sync-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
