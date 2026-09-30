import { useEffect, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

function isApplicationActive(): boolean {
  if (Platform.OS === 'web') {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
  }
  return AppState.currentState === 'active';
}

export function useStudySessionAppActive(): boolean {
  const [isActive, setIsActive] = useState(isApplicationActive);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const updateVisibility = () => setIsActive(isApplicationActive());
      document.addEventListener('visibilitychange', updateVisibility);
      return () => document.removeEventListener('visibilitychange', updateVisibility);
    }

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      setIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  return isActive;
}
