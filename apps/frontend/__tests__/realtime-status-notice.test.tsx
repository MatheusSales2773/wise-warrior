import { render, screen } from '@testing-library/react-native';
import { RealtimeStatusNotice } from '@/core/realtime/realtime-runtime';

describe('RealtimeStatusNotice', () => {
  it('shows a notice while reconnecting', async () => {
    await render(<RealtimeStatusNotice status="reconnecting" />);
    expect(screen.getByTestId('realtime-status-reconnecting')).toBeTruthy();
  });

  it('shows an error when the realtime connection is unavailable', async () => {
    await render(<RealtimeStatusNotice status="offline" />);
    expect(screen.getByTestId('realtime-status-offline')).toBeTruthy();
  });

  it.each(['connecting', 'connected'] as const)('stays quiet while %s', async (status) => {
    await render(<RealtimeStatusNotice status={status} />);
    expect(screen.queryByTestId('realtime-status-reconnecting')).toBeNull();
    expect(screen.queryByTestId('realtime-status-offline')).toBeNull();
  });
});
