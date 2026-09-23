import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform, StyleSheet } from 'react-native';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';
import { theme } from '@/design-system/tokens/theme';
import {
  getActiveStudySession,
  pauseStudySession,
  resumeStudySession,
  stopStudySession,
  type StudySessionSnapshot,
} from '@/features/study-session/api';
import { dashboardKeys } from '@/features/dashboard/queries';

jest.mock('@/features/study-session/api', () => ({
  STUDY_SESSION_PRESETS: [900, 1500, 3000],
  getActiveStudySession: jest.fn(),
  pauseStudySession: jest.fn(),
  resumeStudySession: jest.fn(),
  stopStudySession: jest.fn(),
  startStudySession: jest.fn(),
}));

const getActive = getActiveStudySession as jest.MockedFunction<typeof getActiveStudySession>;
const pause = pauseStudySession as jest.MockedFunction<typeof pauseStudySession>;
const resume = resumeStudySession as jest.MockedFunction<typeof resumeStudySession>;
const stop = stopStudySession as jest.MockedFunction<typeof stopStudySession>;
const snapshot: StudySessionSnapshot = {
  id: 'study-1', mode: 'solo', subject: null, state: 'running', plannedDurationSeconds: 1500,
  startedAt: '2026-09-22T12:00:00.000Z', runDeadlineAt: '2026-09-22T12:25:00.000Z',
  pausedAt: null, pausedTotalSeconds: 0, durationValidSeconds: 0, remainingSeconds: 1500,
  serverNow: '2026-09-22T12:00:00.000Z', version: 1, endedAt: null, xpAwarded: 0,
  terminalReason: null, discardedReason: null, canControl: true,
  receivedAtMs: new Date('2026-09-22T12:00:00.000Z').getTime(),
};

async function renderStudySession(client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } })) {
  const view = await render(
    <QueryClientProvider client={client}>
      <StudySessionScreen />
    </QueryClientProvider>,
  );
  return { view, client };
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('pauses and resumes from confirmed snapshots using accessible controls', async () => {
  const paused: StudySessionSnapshot = {
    ...snapshot,
    state: 'paused',
    pausedAt: '2026-09-22T12:05:00.000Z',
    remainingSeconds: 1200,
    durationValidSeconds: 300,
    version: 2,
    serverNow: '2026-09-22T12:05:00.000Z',
    receivedAtMs: new Date('2026-09-22T12:05:00.000Z').getTime(),
  };
  const resumed: StudySessionSnapshot = {
    ...paused,
    state: 'running',
    pausedAt: null,
    pausedTotalSeconds: 300,
    runDeadlineAt: '2026-09-22T12:30:00.000Z',
    remainingSeconds: 1200,
    version: 3,
    serverNow: '2026-09-22T12:10:00.000Z',
    receivedAtMs: new Date('2026-09-22T12:10:00.000Z').getTime(),
  };
  getActive.mockResolvedValue(snapshot);
  pause.mockResolvedValue(paused);
  resume.mockResolvedValue(resumed);
  const { view } = await renderStudySession();

  await view.findByTestId('study-session-active');
  await fireEvent.press(view.getByRole('button', { name: 'Pausar sessão' }));
  await waitFor(() => expect(pause).toHaveBeenCalledWith({ id: 'study-1', expectedVersion: 1, idempotencyKey: expect.any(String) }));
  await view.findByTestId('study-session-resume');
  expect(view.getByText('Sessão pausada. O contador está congelado.')).toBeTruthy();
  expect(view.getByTestId('study-session-timer').props.accessibilityLabel).toContain('20 minutos e 0 segundos');

  await fireEvent.press(view.getByRole('button', { name: 'Retomar sessão' }));
  await waitFor(() => expect(resume).toHaveBeenCalledWith({ id: 'study-1', expectedVersion: 2, idempotencyKey: expect.any(String) }));
  await view.findByTestId('study-session-pause');
  expect(view.getByText('Sessão em andamento. O contador está ativo.')).toBeTruthy();
  view.unmount();
});

it('stops with the projected label, shows the confirmed result, then offers a new session', async () => {
  const cancelled: StudySessionSnapshot = {
    ...snapshot, state: 'cancelled', endedAt: '2026-09-22T12:04:59.999Z',
    durationValidSeconds: 299, remainingSeconds: 0, terminalReason: 'manual-stop', version: 2,
    serverNow: '2026-09-22T12:04:59.999Z', receivedAtMs: new Date('2026-09-22T12:04:59.999Z').getTime(),
  };
  getActive.mockResolvedValue(snapshot);
  stop.mockResolvedValue(cancelled);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 30_000 }, mutations: { retry: false, gcTime: 0 } } });
  client.setQueryData(dashboardKeys.profile(), { xpTotal: 0 });
  client.setQueryData(dashboardKeys.recentActivity(), []);
  client.setQueryData(dashboardKeys.metrics(), { sessionsToday: 0 });
  const { view } = await renderStudySession(client);

  await view.findByRole('button', { name: 'Cancelar sessão' });
  await fireEvent.press(view.getByRole('button', { name: 'Cancelar sessão' }));
  await waitFor(() => expect(stop).toHaveBeenCalledWith({ id: 'study-1', expectedVersion: 1, idempotencyKey: expect.any(String) }));
  await view.findByTestId('study-session-result');

  expect(view.getByText('Sessão cancelada')).toBeTruthy();
  expect(view.getByText('Foco válido: 04:59')).toBeTruthy();
  expect(view.getByText('XP confirmado: 0')).toBeTruthy();
  expect(view.queryByTestId('study-session-setup')).toBeNull();
  expect(client.getQueryData(['study-session', 'active'])).toBeNull();
  expect(client.getQueryState(dashboardKeys.profile())?.isInvalidated).toBe(true);
  expect(client.getQueryState(dashboardKeys.recentActivity())?.isInvalidated).toBe(true);
  expect(client.getQueryState(dashboardKeys.metrics())?.isInvalidated).toBe(true);
  await fireEvent.press(view.getByRole('button', { name: 'Nova sessão' }));
  await view.findByTestId('study-session-setup');
  view.unmount();
  client.clear();
});

