import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/core/api/api-error';
import { LogoutAction } from '@/design-system/navigation/LogoutAction';

describe('LogoutAction', () => {
  it('prevents duplicate activation while logout is pending', async () => {
    let resolveLogout: () => void = () => undefined;
    const logoutPromise = new Promise<void>((resolve) => {
      resolveLogout = resolve;
    });
    const onLogout = jest.fn(() => logoutPromise);
    await render(<LogoutAction onLogout={onLogout} />);

    const button = screen.getByRole('button', { name: 'Sair' });
    const firstPress = fireEvent.press(button);
    await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
    await fireEvent.press(button);

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });

    await act(async () => {
      resolveLogout();
      await Promise.all([logoutPromise, firstPress]);
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sair' }).props.accessibilityState).toMatchObject({
      busy: false,
      disabled: false,
    }));
  });

  it('keeps the action available and offers a retry after a failed logout', async () => {
    const onLogout = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockResolvedValueOnce(undefined);
    await render(<LogoutAction onLogout={onLogout} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));

    expect(screen.getByTestId('logout-error')).toBeTruthy();
    expect(screen.getByText('Não foi possível sair agora. Sua sessão continua ativa; verifique sua conexão e tente novamente.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sair' }).props.accessibilityState).toMatchObject({
      busy: false,
      disabled: false,
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(2));
  });
});
