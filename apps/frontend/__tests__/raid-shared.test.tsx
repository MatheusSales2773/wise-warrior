import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import type { ActiveRaid } from '@/features/guild/api';
import { AttackButton, JoinRaidButton, TimePill } from '@/features/guild/raid-shared';
import { useRaidTimeLeft } from '@/features/guild/use-raid-clock';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-10-07T12:00:00.000Z').getTime();

const raid = (overrides: Partial<ActiveRaid> = {}): ActiveRaid => ({
  id: 'r1',
  mission: { slug: 'vigilia-da-aurora', name: 'Vigília da Aurora', description: 'Madrugue com a guilda.', imageUrl: null },
  rewards: [],
  coins: 50,
  party: [],
  goalXp: 120_000,
  progressXp: 0,
  regeneratedXp: 0,
  healthXp: 120_000,
  furyPercent: 5,
  startsAt: new Date(NOW - 3 * 24 * HOUR).toISOString(),
  endsAt: new Date(NOW + 2 * HOUR).toISOString(),
  status: 'active',
  goalReachedAt: null,
  weekDays: [],
  today: '2026-10-07',
  studyDays: [],
  streak: 0,
  me: { participating: false, contributionXp: 0, position: null },
  lastHit: null,
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

describe('useRaidTimeLeft', () => {
  it('counts down to the end of the Raid and keeps ticking', async () => {
    const { result } = await renderHook(() => useRaidTimeLeft(raid()));
    expect(result.current).toBe(2 * HOUR);

    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(result.current).toBe(2 * HOUR - 30_000);
  });

  it('goes negative once the Raid is over', async () => {
    const { result } = await renderHook(() => useRaidTimeLeft(raid({ endsAt: new Date(NOW - 1000).toISOString() })));
    expect(result.current).toBe(-1000);
  });
});

describe('TimePill', () => {
  it('is found by the Raid screen test id by default', async () => {
    await render(<TimePill compact={false} raid={raid()} />);
    expect(screen.getByTestId('raid-time-left')).toBeTruthy();
  });

  it('takes the test id of the screen that mounts it', async () => {
    await render(<TimePill compact raid={raid()} testID="guild-raid-clock" />);
    expect(screen.getByTestId('guild-raid-clock')).toBeTruthy();
    expect(screen.queryByTestId('raid-time-left')).toBeNull();
  });

  it('says the Raid is ending once the time is up', async () => {
    await render(<TimePill compact={false} raid={raid({ endsAt: new Date(NOW - 1000).toISOString() })} />);
    expect(screen.getByTestId('raid-time-left').props.children).toBe('Encerrando…');
  });
});

describe('AttackButton', () => {
  it('is enabled while the Raid is active', async () => {
    await render(<AttackButton raid={raid()} />);
    expect(screen.getByTestId('raid-attack').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('is disabled when the Raid is no longer active', async () => {
    await render(<AttackButton raid={raid({ status: 'expired' })} />);
    expect(screen.getByTestId('raid-attack').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('locks itself when the clock reaches the end of the Raid', async () => {
    await render(<AttackButton raid={raid({ endsAt: new Date(NOW + 10_000).toISOString() })} />);
    expect(screen.getByTestId('raid-attack').props.accessibilityState).toMatchObject({ disabled: false });

    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(screen.getByTestId('raid-attack').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('JoinRaidButton', () => {
  it('says "Participar" by default and calls onPress', async () => {
    const onPress = jest.fn();
    await render(<JoinRaidButton loading={false} onPress={onPress} testID="join" />);

    await fireEvent.press(screen.getByTestId('join'));
    expect(screen.getByText('Participar')).toBeTruthy();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('takes the label of the screen that mounts it', async () => {
    await render(<JoinRaidButton label="Participar da Raid" loading={false} onPress={jest.fn()} testID="join" />);
    expect(screen.getByText('Participar da Raid')).toBeTruthy();
  });

  it('does not call onPress while loading', async () => {
    const onPress = jest.fn();
    await render(<JoinRaidButton loading onPress={onPress} testID="join" />);

    await fireEvent.press(screen.getByTestId('join'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
