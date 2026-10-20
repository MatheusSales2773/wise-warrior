import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { ApiError } from '@/core/api/api-error';
import {
  chooseNextMission, getNextMission, listAvailableMissions,
  type AvailableMission, type NextMissionChoice,
} from '@/features/guild/api';
import { NextRaidCard } from '@/features/guild/mission-choice';

configure({ asyncUtilTimeout: 5000 });

jest.mock('@/features/guild/api', () => ({
  getNextMission: jest.fn(),
  listAvailableMissions: jest.fn(),
  chooseNextMission: jest.fn(),
}));

const mockedNext = getNextMission as jest.MockedFunction<typeof getNextMission>;
const mockedAvailable = listAvailableMissions as jest.MockedFunction<typeof listAvailableMissions>;
const mockedChoose = chooseNextMission as jest.MockedFunction<typeof chooseNextMission>;

const summary = (id: string, name: string, rotation: boolean) => ({ id, slug: id, name, description: `${name}, em resumo.`, imageUrl: null, rotation });
const rotationMission: AvailableMission = { ...summary('m-rot', 'Vigília da Aurora', true), owners: [] };
const pricedMission: AvailableMission = {
  ...summary('m-priced', 'Ronda Barata', false),
  owners: [{ userId: 'u-bruno', displayName: 'Bruno' }, { userId: 'u-carla', displayName: 'Carla' }],
};
const choice = (mission: AvailableMission, owner: { userId: string; displayName: string } | null): NextMissionChoice => ({
  mission: { id: mission.id, slug: mission.slug, name: mission.name, description: mission.description, imageUrl: null, rotation: mission.rotation },
  owner,
  chosenAt: '2026-10-07T12:00:00Z',
});

async function renderCard(role: 'leader' | 'member', desktop = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><NextRaidCard desktop={desktop} guildId="g1" role={role} /></QueryClientProvider>);
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
  mockedNext.mockResolvedValue(null);
  mockedAvailable.mockResolvedValue([rotationMission, pricedMission]);
});
afterEach(() => { [mockedNext, mockedAvailable, mockedChoose].forEach((mock) => mock.mockReset()); });

describe('Próxima Raid (escolha da Missão)', () => {
  it('says the rotation applies when nobody chose, and offers no way to choose to a member', async () => {
    await renderCard('member');

    expect(await screen.findByTestId('next-raid-rotation')).toHaveTextContent(/vale o rodízio/);
    expect(screen.queryByTestId('next-raid-choose')).toBeNull();
  });

  it('shows the chosen Missão and its owner to a member, who cannot change it', async () => {
    mockedNext.mockResolvedValue(choice(pricedMission, pricedMission.owners[0] ?? null));
    await renderCard('member');

    expect(await screen.findByTestId('next-raid-mission-name')).toHaveTextContent('Ronda Barata');
    expect(screen.getByTestId('next-raid-owner')).toHaveTextContent('Missão de Bruno');
    expect(screen.queryByTestId('next-raid-choose')).toBeNull();
    expect(mockedAvailable).not.toHaveBeenCalled();
  });

  it('labels a chosen rotation Missão as "Missão do rodízio"', async () => {
    mockedNext.mockResolvedValue(choice(rotationMission, null));
    await renderCard('member');

    expect(await screen.findByTestId('next-raid-owner')).toHaveTextContent('Missão do rodízio');
  });

  it('shows a retryable error when the choice cannot be loaded', async () => {
    mockedNext.mockRejectedValueOnce(new Error('boom'));
    await renderCard('member');

    expect(await screen.findByTestId('next-raid-error')).toBeTruthy();
    mockedNext.mockResolvedValue(null);
    await fireEvent.press(screen.getByText('Tentar novamente'));
    expect(await screen.findByTestId('next-raid-rotation')).toBeTruthy();
  });

  describe('gaveta do Líder', () => {
    it('lists every Missão with its owner or "rodízio", and warns that the choice locks when the Raid starts', async () => {
      await renderCard('leader');
      await fireEvent.press(await screen.findByTestId('next-raid-choose'));

      const drawer = await screen.findByTestId('mission-choice-drawer');
      expect(await within(drawer).findByLabelText('Vigília da Aurora, Missão do rodízio')).toBeTruthy();
      expect(within(drawer).getByLabelText('Ronda Barata, Missão de Bruno')).toBeTruthy();
      expect(within(drawer).getByLabelText('Ronda Barata, Missão de Carla')).toBeTruthy();
      expect(within(drawer).getByTestId('mission-choice-lock-notice')).toHaveTextContent(/trava quando a próxima Raid começa/);
      expect(within(drawer).getByText('Confirmar escolha')).toBeDisabled();
    });

    it('saves the Missão with its owner and shows it on the card', async () => {
      mockedChoose.mockResolvedValue(choice(pricedMission, pricedMission.owners[1] ?? null));
      await renderCard('leader');
      await fireEvent.press(await screen.findByTestId('next-raid-choose'));

      await fireEvent.press(await screen.findByLabelText('Ronda Barata, Missão de Carla'));
      await fireEvent.press(screen.getByText('Confirmar escolha'));

      await waitFor(() => expect(mockedChoose).toHaveBeenCalledWith('g1', { missionId: 'm-priced', ownerId: 'u-carla' }));
      expect(await screen.findByTestId('next-raid-owner')).toHaveTextContent('Missão de Carla');
      expect(screen.queryByTestId('mission-choice-drawer')).toBeNull();
    });

    it('sends no owner for a rotation Missão', async () => {
      mockedChoose.mockResolvedValue(choice(rotationMission, null));
      await renderCard('leader');
      await fireEvent.press(await screen.findByTestId('next-raid-choose'));

      await fireEvent.press(await screen.findByLabelText('Vigília da Aurora, Missão do rodízio'));
      await fireEvent.press(screen.getByText('Confirmar escolha'));

      await waitFor(() => expect(mockedChoose).toHaveBeenCalledWith('g1', { missionId: 'm-rot' }));
    });

    it('keeps the drawer open with a message when the choice is refused', async () => {
      mockedChoose.mockRejectedValue(new ApiError('validation', { status: 422 }));
      await renderCard('leader');
      await fireEvent.press(await screen.findByTestId('next-raid-choose'));

      await fireEvent.press(await screen.findByLabelText('Ronda Barata, Missão de Bruno'));
      await fireEvent.press(screen.getByText('Confirmar escolha'));

      expect(await screen.findByTestId('mission-choice-error')).toBeTruthy();
      expect(screen.getByTestId('mission-choice-drawer')).toBeTruthy();
    });

    it('starts with the current choice selected', async () => {
      mockedNext.mockResolvedValue(choice(pricedMission, pricedMission.owners[0] ?? null));
      await renderCard('leader');
      await fireEvent.press(await screen.findByTestId('next-raid-choose'));

      const option = await screen.findByLabelText('Ronda Barata, Missão de Bruno');
      expect(option.props.accessibilityState).toMatchObject({ checked: true });
    });
  });
});
