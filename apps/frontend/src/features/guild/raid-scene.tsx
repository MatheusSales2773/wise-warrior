import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/design-system';
import { PixelSprite } from '@/features/character/PixelSprite';
import { itemSprites } from '@/features/character/sprites';
import { partyHeroSprites, partyHeroWeapons, type PartyMember } from './raid-battle';
import {
  RAID_HERO_SIZE,
  RAID_PARTY_ORIGIN,
  RAID_PARTY_SPACING,
  RAID_SCENE_BOSS_POSITION,
  RAID_SCENE_HEIGHT,
  RAID_SCENE_HIT_ANCHOR,
  RAID_SCENE_WIDTH,
  RAID_SHADOW,
  raidWeapons,
} from './raid-scene-sprites';
import { defaultRaidSceneArt, type RaidSceneArt } from './raid-scene-art';

/**
 * Maior escala inteira que cabe na largura, com folga para um corte pequeno nas bordas (o celular usa ×2 em 342px,
 * como no Figma). Nunca menor que ×2 nem maior que ×6.
 */
export function raidSceneScale(width: number): number {
  return Math.min(6, Math.max(2, Math.floor((width + 20) / RAID_SCENE_WIDTH)));
}

function slotOrigin(index: number) {
  return { x: RAID_PARTY_ORIGIN.x + index * RAID_PARTY_SPACING, y: RAID_PARTY_ORIGIN.y };
}

/** Where the Acessório (8 × 8) hangs, relative to the hero's slot: at the hero's feet, away from the weapon. */
const ACCESSORY_OFFSET = { x: -4, y: 16 } as const;

function PartyHeroFigure({ index, member, scale }: { index: number; member: PartyMember; scale: number }) {
  const origin = slotOrigin(index);
  const weapon = raidWeapons[partyHeroWeapons[member.hero]];
  return <>
    <View style={[styles.layer, { left: (origin.x + RAID_SHADOW.x) * scale, top: (origin.y + RAID_SHADOW.y) * scale, width: RAID_SHADOW.width * scale, height: scale, backgroundColor: RAID_SHADOW.color }]} />
    <PixelSprite scale={scale} sprite={partyHeroSprites[member.hero]} style={[styles.layer, { left: origin.x * scale, top: origin.y * scale }]} testID={`raid-scene-hero-${member.userId}`} />
    <PixelSprite scale={scale} sprite={weapon.sprite} style={[styles.layer, { left: (origin.x + weapon.offset.x) * scale, top: (origin.y + weapon.offset.y) * scale }]} />
    {member.accessory
      ? <PixelSprite scale={scale} sprite={itemSprites[member.accessory]} style={[styles.layer, { left: (origin.x + ACCESSORY_OFFSET.x) * scale, top: (origin.y + ACCESSORY_OFFSET.y) * scale }]} testID={`raid-scene-accessory-${member.userId}`} />
      : null}
  </>;
}

/** Nome e nível sob cada herói, como as etiquetas da cena no desktop. */
function PartyTag({ index, member, scale }: { index: number; member: PartyMember; scale: number }) {
  const origin = slotOrigin(index);
  const center = (origin.x + RAID_HERO_SIZE.width / 2) * scale;
  return <View
    pointerEvents="none"
    style={[styles.tagSlot, { left: center - TAG_SLOT_WIDTH / 2, top: (origin.y + RAID_HERO_SIZE.height) * scale - 8 }]}
    testID={`raid-scene-tag-${member.userId}`}
  >
    <View style={[styles.tag, member.isMe && styles.tagMe]}>
      <Text numberOfLines={1} style={[styles.tagName, member.isMe && styles.tagNameMe]}>{member.displayName}</Text>
      <Text style={styles.tagLevel}>Nv {member.level}</Text>
    </View>
  </View>;
}

const TAG_SLOT_WIDTH = 140;
const HIT_SLOT_WIDTH = 220;

/**
 * A cena da batalha em pixel art. Decorativa para leitores de tela: o progresso e os membros aparecem como texto
 * fora dela. `overlay` recebe os painéis que ficam por cima (tempo, vida do chefe); `hit`, o Golpe mais recente, que fica
 * diante do chefe e acompanha a escala e o corte da cena, fora da parte escondida dos leitores de tela.
 */
export function RaidScene({ art = defaultRaidSceneArt, framed = true, hit, overlay, party, scale, showTags, viewportWidth }: {
  /** The Missão's illustration; the default scene when omitted. */
  art?: RaidSceneArt;
  /** Rounded corners and border; off when the scene sits flush inside a card that already draws them. */
  framed?: boolean;
  party: readonly PartyMember[];
  scale: number;
  showTags: boolean;
  /** Largura visível; a cena fica centralizada e cortada nas bordas quando é mais larga. */
  viewportWidth: number;
  overlay?: ReactNode;
  hit?: ReactNode;
}) {
  const width = RAID_SCENE_WIDTH * scale;
  const height = RAID_SCENE_HEIGHT * scale;
  const visibleWidth = Math.min(viewportWidth, width);
  const canvasLeft = (visibleWidth - width) / 2;
  return <View style={[styles.frame, framed && styles.framed, { width: visibleWidth, height }]} testID="raid-scene">
    <View accessibilityElementsHidden aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.canvas, { width, height, left: canvasLeft }]}>
      <PixelSprite scale={scale} sprite={art.background} style={styles.layerOrigin} testID="raid-scene-background" />
      {party.map((member, index) => <PartyHeroFigure index={index} key={member.userId} member={member} scale={scale} />)}
      <PixelSprite scale={scale} sprite={art.boss} style={[styles.layer, { left: RAID_SCENE_BOSS_POSITION.x * scale, top: RAID_SCENE_BOSS_POSITION.y * scale }]} testID="raid-scene-boss" />
      {showTags ? party.map((member, index) => <PartyTag index={index} key={member.userId} member={member} scale={scale} />) : null}
    </View>
    {/* Drawn over the pixels so the border does not crop the scene. */}
    {framed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frameBorder]} /> : null}
    {hit ? <View
      pointerEvents="none"
      style={[styles.hitSlot, { left: canvasLeft + RAID_SCENE_HIT_ANCHOR.x * scale - HIT_SLOT_WIDTH / 2, top: RAID_SCENE_HIT_ANCHOR.y * scale }]}
    >{hit}</View> : null}
    {overlay}
  </View>;
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', overflow: 'hidden', backgroundColor: theme.color.surfaceInset },
  framed: { borderRadius: theme.radius.card },
  frameBorder: { borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis },
  canvas: { position: 'absolute', top: 0 },
  layer: { position: 'absolute' },
  layerOrigin: { position: 'absolute', left: 0, top: 0 },
  hitSlot: { position: 'absolute', width: HIT_SLOT_WIDTH, alignItems: 'center' },
  tagSlot: { position: 'absolute', width: TAG_SLOT_WIDTH, alignItems: 'center' },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 3, maxWidth: TAG_SLOT_WIDTH,
    borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: 'rgba(7, 7, 12, 0.72)',
  },
  tagMe: { borderColor: theme.color.accentPrimary },
  tagName: { flexShrink: 1, fontFamily: 'Inter-SemiBold', fontSize: 11, lineHeight: 13, color: theme.color.textPrimary },
  tagNameMe: { color: theme.color.accentHighlight },
  tagLevel: { fontFamily: 'JetBrainsMono-Medium', fontSize: 9, lineHeight: 12, color: theme.color.textTertiary },
});
