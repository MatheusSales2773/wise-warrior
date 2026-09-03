import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiClient, setAccessToken } from '../../lib/apiClient';
import { connectSocket, disconnectSocket } from '../../lib/socket';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, deviceLabel?: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface TokenResponse {
  accessToken: string;
}

function applySession(accessToken: string): void {
  setAccessToken(accessToken);
  connectSocket(accessToken);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Tenta restaurar a sessão via cookie httpOnly de refresh ao carregar a
  // página — é isso que faz o login persistir entre fechamentos de aba/app
  // no mesmo dispositivo (ADR-009).
  useEffect(() => {
    let cancelled = false;
    apiClient
      .post<TokenResponse>('/auth/refresh')
      .then((response) => {
        if (cancelled) return;
        applySession(response.data.accessToken);
        setIsAuthenticated(true);
      })
      .catch(() => {
        if (!cancelled) setIsAuthenticated(false);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, deviceLabel?: string) => {
      const response = await apiClient.post<TokenResponse>('/auth/login', {
        email,
        password,
        deviceLabel,
      });
      applySession(response.data.accessToken);
      setIsAuthenticated(true);
    },
    [],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const response = await apiClient.post<TokenResponse>('/auth/register', {
        email,
        password,
        displayName,
      });
      applySession(response.data.accessToken);
      setIsAuthenticated(true);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setAccessToken(null);
      disconnectSocket();
      setIsAuthenticated(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  }
  return ctx;
}
