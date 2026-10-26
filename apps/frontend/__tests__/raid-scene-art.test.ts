import { defaultRaidSceneArt, raidSceneArt } from '@/features/guild/raid-scene-art';

describe('raidSceneArt', () => {
  it('falls back to the Vulcão do Devorador for a Missão without its own art', () => {
    expect(raidSceneArt('missao-sem-arte')).toBe(defaultRaidSceneArt);
    expect(raidSceneArt('constructor')).toBe(defaultRaidSceneArt);
  });
});
