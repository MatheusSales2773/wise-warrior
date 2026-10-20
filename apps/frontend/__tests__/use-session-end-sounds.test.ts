import { renderHook } from '@testing-library/react-native';
import { useSessionEndSounds } from '@/features/study-session/use-session-end-sounds';
import { playSessionSound, releaseSessionSounds } from '@/features/study-session/sounds';

jest.mock('@/features/study-session/sounds', () => ({ playSessionSound: jest.fn(), releaseSessionSounds: jest.fn() }));

type Props = { breakRemaining: number | null; completedSessionId: string | null };
const idle: Props = { breakRemaining: null, completedSessionId: null };
const play = playSessionSound as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('rings the break cue when a watched break reaches zero, once', async () => {
  const hook = await renderHook((props: Props) => useSessionEndSounds(props), { initialProps: { ...idle, breakRemaining: 2 } });

  await hook.rerender({ ...idle, breakRemaining: 1 });
  expect(play).not.toHaveBeenCalled();
  await hook.rerender({ ...idle, breakRemaining: 0 });
  await hook.rerender({ ...idle, breakRemaining: 0 });

  expect(play).toHaveBeenCalledTimes(1);
  expect(play).toHaveBeenCalledWith('breakEnd');
});

it('stays silent for a break that already ended before mounting', async () => {
  await renderHook((props: Props) => useSessionEndSounds(props), { initialProps: { ...idle, breakRemaining: 0 } });

  expect(play).not.toHaveBeenCalled();
});

it('stays silent when a running break is skipped', async () => {
  const hook = await renderHook((props: Props) => useSessionEndSounds(props), { initialProps: { ...idle, breakRemaining: 120 } });

  await hook.rerender(idle);

  expect(play).not.toHaveBeenCalled();
});

it('rings again for a second break that runs out', async () => {
  const hook = await renderHook((props: Props) => useSessionEndSounds(props), { initialProps: { ...idle, breakRemaining: 1 } });
  await hook.rerender({ ...idle, breakRemaining: 0 });
  await hook.rerender(idle);
  await hook.rerender({ ...idle, breakRemaining: 300 });
  await hook.rerender({ ...idle, breakRemaining: 0 });

  expect(play).toHaveBeenCalledTimes(2);
});

it('rings the focus cue when a session completes while watching, once', async () => {
  const hook = await renderHook((props: Props) => useSessionEndSounds(props), { initialProps: idle });

  await hook.rerender({ ...idle, completedSessionId: 'study-1' });
  await hook.rerender({ ...idle, completedSessionId: 'study-1' });

  expect(play).toHaveBeenCalledTimes(1);
  expect(play).toHaveBeenCalledWith('focusEnd');
});

it('stays silent for a result that was already there at mount', async () => {
  await renderHook((props: Props) => useSessionEndSounds(props), { initialProps: { ...idle, completedSessionId: 'study-1' } });

  expect(play).not.toHaveBeenCalled();
});

it('releases the players on unmount', async () => {
  const hook = await renderHook((props: Props) => useSessionEndSounds(props), { initialProps: idle });

  await hook.unmount();

  expect(releaseSessionSounds).toHaveBeenCalledTimes(1);
});
