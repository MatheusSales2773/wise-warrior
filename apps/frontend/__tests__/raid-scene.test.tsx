import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { defaultRaidSceneArt, raidSceneArt } from '@/features/guild/raid-scene-art';
import { RaidScene } from '@/features/guild/raid-scene';

// Half of the 220px slot the Golpe is centered in.
const HIT_SLOT_HALF = 110;

async function renderScene(slug: string, scale: number) {
  await render(<RaidScene art={raidSceneArt(slug)} hit={<Text>−75</Text>} party={[]} scale={scale} showTags={false} viewportWidth={180 * scale} />);
  return {
    boss: StyleSheet.flatten(screen.getByTestId('raid-scene-boss', { includeHiddenElements: true }).props.style),
    hit: StyleSheet.flatten(screen.getByTestId('raid-scene-hit').props.style),
  };
}

describe('RaidScene', () => {
  it.each([6, 2])('draws the boss and the Golpe of a Missão at its own scene position, on ×%i', async (scale) => {
    const { boss, hit } = await renderScene('forja-dos-sabios', scale);

    expect(boss).toMatchObject({ left: 110 * scale, top: 20 * scale });
    expect(hit).toMatchObject({ left: 148 * scale - HIT_SLOT_HALF, top: 24 * scale });
  });

  it.each([6, 2])('keeps the Vulcão do Devorador boss and Golpe where they were, on ×%i', async (scale) => {
    const { boss, hit } = await renderScene('missao-sem-arte', scale);

    expect(defaultRaidSceneArt.bossPosition).toEqual({ x: 103, y: 36 });
    expect(boss).toMatchObject({ left: 103 * scale, top: 36 * scale });
    expect(hit).toMatchObject({ left: 120 * scale - HIT_SLOT_HALF, top: 32 * scale });
  });
});
