import { StyleSheet } from 'react-native';
import { theme } from '@/design-system';

/** Figma 06c: 20 px of padding and 14 px between the blocks of a side card, values the spacing scale has no step for. */
export const CARD_PADDING = 20;
export const CARD_GAP = 14;
/** Figma 06c: the radius of the inset boxes (Aviso, Mural field) and the border of the framed portraits and sprites. */
export const INSET_RADIUS = 6;
export const FRAME_RADIUS = 4;

/** The small type of the 06c side cards, shared by the Mural and the "Ao derrotar" card. */
export const cardText = StyleSheet.create({
  name: { fontFamily: theme.type.label.fontFamily, fontSize: 13, lineHeight: 16, color: theme.color.textPrimary },
  body: { fontFamily: theme.type.body.fontFamily, fontSize: 12, lineHeight: 17, color: theme.color.textSecondary },
  meta: { fontFamily: theme.type.mono.fontFamily, fontSize: 10, lineHeight: 13, color: theme.color.textTertiary },
  note: { fontFamily: theme.type.body.fontFamily, fontSize: 11, lineHeight: 15, color: theme.color.textTertiary },
});

/** Figma 06c and 06d desktop: a 680 px main column and a 392 px side column. */
export const columnStyles = StyleSheet.create({
  main: { flex: 680 },
  side: { flex: 392 },
});
