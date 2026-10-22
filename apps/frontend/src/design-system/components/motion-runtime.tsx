import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useDevicePreference } from '@/core/preferences/device-preferences';
import { motionDuration, theme, type MotionDuration } from '../tokens/theme';

const MotionDurationContext = createContext<MotionDuration>(theme.motion.standard);

/** The operating system's reduce-motion setting; true until it is known, so no motion plays before then. */
export function useSystemReducedMotion(): boolean {
  // Avoid presenting motion before the asynchronous system preference is known.
  const [isReduced, setIsReduced] = useState(true);

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

/** The app reduces motion when the system asks for it or the device preference is on; the preference only adds. */
export function useReducedMotion(): boolean {
  const system = useSystemReducedMotion();
  const [preferred] = useDevicePreference('reduceMotion');
  return system || preferred;
}

export function useRuntimeMotionDuration(): MotionDuration {
  return useContext(MotionDurationContext);
}

export function MotionRuntime({ children }: PropsWithChildren) {
  const isReduced = useReducedMotion();
  const duration = motionDuration(theme.motion.standard, isReduced);

  return <MotionDurationContext.Provider value={duration}>{children}</MotionDurationContext.Provider>;
}
