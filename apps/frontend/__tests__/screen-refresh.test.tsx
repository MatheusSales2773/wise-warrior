import { act, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { Screen } from '@/design-system/components/screen';
import { theme } from '@/design-system';

describe('Screen refresh control', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: originalPlatform });
  });

  it('keeps the refresh control controlled and invokes the supplied callback', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const onRefresh = jest.fn();
    await render(<Screen title="Acampamento" testID="screen" refreshing={true} onRefresh={onRefresh}><></></Screen>);

    const scroll = screen.getByTestId('screen-scroll');
    expect(scroll.props.refreshControl.props.refreshing).toBe(true);
    expect(scroll.props.refreshControl.props.onRefresh).toBe(onRefresh);
    await act(() => scroll.props.refreshControl.props.onRefresh());
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('draws the pull-to-refresh spinner in the accent gold so it stays visible on the dark background', async () => {
    await render(<Screen title="Acampamento" testID="screen" refreshing={false} onRefresh={jest.fn()}><></></Screen>);

    const { props } = screen.getByTestId('screen-scroll').props.refreshControl;
    expect(props.tintColor).toBe(theme.color.accentPrimary);
    expect(props.colors).toEqual([theme.color.accentPrimary]);
    expect(props.progressBackgroundColor).toBe(theme.color.surfaceCard);
  });

  it('does not attach a refresh control when refresh props are omitted', async () => {
    await render(<Screen title="Acampamento" testID="screen"><></></Screen>);
    expect(screen.getByTestId('screen-scroll').props.refreshControl).toBeUndefined();
  });
});