it('shows the confirmed duration and proportional XP for an early stop', async () => {
  const stoppedEarly: StudySessionSnapshot = {
    ...snapshot, state: 'stopped_early', endedAt: '2026-09-22T12:05:00.000Z',
    durationValidSeconds: 300, remainingSeconds: 0, terminalReason: 'manual-stop',
    xpAwarded: 50, version: 2,
  };
  getActive.mockResolvedValue({
    ...snapshot, remainingSeconds: 1200,
    runDeadlineAt: '2026-09-22T12:20:00.000Z',
    serverNow: '2026-09-22T12:05:00.000Z',
    receivedAtMs: new Date('2026-09-22T12:05:00.000Z').getTime(),
  });
  stop.mockResolvedValue(stoppedEarly);
  const { view } = await renderStudySession();

  await fireEvent.press(await view.findByRole('button', { name: 'Encerrar antecipadamente' }));
  await view.findByTestId('study-session-result');
  expect(view.getByText('Sessão encerrada antecipadamente')).toBeTruthy();
  expect(view.getByText('Foco válido: 05:00')).toBeTruthy();
  expect(view.getByText('XP confirmado: 50')).toBeTruthy();
  view.unmount();
});

it('projects the early-stop label from the server snapshot at the five-minute boundary', async () => {
  getActive.mockResolvedValue({
    ...snapshot, remainingSeconds: 1200,
    runDeadlineAt: '2026-09-22T12:20:00.000Z',
    serverNow: '2026-09-22T12:05:00.000Z',
    receivedAtMs: new Date('2026-09-22T12:05:00.000Z').getTime(),
  });
  const { view } = await renderStudySession();

  await view.findByRole('button', { name: 'Encerrar antecipadamente' });
  view.unmount();
});

