/**
 * Dimensões de janela do mock de `useWindowDimensions`. Os testes as ajustam antes de montar;
 * cada ajuste cria um objeto novo para que a mudança chegue aos componentes.
 */
import type { useWindowDimensions } from 'react-native';

type WindowDimensions = ReturnType<typeof useWindowDimensions>;

const defaultWindowDimensions: WindowDimensions = { width: 1024, height: 768, scale: 1, fontScale: 1 };

let windowDimensions: WindowDimensions = { ...defaultWindowDimensions };

const mockUseWindowDimensions = jest.fn(() => windowDimensions);

export function createReactNativeMock() {
  return new Proxy(jest.requireActual('react-native'), {
    get(target, property, receiver) {
      return property === 'useWindowDimensions' ? mockUseWindowDimensions : Reflect.get(target, property, receiver);
    },
  });
}

export function setMockWindowDimensions(next: Partial<WindowDimensions>) {
  windowDimensions = { ...windowDimensions, ...next };
}

export function setMockWindowWidth(width: number) {
  setMockWindowDimensions({ width });
}

export function resetMockWindowDimensions() {
  windowDimensions = { ...defaultWindowDimensions };
}
