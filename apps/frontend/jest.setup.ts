import '@testing-library/react-native';
import { timeoutManager } from '@tanstack/react-query';

// Every query a test creates schedules a garbage-collection timer (gcTime, 5 minutes by
// default). Those real timers kept Jest alive for minutes after the last test finished.
// Unref them so a pending query timer no longer holds the process open. The global timer
// functions are looked up on each call, so Jest fake timers still replace them.
const unref = <T>(timerId: T): T => {
  (timerId as { unref?: () => void }).unref?.();
  return timerId;
};

timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => unref(setTimeout(callback, delay)),
  clearTimeout: (timerId) => clearTimeout(timerId as ReturnType<typeof setTimeout> | undefined),
  setInterval: (callback, delay) => unref(setInterval(callback, delay)),
  clearInterval: (timerId) => clearInterval(timerId as ReturnType<typeof setInterval> | undefined),
});

// expo-router/testing-library enables fake timers while rendering a route.
// Restore the real clock after RNTL's cleanup so one test cannot affect the next.
afterEach(() => {
  jest.useRealTimers();
});

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
  })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));
