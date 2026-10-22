import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useAuth } from '@/core/auth/auth-context';

/** Logs this device out and leaves for the login screen only after the logout resolves. */
export function useSignOut(): () => Promise<void> {
  const { logout } = useAuth();
  const router = useRouter();
  return useCallback(async () => {
    await logout();
    router.replace('/entrar');
  }, [logout, router]);
}
