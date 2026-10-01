import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { getMyProfile, type UserProfile } from '@/features/dashboard/api';
import { listMyDeviceSessions, type DeviceSession } from '@/features/profile/api';
import { describeDevice, formatPlanTier } from '@/features/profile/formatters';
import { ProfileScreen } from '@/features/profile/profile-screen';
import { updateMockAuthState } from '../test-utils/auth-context';

jest.mock('@/core/auth/auth-context', () => require('../test-utils/auth-context').createAuthContextMock());
jest.mock('@/features/dashboard/api', () => ({
  getMyProfile: jest.fn(),
  getRecentStudySessions: jest.fn(),
  getSessionMetrics: jest.fn(),
}));
jest.mock('@/features/profile/api', () => ({ listMyDeviceSessions: jest.fn() }));

const profile: UserProfile = {
  id: 'user-1', email: 'wise@example.com', displayName: 'Aventureiro', planTier: 'free',
  level: 3, levelStartXp: 100, nextLevelXp: 200, xpTotal: 150, title: 'Aprendiz',
};
const devices: DeviceSession[] = [
  { id: 'dev-1', deviceLabel: 'iPhone de Ana', userAgent: null, createdAt: '2026-09-01T10:00:00Z', lastUsedAt: '2026-09-20T10:00:00Z' },
  { id: 'dev-2', deviceLabel: null, userAgent: 'Mozilla/5.0 (Windows NT 10.0)', createdAt: '2026-09-02T10:00:00Z', lastUsedAt: '2026-09-18T10:00:00Z' },
];

const mockedProfile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const mockedDevices = listMyDeviceSessions as jest.MockedFunction<typeof listMyDeviceSessions>;

async function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><ProfileScreen /></QueryClientProvider>);
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
  updateMockAuthState({ status: 'authenticated', sessionId: 'dev-1' });
});

afterEach(() => jest.clearAllMocks());

describe('ProfileScreen', () => {
  it('shows the character, level progression and the current device', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedDevices.mockResolvedValue(devices);
    await renderProfile();

    expect(await screen.findByText('Aventureiro')).toBeTruthy();
    expect(screen.getByTestId('profile-character-title').props.children).toBe('Aprendiz');
    expect(screen.getByText('Nível 3')).toBeTruthy();
    expect(screen.getByText('Faltam 50 XP para o nível 4')).toBeTruthy();
    expect(screen.getByTestId('profile-plan').props.children).toBe('PLANO GRATUITO');

    expect(await screen.findByTestId('profile-device-dev-1')).toBeTruthy();
    expect(screen.getByTestId('profile-device-current-dev-1')).toBeTruthy();
    expect(screen.queryByTestId('profile-device-current-dev-2')).toBeNull();
    expect(screen.getByText('Navegador no computador')).toBeTruthy();
  });

  it('falls back to a placeholder title when the character has none', async () => {
    mockedProfile.mockResolvedValue({ ...profile, title: null });
    mockedDevices.mockResolvedValue([]);
    await renderProfile();

    expect(await screen.findByText('Sem título ainda')).toBeTruthy();
    expect(await screen.findByText('Nenhum dispositivo com sessão ativa.')).toBeTruthy();
  });

  it('shows a retryable error when the profile cannot be loaded', async () => {
    mockedProfile.mockRejectedValueOnce(new Error('boom'));
    mockedDevices.mockResolvedValue(devices);
    await renderProfile();

    expect(await screen.findByTestId('profile-error')).toBeTruthy();
    mockedProfile.mockResolvedValue(profile);
    fireEvent.press(screen.getByLabelText('Tentar novamente'));
    expect(await screen.findByText('Aventureiro')).toBeTruthy();
  });

  it('keeps the character visible when only the device list fails', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedDevices.mockRejectedValue(new Error('boom'));
    await renderProfile();

    expect(await screen.findByText('Aventureiro')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('profile-devices-error')).toBeTruthy());
  });
});

describe('profile formatters', () => {
  it('describes plans and devices', () => {
    expect(formatPlanTier('premium')).toBe('Plano premium');
    expect(formatPlanTier('free')).toBe('Plano gratuito');
    expect(describeDevice({ deviceLabel: ' Pixel ', userAgent: null })).toBe('Pixel');
    expect(describeDevice({ deviceLabel: null, userAgent: 'Dalvik Android 14' })).toBe('Dispositivo Android');
    expect(describeDevice({ deviceLabel: null, userAgent: null })).toBe('Dispositivo desconhecido');
  });
});
