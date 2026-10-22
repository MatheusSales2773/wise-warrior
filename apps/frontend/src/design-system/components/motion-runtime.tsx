import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useDevicePreference } from '@/core/preferences/device-preferences';
import { motionDuration, theme, type MotionDuration } from '../tokens/theme';

const MotionDurationContext = createContext<MotionDuration>(theme.motion.standard);

/** The operating system's reduce-motion setting; `null` until it is known. */
export function useSystemReducedMotion(): boolean | null {
  const [isReduced, setIsReduced] = useState<boolean | null>(null);


  useEffect(() => {
    let isMounted = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsReduced);

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setIsReduced(enabled);
      })
      .catch(() => {
        if (isMounted) setIsReduced(false);
      });

    return () => {
      isMounted = false;
      // React Native Web returns no subscription when matchMedia is unavailable.
      subscription?.remove();
    };
  }, []);

  return isReduced;
}

/**
 * The one rule for reduced motion: the preference only adds to the system. Motion stays off until the system answers,
 * so no animation plays before it is known; `systemReduces` and `preferred` are what the setting itself shows.
 */
export function useMotionReduction(): { reduced: boolean; preferred: boolean; systemReduces: boolean } {
  const system = useSystemReducedMotion();
  const [preferred] = useDevicePreference('reduceMotion');
  return { reduced: system !== false || preferred, preferred, systemReduces: system === true };
}

export function useReducedMotion(): boolean {
  return useMotionReduction().reduced;
}

export function useRuntimeMotionDuration(): MotionDuration {
  return useContext(MotionDurationContext);
}

export function MotionRuntime({ children }: PropsWithChildren) {
  const isReduced = useReducedMotion();
  const duration = motionDuration(theme.motion.standard, isReduced);

  return <MotionDurationContext.Provider value={duration}>{children}</MotionDurationContext.Provider>;
}
