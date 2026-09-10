import type { ApiError } from '@/core/api/api-error';

export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated' | 'unavailable';

export type AuthState =
  | { status: 'restoring' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; sessionId: string }
  | { status: 'unavailable'; error: ApiError };

export type AuthCredentials = {
  email: string;
  password: string;
};

export type AuthSession = {
  sessionId: string;
};

/** Persistência do refresh token. Em Web é um no-op: o cookie `httpOnly` é do browser. */
export type CredentialStore = {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  remove(): Promise<void>;
};

export type RestoreResult = Exclude<AuthState, { status: 'restoring' }>;
