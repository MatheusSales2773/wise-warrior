type Player = { play: jest.Mock; remove: jest.Mock; seekTo: jest.Mock };

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
