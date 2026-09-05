import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { WiseField } from '@/design-system/components/WiseField';
import { theme } from '@/design-system/tokens/theme';

describe('WiseField', () => {
  it('keeps a stable label/input association as error replaces help and then clears', async () => {
    const view = await render(<WiseField label="E-mail" helpText="Use seu endereço pessoal" />);
    const input = screen.getByLabelText('E-mail');
    const id = input.props.nativeID;
    expect(id).toBeTruthy();
    expect(input.props['aria-labelledby']).toBe(screen.getByText('E-mail').props.nativeID);
    expect(input.props.accessibilityHint).toBe('Use seu endereço pessoal');
    expect(input.props['aria-describedby']).toBe(screen.getByText('Use seu endereço pessoal').props.nativeID);

    await view.rerender(<WiseField label="E-mail" helpText="Use seu endereço pessoal" error="Endereço inválido" />);
    const invalid = screen.getByLabelText('E-mail');
    expect(invalid.props.nativeID).toBe(id);
    expect(invalid.props['aria-invalid']).toBe(true);
    expect(invalid.props.accessibilityHint).toBe('Erro: Endereço inválido');
    expect(screen.queryByText('Use seu endereço pessoal')).toBeNull();
    const error = screen.getByRole('alert');
    expect(error.props.nativeID).toBe(invalid.props['aria-describedby']);
    expect(error.props.accessibilityLabel).toContain('Endereço inválido');
    expect(screen.getByText('×', { includeHiddenElements: true })).toBeTruthy();

    await view.rerender(<WiseField label="E-mail" />);
    expect(screen.getByLabelText('E-mail').props.nativeID).toBe(id);
    expect(screen.getByLabelText('E-mail').props['aria-invalid']).toBe(false);
    expect(screen.getByLabelText('E-mail').props['aria-describedby']).toBeUndefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('forwards keyboard, autofill, security and editing props without inventing validation', async () => {
    const onChangeText = jest.fn();
    await render(<WiseField nativeID="password" label="Senha" keyboardType="default" autoComplete="new-password" autoCapitalize="none" secureTextEntry value="" onChangeText={onChangeText} />);
    const input = screen.getByLabelText('Senha');
    expect(input.props).toMatchObject({ nativeID: 'password', keyboardType: 'default', autoComplete: 'new-password', autoCapitalize: 'none', secureTextEntry: true, value: '' });
    await fireEvent.changeText(input, 'segredo');
    expect(onChangeText).toHaveBeenCalledWith('segredo');
    expect(input.props['aria-invalid']).toBe(false);
  });

  it('gives separate instances distinct identifiers and preserves an explicit identifier', async () => {
    await render(<><WiseField label="Nome" /><WiseField label="Sobrenome" /><WiseField label="Apelido" nativeID="nickname" /></>);
    const identifiers = ['Nome', 'Sobrenome', 'Apelido'].map((name) => screen.getByLabelText(name).props.nativeID);
    expect(new Set(identifiers).size).toBe(3);
    expect(identifiers[2]).toBe('nickname');
  });

  it('shows gold Web focus, retains a 44px target and forwards focus callbacks', async () => {
    const platform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    try {
      await render(<WiseField label="Nome" onFocus={onFocus} onBlur={onBlur} />);
      await fireEvent(screen.getByLabelText('Nome'), 'focus', { nativeEvent: {} });
      expect(StyleSheet.flatten(screen.getByLabelText('Nome').props.style)).toMatchObject({ minHeight: 44, minWidth: 44, outlineWidth: 2, outlineColor: theme.color.accentPrimary });
      expect(onFocus).toHaveBeenCalledTimes(1);
      await fireEvent(screen.getByLabelText('Nome'), 'blur', { nativeEvent: {} });
      expect(StyleSheet.flatten(screen.getByLabelText('Nome').props.style).outlineWidth).toBeUndefined();
      expect(onBlur).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
    }
  });
});
