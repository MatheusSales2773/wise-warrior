import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const sources = {
  focusEnd: require('../../../assets/sounds/som-fim-pomodoro.wav'),
  breakEnd: require('../../../assets/sounds/som-fim-pausa.mp3'),
} as const;

export type SessionSound = keyof typeof sources;

const players: Partial<Record<SessionSound, AudioPlayer>> = {};
let audioModeReady = false;

function playerFor(sound: SessionSound): AudioPlayer {
  let player = players[sound];
  if (!player) {
    player = createAudioPlayer(sources[sound]);
    players[sound] = player;
  }
  return player;
}

/** Plays a cue at the end of a focus or a break. A sound is never worth breaking the timer, so failures are swallowed. */
export function playSessionSound(sound: SessionSound): void {
  try {
    if (!audioModeReady) {
      audioModeReady = true;
      setAudioModeAsync({ playsInSilentMode: true }).catch(() => { audioModeReady = false; });
    }
    const player = playerFor(sound);
    // A finished clip rests at its end: rewind first, and play only once the rewind landed.
    player.seekTo(0).then(() => player.play()).catch(() => undefined);
  } catch {
    // Audio unavailable (missing native module): the visual end state still shows.
  }
}

/** The createAudioPlayer players do not release themselves (Expo Audio, SDK 57). */
export function releaseSessionSounds(): void {
  for (const sound of Object.keys(players) as SessionSound[]) {
    try {
      players[sound]?.remove();
    } catch {
      // Already gone.
    }
    delete players[sound];
  }
}
