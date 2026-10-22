type Player = { play: jest.Mock; pause: jest.Mock; remove: jest.Mock; seekTo: jest.Mock; loop?: boolean; volume?: number };

function load() {
  let sounds!: typeof import('@/features/study-session/sounds');
  let audio!: typeof import('expo-audio');
  jest.isolateModules(() => {
    audio = require('expo-audio');
    sounds = require('@/features/study-session/sounds');
  });
  return { sounds, audio };
}

const lastPlayer = (audio: typeof import('expo-audio')) =>
  (audio.createAudioPlayer as jest.Mock).mock.results.at(-1)!.value as Player;
const flush = () => new Promise((resolve) => setImmediate(resolve));

it('rewinds the clip and plays it once the rewind landed', async () => {
  const { sounds, audio } = load();

  sounds.playSessionSound('focusEnd');
  const player = lastPlayer(audio);
  expect(player.seekTo).toHaveBeenCalledWith(0);
  expect(player.play).not.toHaveBeenCalled();
  await flush();
  expect(player.play).toHaveBeenCalledTimes(1);
});

it('reuses the player and sets the audio mode once', async () => {
  const { sounds, audio } = load();

  sounds.playSessionSound('breakEnd');
  sounds.playSessionSound('breakEnd');
  await flush();

  expect(audio.createAudioPlayer).toHaveBeenCalledTimes(1);
  expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(1);
  expect(audio.setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true });
});

it('swallows a failing rewind instead of raising an unhandled rejection', async () => {
  const { sounds, audio } = load();
  (audio.createAudioPlayer as jest.Mock).mockReturnValueOnce({
    play: jest.fn(), remove: jest.fn(), seekTo: jest.fn(() => Promise.reject(new Error('boom'))),
  });

  expect(() => sounds.playSessionSound('focusEnd')).not.toThrow();
  await flush();
  expect(lastPlayer(audio).play).not.toHaveBeenCalled();
});

it('swallows a missing audio module', () => {
  const { sounds, audio } = load();
  (audio.createAudioPlayer as jest.Mock).mockImplementationOnce(() => { throw new Error('no native module'); });

  expect(() => sounds.playSessionSound('focusEnd')).not.toThrow();
});

it('releases the players it created', () => {
  const { sounds, audio } = load();
  sounds.playSessionSound('focusEnd');
  const player = lastPlayer(audio);

  sounds.releaseSessionSounds();

  expect(player.remove).toHaveBeenCalledTimes(1);
  sounds.playSessionSound('focusEnd');
  expect(audio.createAudioPlayer).toHaveBeenCalledTimes(2);
});

it('loops the clip only when asked to', async () => {
  const { sounds, audio } = load();

  sounds.playSessionSound('focusEnd', { loop: true });
  expect(lastPlayer(audio).loop).toBe(true);
  sounds.playSessionSound('focusEnd');
  expect(lastPlayer(audio).loop).toBe(false);
});

it('stops a ringing cue and rewinds it', async () => {
  const { sounds, audio } = load();
  sounds.playSessionSound('focusEnd', { loop: true });
  await flush();
  const player = lastPlayer(audio);

  sounds.stopSessionSounds();

  expect(player.pause).toHaveBeenCalledTimes(1);
  expect(player.loop).toBe(false);
  expect(player.seekTo).toHaveBeenCalledTimes(2);
});

it('does not ring a cue that was stopped before its rewind landed', async () => {
  const { sounds, audio } = load();
  sounds.playSessionSound('focusEnd', { loop: true });

  sounds.stopSessionSounds();
  await flush();

  expect(lastPlayer(audio).play).not.toHaveBeenCalled();
});

it('lets only one cue ring at a time', async () => {
  const { sounds, audio } = load();
  sounds.playSessionSound('focusEnd', { loop: true });
  const focus = lastPlayer(audio);
  await flush();

  sounds.playSessionSound('breakEnd', { loop: true });

  expect(focus.pause).toHaveBeenCalledTimes(1);
  expect(lastPlayer(audio)).not.toBe(focus);
});

it('unlocks every player with a silent play, then restores the volume', () => {
  const { sounds, audio } = load();

  sounds.unlockSessionSounds();

  const players = (audio.createAudioPlayer as jest.Mock).mock.results.map((result) => result.value as Player);
  expect(players).toHaveLength(2);
  for (const player of players) {
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.volume).toBe(1);
  }
});

it('swallows a play blocked by the autoplay policy', async () => {
  const { sounds, audio } = load();
  (audio.createAudioPlayer as jest.Mock).mockReturnValueOnce({
    play: jest.fn(() => Promise.reject(new Error('NotAllowedError'))),
    pause: jest.fn(), remove: jest.fn(), seekTo: jest.fn(() => Promise.resolve()),
  });

  sounds.playSessionSound('focusEnd', { loop: true });
  sounds.unlockSessionSounds();
  await flush();

  expect(lastPlayer(audio).play).toHaveBeenCalled();
});

it('does not mute the cue that is ringing when the start gesture unlocks the players', async () => {
  const { sounds, audio } = load();
  sounds.playSessionSound('focusEnd', { loop: true });
  await flush();
  const ringing = lastPlayer(audio);
  ringing.play.mockClear();

  sounds.unlockSessionSounds();

  expect(ringing.pause).not.toHaveBeenCalled();
  expect(ringing.play).not.toHaveBeenCalled();
  expect(ringing.loop).toBe(true);
});
