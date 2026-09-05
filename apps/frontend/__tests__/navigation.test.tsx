import { act } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { useState } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { AppNavigation, restoreNavigationTriggerFocus } from '@/design-system/components/AppNavigation';
import { AppShellFrame } from '@/design-system/components/AppShell';
import { isDesktopLayout } from '@/design-system/tokens/layout';
import { modalAnimationType, MoreMenu } from '@/design-system/navigation/MoreMenu';
import { render } from '@testing-library/react-native';
import { theme } from '@/design-system/tokens/theme';

const originalPlatform = Platform.OS;
const originalWindow = Dimensions.get('window');
const originalScreen = Dimensions.get('screen');

async function setViewport(platform: 'web' | 'ios' | 'android', width: number) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  await act(() => {
    Dimensions.set({
      window: { ...originalWindow, width },
      screen: { ...originalScreen, width },
    });
  });
}

afterEach(async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  await act(() => {
    Dimensions.set({ window: originalWindow, screen: originalScreen });
  });
});

describe('adaptive application navigation', () => {
  it('disables modal animation when the runtime duration is reduced to zero', () => {
    expect(modalAnimationType(theme.motion.none)).toBe('none');
    expect(modalAnimationType(theme.motion.standard)).toBe('slide');
  });

  it('returns web focus to the navigation trigger after the modal closes', () => {
    const focus = jest.fn();
    restoreNavigationTriggerFocus({ focus } as never, 'web');
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('renders the desktop sidebar at 900px with one active real destination and inert future items', async () => {
    expect(isDesktopLayout('web', 899)).toBe(false);
    expect(isDesktopLayout('web', 900)).toBe(true);
    expect(isDesktopLayout('ios', 1200)).toBe(false);
    const router = renderRouter(
      {
        index: () => (
          <AppNavigation bottomInset={0} isDesktop modalVisible={false} onModalVisibilityChange={jest.fn()} pathname="/sessao" />
        ),
      },
      { initialUrl: '/' },
    );
    await router;

    expect(screen.getByTestId('web-sidebar')).toBeTruthy();
    expect(screen.queryByTestId('mobile-navigation')).toBeNull();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(links.filter((link) => link.props.accessibilityState?.selected)).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Forja' }).props.accessibilityState.selected).toBe(true);

    for (const label of ['Mercado Arcano', 'Crônicas', 'Configuração']) {
      const item = screen.getByLabelText(`${label}, indisponível, em breve`);
      expect(item.props.onPress).toBeUndefined();
      expect(item.props.href).toBeUndefined();
      expect(item.props.focusable).toBe(false);
    }
  });

  it('switches only the navigation at 899/900 without changing pathname or remounting route content', async () => {
    function StatefulContent() {
      const [count, setCount] = useState(0);
      return <Pressable accessibilityRole="button" accessibilityLabel={`Estado ${count}`} onPress={() => setCount((value) => value + 1)}><Text>Conteúdo</Text></Pressable>;
    }
    function ResizeHarness() {
      const [desktop, setDesktop] = useState(false);
      return (
        <AppShellFrame insets={{ top: 0, right: 0, bottom: 0, left: 0 }} isDesktop={desktop} pathname="/perfil">
          <StatefulContent />
          <Pressable accessibilityRole="button" accessibilityLabel="Redimensionar" onPress={() => setDesktop(true)}><Text>Resize</Text></Pressable>
        </AppShellFrame>
      );
    }
    const router = renderRouter({ index: ResizeHarness }, { initialUrl: '/' });
    await router;

    expect(screen.getByTestId('mobile-navigation')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Estado 0' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Redimensionar' }));

    expect(screen.getByTestId('web-sidebar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Estado 1' })).toBeTruthy();
    expect(router).toHavePathname('/');
  });

  it('navigates to all real destinations from the mobile bar with 44px targets', async () => {
    await setViewport('ios', 1200);
    const router = renderRouter('src/app', { initialUrl: '/' });
    await router;

    expect(screen.getByTestId('mobile-navigation')).toBeTruthy();
    expect(screen.queryByTestId('web-sidebar')).toBeNull();
    for (const label of ['Acampamento', 'Forja', 'Personagem', 'Guilda', 'Mais']) {
      const target = screen.getByRole(label === 'Mais' ? 'button' : 'link', { name: label });
      expect(StyleSheet.flatten(target.props.style)).toMatchObject({
        minHeight: theme.layout.touchTarget,
        minWidth: theme.layout.touchTarget,
      });
    }

    const forgeLink = screen.getByRole('link', { name: 'Forja' });
    await fireEvent(forgeLink, 'pressIn');
    expect(StyleSheet.flatten(forgeLink.props.style).backgroundColor).toBe(theme.color.surfaceCard);
    await fireEvent(forgeLink, 'pressOut');

    await fireEvent.press(screen.getByRole('link', { name: 'Guilda' }));
    await waitFor(() => expect(router).toHavePathname('/guilda'));
  });

  it('dismisses Mais when resize switches to the desktop sidebar', async () => {
    let showDesktop: () => void = () => undefined;
    function ModalResizeHarness() {
      const [desktop, setDesktop] = useState(false);
      showDesktop = () => setDesktop(true);
      return (
        <AppShellFrame insets={{ top: 0, right: 0, bottom: 0, left: 0 }} isDesktop={desktop} pathname="/">
          <Text>Conteúdo preservado</Text>
        </AppShellFrame>
      );
    }
    const router = renderRouter({ index: ModalResizeHarness }, { initialUrl: '/' });
    await router;
    await fireEvent.press(screen.getByRole('button', { name: 'Mais' }));
    expect(screen.getByTestId('more-modal')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('more-sheet').props.style).paddingBottom).toBe(theme.space.controlInset);

    await act(() => showDesktop());

    await waitFor(() => expect(screen.queryByTestId('more-modal')).toBeNull());
    expect(screen.getByTestId('web-sidebar')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('app-route-content').props.style).pointerEvents).toBe('auto');
  });

  it('opens and closes Mais without changing URL and exposes no action for future destinations', async () => {
    await setViewport('android', 390);
    const router = renderRouter('src/app', { initialUrl: '/guilda' });
    await router;

    await fireEvent.press(screen.getByRole('button', { name: 'Mais' }));
    expect(screen.getByTestId('more-modal')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('more-navigation-icon', { includeHiddenElements: true }).props.style).color).toBe(theme.color.accentHighlight);
    expect(screen.getByRole('header', { name: 'Mais' })).toBeTruthy();
    expect(router).toHavePathname('/guilda');
    expect(StyleSheet.flatten(screen.getByTestId('app-route-content', { includeHiddenElements: true }).props.style).pointerEvents).toBe('none');
    expect(screen.getByTestId('mobile-navigation', { includeHiddenElements: true }).props['aria-hidden']).toBe(true);

    for (const label of ['Mercado Arcano', 'Crônicas', 'Configuração']) {
      const item = screen.getByLabelText(`${label}, indisponível, em breve`);
      expect(item.props.accessibilityState).toEqual({ disabled: true });
      expect(item.props.onPress).toBeUndefined();
      expect(item.props.focusable).toBe(false);
    }

    await fireEvent(screen.getByTestId('more-modal'), 'requestClose');
    await waitFor(() => expect(screen.queryByTestId('more-modal')).toBeNull());
    expect(router).toHavePathname('/guilda');

    await fireEvent.press(screen.getByRole('button', { name: 'Mais' }));
    await fireEvent.press(screen.getByTestId('more-backdrop', { includeHiddenElements: true }));
    await waitFor(() => expect(screen.queryByTestId('more-modal')).toBeNull());

    await fireEvent.press(screen.getByRole('button', { name: 'Mais' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByTestId('more-modal')).toBeNull());
  });

  it('closes the web modal with Escape and unregisters the listener', async () => {
    const listeners = new Map<string, (event: KeyboardEvent) => void>();
    const documentMock = {
      addEventListener: jest.fn((name: string, listener: (event: KeyboardEvent) => void) => listeners.set(name, listener)),
      removeEventListener: jest.fn((name: string) => listeners.delete(name)),
    };
    const originalDocument = global.document;
    Object.defineProperty(global, 'document', { configurable: true, value: documentMock });
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const onClose = jest.fn();

    try {
      const view = await render(<MoreMenu bottomInset={34} onClose={onClose} visible />);
      expect(StyleSheet.flatten(screen.getByTestId('more-sheet').props.style).paddingBottom).toBe(theme.space.controlInset + 34);
      listeners.get('keydown')?.({ key: 'Escape' } as KeyboardEvent);
      expect(onClose).toHaveBeenCalledTimes(1);
      await view.unmount();
      expect(documentMock.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    } finally {
      Object.defineProperty(global, 'document', { configurable: true, value: originalDocument });
    }
  });
});
