import { createElement, Fragment, type ReactNode } from 'react';
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
  retryRestore: jest.fn(),
};

export function createAuthContextMock() {
  return {
    AuthProvider: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
    useAuth: () => mockAuthState,
  };
}
