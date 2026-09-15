import { createElement, Fragment, useEffect, useState, type ReactNode } from 'react';
import type { ApiError } from '@/core/api/api-error';

export type MockAuthStatus = 'restoring' | 'anonymous' | 'authenticated' | 'unavailable';

/**
 * Estado compartilhado usado pelos testes que renderizam a árvore real de rotas
 * sem exercitar o transporte. Os testes ajustam `status` antes de montar.
 */
export const mockAuthState = {
  status: 'authenticated' as MockAuthStatus,
  sessionId: 'test-session' as string | null,
  error: null as ApiError | null,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(() => Promise.resolve()),
  retryRestore: jest.fn(),
};

const subscribers = new Set<() => void>();

export function updateMockAuthState(next: Partial<typeof mockAuthState>) {
  Object.assign(mockAuthState, next);
  subscribers.forEach((subscriber) => subscriber());
}

export function createAuthContextMock() {
  return {
    AuthProvider: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
    useAuth: () => {
      const [, rerender] = useState(0);
      useEffect(() => {
        const subscriber = () => rerender((value) => value + 1);
        subscribers.add(subscriber);
        return () => {
          subscribers.delete(subscriber);
        };
      }, []);
      return mockAuthState;
    },
  };
}
