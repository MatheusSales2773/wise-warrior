import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const sources = {
  focusEnd: require('../../../assets/sounds/som-fim-pomodoro.wav'),
  breakEnd: require('../../../assets/sounds/som-fim-pausa.mp3'),
} as const;

export type SessionSound = keyof typeof sources;

const players: Partial<Record<SessionSound, AudioPlayer>> = {};

/** Plays a cue at the end of a focus or a break. A sound is never worth breaking the timer, so failures are swallowed. */
export function playSessionSound(sound: SessionSound): void {
  try {
    const player = players[sound] ?? (players[sound] = createAudioPlayer(sources[sound]));
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    void player.seekTo(0);
    player.play();
  } catch {
    // Audio unavailable (autoplay policy, missing native module): the visual end state still shows.
  }
}
