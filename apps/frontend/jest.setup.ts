import '@testing-library/react-native';

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
