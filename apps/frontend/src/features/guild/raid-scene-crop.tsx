import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '@/design-system';
import type { ActiveRaid } from './api';
import { raidParty } from './raid-battle';
import { RaidScene } from './raid-scene';
import { raidSceneArt } from './raid-scene-art';
import { RAID_SCENE_HEIGHT, RAID_SCENE_WIDTH } from './raid-scene-sprites';

/** Where the Figma crops the scene: 42% of the cut-off height goes above the frame, the rest below. */
const SCENE_CROP_TOP = 0.42;

/** The smallest whole scale that covers the frame in both directions; the scene is centered and cropped, never letterboxed. */
function sceneScale(width: number, frameHeight: number): number {
  return Math.min(6, Math.max(2, Math.ceil(width / RAID_SCENE_WIDTH), Math.ceil(frameHeight / RAID_SCENE_HEIGHT)));
}

/**
 * The Missão's scene of a Raid, cropped to a frame of `height` that fills its parent's width. `thumbnail` draws it at
 * ×1 (the whole party in a small frame, as the Raid block of the Acampamento on a phone); otherwise it covers the frame.
 * The scene is still pixel art: nothing in it moves, so it already respects reduced motion. `children` sit over it.
 */
export function RaidSceneCrop({ children, height, raid, testID = 'guild-raid-image', thumbnail = false }: { children?: ReactNode; height: number; raid: ActiveRaid; testID?: string; thumbnail?: boolean }) {
  const [width, setWidth] = useState(0);
  const scale = thumbnail ? 1 : sceneScale(width, height);
  const cut = Math.max(0, RAID_SCENE_HEIGHT * scale - height);
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.frame, { height }]} testID={testID}>
      {width > 0
        ? <View style={{ marginTop: -cut * SCENE_CROP_TOP }}>
          <RaidScene art={raidSceneArt(raid.mission.slug)} framed={false} party={raidParty(raid.party)} scale={scale} showTags={false} viewportWidth={width} />
        </View>
        : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: theme.color.surfaceInset },
});
