/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { WiseButton } from '@/design-system/components/WiseButton';
import { WiseField } from '@/design-system/components/WiseField';
import { FeedbackMessage } from '@/design-system/components/FeedbackMessage';
import { ProgressBar } from '@/design-system/components/ProgressBar';
import { ResourcePill } from '@/design-system/components/ResourcePill';

// Exercise the installed Web renderer, including its native-to-DOM prop mapping.
jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn() }));
jest.mock('expo/src/winter/fetch', () => ({ fetch: jest.fn() }));

let container;
let root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
});

it('keeps real DOM label and description references valid when field help becomes an error', async () => {
  await act(() => root.render(<WiseField label="E-mail" helpText="Endereço pessoal" />));
  const input = container.querySelector('input');
  const id = input.id;
  expect(document.getElementById(input.getAttribute('aria-labelledby')).textContent).toBe('E-mail');
  expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toBe('Endereço pessoal');
  await act(() => root.render(<WiseField label="E-mail" helpText="Endereço pessoal" error="Endereço inválido" />));
  expect(input.id).toBe(id);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toContain('Endereço inválido');
  expect(container.textContent).not.toContain('Endereço pessoal');
  await act(() => input.focus());
  expect(getComputedStyle(input).outlineWidth).toBe('2px');
});

it('preserves the Web button name and layout styles, exposes busy/disabled and blocks click and keyboard while loading', async () => {
  const onPress = jest.fn();
  await act(() => root.render(<WiseButton label="Salvar" onPress={onPress} />));
  const button = container.querySelector('[role="button"]');
  const initial = getComputedStyle(button);
  const geometry = [initial.minWidth, initial.minHeight, initial.padding];
  await act(() => button.focus());
  expect(getComputedStyle(button).outlineWidth).toBe('2px');
  await act(() => button.click());
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(button.tagName).toBe('BUTTON');
  await act(() => root.render(<WiseButton label="Salvar" onPress={onPress} loading />));
  expect(button.getAttribute('aria-label')).toBe('Salvar');
  expect(button.getAttribute('aria-busy')).toBe('true');
  expect(button.getAttribute('aria-disabled')).toBe('true');
  expect(document.getElementById(button.getAttribute('aria-describedby')).textContent).toBe('Carregando');
  expect(button.textContent).toContain('Salvar');
  const loading = getComputedStyle(button);
  expect([loading.minWidth, loading.minHeight, loading.padding]).toEqual(geometry);
  await act(() => {
    button.click();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    button.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  });
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('maps original progress values to ARIA and omits aria-valuenow for indeterminate progress', async () => {
  await act(() => root.render(<ProgressBar value={150} />));
  const bar = container.querySelector('[role="progressbar"]');
  expect(bar.getAttribute('aria-valuemin')).toBe('0');
  expect(bar.getAttribute('aria-valuemax')).toBe('100');
  expect(bar.getAttribute('aria-valuenow')).toBe('150');
  await act(() => root.render(<ProgressBar indeterminate />));
  expect(bar.hasAttribute('aria-valuenow')).toBe(false);
});

it.each([['info', 'polite'], ['success', 'polite'], ['warning', 'polite'], ['error', 'assertive']])('maps %s feedback to %s without exposing its icon', async (variant, priority) => {
  await act(() => root.render(<FeedbackMessage variant={variant} message="Resultado" />));
  const message = container.querySelector(`[aria-live="${priority}"]`);
  expect(message).not.toBeNull();
  expect(message.querySelector('[aria-hidden="true"]')).not.toBeNull();
  expect(message.getAttribute('role')).toBe(variant === 'error' ? 'alert' : null);
});

it('only makes an actionable ResourcePill keyboard focusable with a button role', async () => {
  const onPress = jest.fn();
  await act(() => root.render(<ResourcePill label="Disponível" />));
  expect(container.querySelector('[role="button"]')).toBeNull();
  await act(() => root.render(<ResourcePill label="Disponível" onPress={onPress} accessibilityLabel="Ver disponibilidade" />));
  const button = container.querySelector('[role="button"]');
  expect(button.tabIndex).toBe(0);
  await act(() => button.focus());
  expect(getComputedStyle(button).outlineWidth).toBe('2px');
  await act(() => button.click());
  expect(onPress).toHaveBeenCalledTimes(1);
});