it('retries a stop after a lost response with the same idempotency key', async () => {
  const cancelled: StudySessionSnapshot = {
    ...snapshot, state: 'cancelled', endedAt: '2026-09-22T12:04:00.000Z',
    durationValidSeconds: 240, remainingSeconds: 0, version: 2,
  };
  getActive.mockResolvedValue(snapshot);
  stop.mockRejectedValueOnce(new Error('network timeout')).mockResolvedValueOnce(cancelled);
  const { view } = await renderStudySession();

  await view.findByRole('button', { name: 'Cancelar sessão' });
  await fireEvent.press(view.getByRole('button', { name: 'Cancelar sessão' }));
  await view.findByTestId('study-session-transition-error');
  const originalCommand = stop.mock.calls[0];
  await fireEvent.press(view.getByRole('button', { name: 'Tentar encerrar novamente' }));

  await waitFor(() => expect(stop).toHaveBeenCalledTimes(2));
  expect(stop.mock.calls[1]).toEqual(originalCommand);
  await view.findByText('Sessão cancelada');
  view.unmount();
});

it('keeps the last confirmed state and retries a failed transition with the same key', async () => {
  const paused: StudySessionSnapshot = {
    ...snapshot,
    state: 'paused',
    pausedAt: '2026-09-22T12:05:00.000Z',
    remainingSeconds: 1200,
    durationValidSeconds: 300,
    version: 2,
    serverNow: '2026-09-22T12:05:00.000Z',
    receivedAtMs: new Date('2026-09-22T12:05:00.000Z').getTime(),
  };
  let rejectPause!: (reason: Error) => void;
  getActive.mockResolvedValue(snapshot);
  pause
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectPause = reject; }))
    .mockResolvedValueOnce(paused);
  const { view } = await renderStudySession();

  await view.findByTestId('study-session-active');
  await fireEvent.press(view.getByRole('button', { name: 'Pausar sessão' }));
  const busyButton = view.getByTestId('study-session-pause');
  expect(busyButton.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  expect(view.getByTestId('study-session-stop').props.accessibilityState.disabled).toBe(true);
  expect(view.getByText('Pausando sessão. Os controles estão ocupados até a confirmação.')).toBeTruthy();

  await act(async () => rejectPause(new Error('network timeout')));
  await view.findByTestId('study-session-transition-error');
  expect(view.getByText('Sessão em andamento. O contador está ativo.')).toBeTruthy();
  const originalCommand = pause.mock.calls[0];

  await fireEvent.press(view.getByRole('button', { name: 'Tentar pausar novamente' }));
  await waitFor(() => expect(pause).toHaveBeenCalledTimes(2));
  expect(pause.mock.calls[1]).toEqual(originalCommand);
  await view.findByTestId('study-session-resume');
  view.unmount();
});

it('refreshes after a stale-version conflict and discards the obsolete retry', async () => {
  const updatedSnapshot: StudySessionSnapshot = {
    ...snapshot,
    state: 'paused',
    pausedAt: '2026-09-22T12:05:00.000Z',
    remainingSeconds: 1200,
    durationValidSeconds: 300,
    version: 2,
    serverNow: '2026-09-22T12:05:00.000Z',
    receivedAtMs: new Date('2026-09-22T12:05:00.000Z').getTime(),
  };
  let resolveLatest!: (value: StudySessionSnapshot) => void;
  getActive
    .mockResolvedValueOnce(snapshot)
    .mockImplementationOnce(() => new Promise((resolve) => { resolveLatest = resolve; }));
  pause.mockRejectedValue({
    isAxiosError: true,
    response: {
      status: 409,
      data: { type: 'https://wise.app/errors/study-session-version-conflict' },
    },
  });
  const { view } = await renderStudySession();

  await view.findByTestId('study-session-active');
  await fireEvent.press(view.getByRole('button', { name: 'Pausar sessão' }));
  await view.findByTestId('study-session-transition-error');
  await waitFor(() => expect(getActive).toHaveBeenCalledTimes(2));
  expect(view.getByText('Sessão em andamento', { exact: true })).toBeTruthy();
  expect(view.getByTestId('study-session-timer').props.accessibilityLabel).toContain('25 minutos e 0 segundos');
  expect(view.getByRole('button', { name: 'Atualizando estado…' })).toBeDisabled();
  expect(view.queryByRole('button', { name: 'Tentar pausar novamente' })).toBeNull();

  await act(async () => resolveLatest(updatedSnapshot));
  await view.findByRole('button', { name: 'Retomar sessão' });
  expect(view.getByText('A sessão mudou desde a última confirmação.')).toBeTruthy();
  view.unmount();
});

