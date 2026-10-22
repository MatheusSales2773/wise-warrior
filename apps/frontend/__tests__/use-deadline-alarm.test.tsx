import { renderHook } from '@testing-library/react-native';
import { useDeadlineAlarm } from '@/features/study-session/use-deadline-alarm';
import { playSessionSound } from '@/features/study-session/sounds';

jest.mock('@/features/study-session/sounds', () => ({ playSessionSound: jest.fn() }));

const T0 = new Date('2026-09-22T12:00:00.000Z').getTime();
const play = playSessionSound as jest.Mock;
type Props = { key: string | null; atMs: number | null };
const useAlarm = (props: Props) => useDeadlineAlarm({ ...props, sound: 'focusEnd' });

beforeEach(() => {
  jest.useFakeTimers({ now: T0 });
  jest.clearAllMocks();
});

it('rings once, in a loop, when the deadline arrives', async () => {
  const hook = await renderHook(useAlarm, { initialProps: { key: 's1', atMs: T0 + 10_000 } });

  jest.advanceTimersByTime(9_999);
  expect(play).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  await hook.rerender({ key: 's1', atMs: T0 + 10_000 });
  jest.advanceTimersByTime(60_000);

  expect(play).toHaveBeenCalledTimes(1);
  expect(play).toHaveBeenCalledWith('focusEnd', { loop: true });
});

it('stays silent for a deadline already past when first seen', async () => {
  await renderHook(useAlarm, { initialProps: { key: 's1', atMs: T0 - 1 } });
  jest.advanceTimersByTime(60_000);

  expect(play).not.toHaveBeenCalled();
});

it('rearms for a new deadline and a new key, and disarms on null', async () => {
  const hook = await renderHook(useAlarm, { initialProps: { key: 's1', atMs: T0 + 10_000 } });
  await hook.rerender({ key: 's1', atMs: T0 + 30_000 });
  jest.advanceTimersByTime(10_000);
  expect(play).not.toHaveBeenCalled();
  jest.advanceTimersByTime(20_000);
  expect(play).toHaveBeenCalledTimes(1);

  await hook.rerender({ key: 's2', atMs: T0 + 50_000 });
  jest.advanceTimersByTime(20_000);
  expect(play).toHaveBeenCalledTimes(2);

  await hook.rerender({ key: null, atMs: null });
  jest.advanceTimersByTime(60_000);
  expect(play).toHaveBeenCalledTimes(2);
});

it('cancels the timer on unmount', async () => {
  const hook = await renderHook(useAlarm, { initialProps: { key: 's1', atMs: T0 + 10_000 } });
  await hook.unmount();
  jest.advanceTimersByTime(60_000);

  expect(play).not.toHaveBeenCalled();
});
