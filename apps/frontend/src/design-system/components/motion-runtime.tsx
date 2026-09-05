import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { motionDuration, theme, type MotionDuration } from '../tokens/theme';

const MotionDurationContext = createContext<MotionDuration>(theme.motion.standard);

export function useReducedMotion(): boolean {
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

export function useRuntimeMotionDuration(): MotionDuration {
  return useContext(MotionDurationContext);
}

export function MotionRuntime({ children }: PropsWithChildren) {
  const isReduced = useReducedMotion();
  const duration = motionDuration(theme.motion.standard, isReduced);

  return <MotionDurationContext.Provider value={duration}>{children}</MotionDurationContext.Provider>;
}
