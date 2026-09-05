import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { WiseButton } from '@/design-system/components/WiseButton';
import { theme } from '@/design-system/tokens/theme';

describe('WiseButton', () => {
  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)('%s supports activation and blocks disabled/loading actions without replacing its label or geometry', async (variant) => {
    const onPress = jest.fn();
    const view = await render(<WiseButton label="Salvar" variant={variant} onPress={onPress} />);
    const initial = StyleSheet.flatten(screen.getByRole('button', { name: 'Salvar' }).props.style);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    for (const state of [{ disabled: true }, { loading: true }, { disabled: true, loading: true }]) {
      await view.rerender(<WiseButton label="Salvar" variant={variant} onPress={onPress} {...state} />);
      const button = screen.getByRole('button', { name: 'Salvar' });
      expect(button).toBeDisabled();
      expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: !!state.loading });
      expect(screen.getByText('Salvar')).toBeVisible();
      const style = StyleSheet.flatten(button.props.style);
      for (const key of ['minWidth', 'minHeight', 'paddingHorizontal', 'paddingVertical']) {
        expect(style[key]).toEqual(initial[key]);
      }
      await fireEvent.press(button);
      expect(onPress).toHaveBeenCalledTimes(1);
    }
    await view.rerender(<WiseButton label="Salvar" variant={variant} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it.each(['medium', 'large'] as const)('%s has a physical 44 by 44 target without overlapping hitSlop', async (size) => {
    await render(<WiseButton label="OK" size={size} onPress={jest.fn()} />);
    const button = screen.getByRole('button');
    const style = StyleSheet.flatten(button.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(button.props.hitSlop).toBeUndefined();
  });

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)('%s exposes hover, press and gold Web focus feedback', async (variant) => {
    const platform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    try {
      await render(<WiseButton label="Continuar" variant={variant} onPress={jest.fn()} />);
      const style = () => StyleSheet.flatten(screen.getByRole('button').props.style);
      const idle = style();
      await fireEvent(screen.getByRole('button'), 'hoverIn');
      expect(style()).not.toEqual(idle);
      await fireEvent(screen.getByRole('button'), 'hoverOut');
      expect(style()).toEqual(idle);
      await fireEvent(screen.getByRole('button'), 'pressIn');
      expect(style()).not.toEqual(idle);
      await fireEvent(screen.getByRole('button'), 'pressOut');
      expect(style()).toEqual(idle);
      await fireEvent(screen.getByRole('button'), 'focus');
      expect(style()).toMatchObject({ outlineWidth: 2, outlineColor: theme.color.accentPrimary, outlineStyle: 'solid' });
      await fireEvent(screen.getByRole('button'), 'blur');
      expect(style()).toEqual(idle);
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
    }
  });
});
