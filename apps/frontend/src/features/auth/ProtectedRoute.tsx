import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <p role="status">Carregando…</p>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/entrar" replace />;
  }
  return <>{children}</>;
}
