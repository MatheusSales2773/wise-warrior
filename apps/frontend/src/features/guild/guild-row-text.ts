import { StyleSheet } from 'react-native';
import { theme } from '@/design-system';

const { fontFamily: mono } = theme.type.mono;
const { fontFamily: sans } = theme.type.label;

/** Text shared by the list rows of the 06c cards (Ranking interno, Raids anteriores). Sizes are Figma 06c values with no token. */
export const rowText = StyleSheet.create({
  name: { fontFamily: sans, fontSize: 13, lineHeight: 16, color: theme.color.textPrimary },
  detail: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.textTertiary },
});
