import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet, Text } from 'react-native';
import { ResourcePill } from '@/design-system/components/ResourcePill';

describe('ResourcePill', () => {
  it('renders a noninteractive label and optional decorative icon by default', async () => {
    await render(<ResourcePill label="Disponível" icon={<Text>✓</Text>} testID="pill" />);
    expect(screen.getByText('Disponível')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('pill').props.onPress).toBeUndefined();
    expect(screen.queryByText('✓')).toBeNull();
    expect(screen.getByText('✓', { includeHiddenElements: true })).toBeTruthy();
  });

  it('becomes a named button with a 44px target only when given an action', async () => {
    const onPress = jest.fn();
    await render(<ResourcePill label="Disponível" accessibilityLabel="Ver disponibilidade" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Ver disponibilidade' });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ minHeight: 44, minWidth: 44 });
    expect(button.props.hitSlop).toBeUndefined();
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('rejects an interactive pill without an accessible name, including blank names', async () => {
    await expect(render(<ResourcePill label="Disponível" onPress={jest.fn()} accessibilityLabel=" " />)).rejects.toThrow(/accessible label/);
  });

  it('shows Web focus and hover/pressed states and clears them after interaction', async () => {
    const platform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    try {
      await render(<ResourcePill label="Disponível" accessibilityLabel="Ver disponibilidade" onPress={jest.fn()} />);
      const style = () => StyleSheet.flatten(screen.getByRole('button').props.style);
      const idle = style();
      for (const [enter, leave] of [['hoverIn', 'hoverOut'], ['pressIn', 'pressOut']] as const) {
        await fireEvent(screen.getByRole('button'), enter);
        expect(style()).not.toEqual(idle);
        await fireEvent(screen.getByRole('button'), leave);
        expect(style()).toEqual(idle);
      }
      await fireEvent(screen.getByRole('button'), 'focus');
      expect(style()).toMatchObject({ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '#d4a85a' });
      await fireEvent(screen.getByRole('button'), 'blur');
      expect(style()).toEqual(idle);
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
    }
  });
});
