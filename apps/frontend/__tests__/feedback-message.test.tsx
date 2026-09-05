import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { FeedbackMessage } from '@/design-system/components/FeedbackMessage';

describe('FeedbackMessage', () => {
  it.each([
    ['info', 'polite', 'ℹ'], ['success', 'polite', '✓'], ['warning', 'polite', '!'], ['error', 'assertive', '×'],
  ] as const)('%s shows a decorative icon and announces the message with %s priority', async (variant, priority, icon) => {
    await render(<FeedbackMessage testID="feedback" variant={variant} title="Resultado" message="Operação concluída" />);
    const feedback = screen.getByTestId('feedback');
    expect(feedback.props['aria-live']).toBe(priority);
    expect(feedback.props.accessibilityLiveRegion).toBe(priority);
    expect(feedback.props.accessibilityRole).toBe(variant === 'error' ? 'alert' : undefined);
    expect(feedback.props.accessibilityLabel).toBe('Resultado. Operação concluída');
    expect(screen.getByText('Resultado')).toBeVisible();
    expect(screen.getByText('Operação concluída')).toBeVisible();
    expect(screen.queryByText(icon)).toBeNull();
    expect(screen.getByText(icon, { includeHiddenElements: true })).toBeTruthy();
    expect(StyleSheet.flatten(feedback.props.style).borderColor).toBeDefined();
  });

  it.each([['info', true], ['error', false]] as const)('announces %s once per message on iOS with queue=%s', async (variant, queue) => {
    const platform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => {});
    announce.mockClear();
    try {
      const view = await render(<FeedbackMessage variant={variant} message="Primeira mensagem" />);
      expect(announce).toHaveBeenLastCalledWith('Primeira mensagem', { queue });
      await view.rerender(<FeedbackMessage variant={variant} message="Primeira mensagem" />);
      expect(announce).toHaveBeenCalledTimes(1);
      await view.rerender(<FeedbackMessage variant={variant} message="Nova mensagem" />);
      expect(announce).toHaveBeenLastCalledWith('Nova mensagem', { queue });
    } finally {
      announce.mockRestore();
      Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
    }
  });
});