it('restores a paused snapshot without a ticking timer', async () => {
  getActive.mockResolvedValue({
    ...snapshot,
    state: 'paused',
    pausedAt: '2026-09-22T12:05:00.000Z',
    remainingSeconds: 1111,
    durationValidSeconds: 389,
    version: 2,
  });
  const { view } = await renderStudySession();
  const interval = jest.spyOn(global, 'setInterval');

  await view.findByTestId('study-session-active');
  expect(view.getByRole('button', { name: 'Retomar sessão' })).toBeTruthy();
  expect(view.getByTestId('study-session-timer').props.children).toBe('18:31');
  expect(interval).not.toHaveBeenCalledWith(expect.any(Function), 1000);
  view.unmount();
  interval.mockRestore();
});

it('shows a visible keyboard focus ring on duration presets', async () => {
  const originalPlatform = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

  try {
    getActive.mockResolvedValue(null);
    const { view } = await renderStudySession();
    await view.findByTestId('study-session-setup');
    await fireEvent.press(view.getByRole('button', { name: 'Configurar duração' }));
    const preset = view.getByRole('radio', { name: '15 minutos' });
    await fireEvent(preset, 'focus');
    expect(StyleSheet.flatten(preset.props.style)).toMatchObject({
      outlineWidth: theme.border.focus,
      outlineStyle: 'solid',
      outlineColor: theme.color.accentPrimary,
    });
    await fireEvent(preset, 'blur');
    view.unmount();
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  }
});

it('anchors the resumed timer to the latest snapshot after a long pause', async () => {
  const originalPlatform = Platform.OS;
  const startedAt = new Date('2026-09-22T12:00:00.000Z').getTime();
  let localNow = startedAt + 5_000;
  jest.spyOn(Date, 'now').mockImplementation(() => localNow);
  let timerTick: (() => void) | undefined;
  const originalSetInterval = global.setInterval;
  jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void, delay?: number) => {
    if (delay === 1000) {
      timerTick = callback;
      return 123 as unknown as ReturnType<typeof setInterval>;
    }
    return originalSetInterval(callback, delay);
  }) as typeof setInterval);

  try {
    const pausedAt = startedAt + 300_000;
    const resumedAt = startedAt + 3_900_000;
    getActive.mockResolvedValue(snapshot);
    pause.mockResolvedValue({
      ...snapshot,
      state: 'paused',
      pausedAt: new Date(pausedAt).toISOString(),
      durationValidSeconds: 300,
      remainingSeconds: 1200,
      serverNow: new Date(pausedAt).toISOString(),
      receivedAtMs: pausedAt,
      version: 2,
    });
    resume.mockResolvedValue({
      ...snapshot,
      state: 'running',
      pausedTotalSeconds: 3600,
      durationValidSeconds: 300,
      remainingSeconds: 1200,
      runDeadlineAt: new Date(resumedAt + 1_200_000).toISOString(),
      serverNow: new Date(resumedAt).toISOString(),
      receivedAtMs: resumedAt,
      version: 3,
    });
    const { view } = await renderStudySession();

    await view.findByTestId('study-session-active');
    await act(() => timerTick?.());

    await fireEvent.press(view.getByRole('button', { name: 'Pausar sessão' }));
    await view.findByTestId('study-session-resume');
    localNow = resumedAt;
    await fireEvent.press(view.getByRole('button', { name: 'Retomar sessão' }));
    await view.findByTestId('study-session-pause');
    expect(view.getByTestId('study-session-timer').props.children).toBe('20:00');
    view.unmount();
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  }
});
