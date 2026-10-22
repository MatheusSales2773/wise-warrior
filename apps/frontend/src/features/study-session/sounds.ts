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

// Bumped by every stop, so a play still waiting on its rewind does not ring after the user silenced it.
let epoch = 0;

function pauseSilently(player: AudioPlayer | undefined, rewind: boolean): void {
  if (!player) return;
  try {
    player.pause();
    player.loop = false;
    if (rewind) player.seekTo(0).catch(() => undefined);
  } catch {
    // Already gone.
  }
}

/**
 * Plays a cue at the end of a focus or a break; `loop` keeps it ringing until `stopSessionSounds`.
 * Only one cue rings at a time. A sound is never worth breaking the timer, so failures are swallowed.
 */
export function playSessionSound(sound: SessionSound, { loop = false }: { loop?: boolean } = {}): void {
  try {
    if (!audioModeReady) {
      audioModeReady = true;
      setAudioModeAsync({ playsInSilentMode: true }).catch(() => { audioModeReady = false; });
    }
    for (const other of Object.keys(players) as SessionSound[]) {
      if (other !== sound) pauseSilently(players[other], false);
    }
    const player = playerFor(sound);
    const ticket = epoch;
    player.loop = loop;
    // A finished clip rests at its end: rewind first, and play only once the rewind landed.
    player.seekTo(0).then(() => { if (ticket === epoch) player.play(); }).catch(() => undefined);
  } catch {
    // Audio unavailable (missing native module): the visual end state still shows.
  }
}

/** Silences whatever is ringing: the user acted on the alarm (new session, break) or ended the run. */
export function stopSessionSounds(): void {
  epoch += 1;
  for (const sound of Object.keys(players) as SessionSound[]) pauseSilently(players[sound], true);
}

/**
 * Called from the "Iniciar foco" gesture: browsers only let a page play audio it was allowed to start
 * from a user gesture, and the alarm later rings from a timer, often in a hidden tab.
 */
export function unlockSessionSounds(): void {
  try {
    for (const sound of Object.keys(sources) as SessionSound[]) {
      const player = playerFor(sound);
      player.volume = 0;
      player.play();
      player.pause();
      player.seekTo(0).catch(() => undefined);
      player.volume = 1;
    }
  } catch {
    // Audio unavailable: the alarm just stays silent.
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
