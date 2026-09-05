import { StyleSheet } from 'react-native';
import { theme } from '../tokens/theme';

export const controlStyles = StyleSheet.create({
  webFocus: { outlineWidth: theme.border.focus, outlineStyle: 'solid', outlineColor: theme.color.accentPrimary },
});
