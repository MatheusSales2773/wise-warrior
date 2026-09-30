import { useId, useState, type ReactNode, type Ref } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { theme, typographyFor } from '../tokens/theme';
import { useFontFallback } from './font-runtime';
import { FeedbackMessage } from './FeedbackMessage';
import { WiseText } from './WiseText';
import { controlStyles } from './control-styles';

export type WiseFieldProps = Omit<TextInputProps, 'style' | 'children' | 'accessibilityLabel' | 'accessibilityLabelledBy' | 'accessibilityHint' | 'aria-label' | 'aria-labelledby' | 'id'> & {
  label: string;
  helpText?: string;
  /** Short decorative tag shown opposite the label, e.g. "Identidade". */
  hint?: string;
  error?: string;
  trailing?: ReactNode;
  ref?: Ref<TextInput>;
};

export function WiseField({ label, hint, helpText, error, nativeID, onFocus, onBlur, trailing, ref, ...inputProps }: WiseFieldProps) {
  const generatedId = useId();
  const [focused, setFocused] = useState(false);
  const fallback = useFontFallback();
  const id = nativeID ?? `wise-field-${generatedId}`;
  const message = error || helpText;
  const messageId = message ? `${id}-message` : undefined;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text allowFontScaling nativeID={`${id}-label`} style={[styles.label, fallback && styles.fallbackFont]}>{label}</Text>
        {hint ? <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no" style={[styles.hint, fallback && styles.fallbackMono]}>{hint}</Text> : null}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          {...inputProps}
          ref={ref}
          nativeID={id}
          accessibilityLabel={label}
          aria-labelledby={`${id}-label`}
          accessibilityHint={error ? `Erro: ${error}` : helpText}
          aria-describedby={messageId}
          aria-invalid={!!error}
          placeholderTextColor={theme.color.textSecondary}
          selectionColor={theme.color.accentPrimary}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          style={[
            styles.input,
            trailing ? styles.inputWithTrailing : null,
            typographyFor('body', fallback),
            error && { borderColor: theme.color.feedbackDanger },
            focused && { borderColor: theme.color.borderFocus },
            focused && Platform.OS === 'web' && controlStyles.webFocus,
          ]}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? (
        <FeedbackMessage nativeID={messageId} variant="error" title="Erro" message={error} />
      ) : helpText ? (
        <WiseText nativeID={messageId} variant="body" color="textSecondary">{helpText}</WiseText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.space.inlineTight },
  label: { fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 16, color: theme.color.textSecondary, flexShrink: 1 },
  hint: { fontFamily: 'JetBrainsMono-Medium', fontSize: 9, lineHeight: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.color.textTertiary },
  fallbackFont: { fontFamily: undefined },
  fallbackMono: { fontFamily: 'monospace' },
  inputRow: { position: 'relative', justifyContent: 'center' },
  input: {
    minHeight: theme.layout.touchTarget,
    minWidth: theme.layout.touchTarget,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: theme.border.standard,
    borderColor: theme.color.borderGhost,
    borderRadius: theme.radius.detail,
    color: theme.color.textPrimary,
    backgroundColor: theme.color.surfaceInset,
  },
  inputWithTrailing: { paddingRight: theme.space.heroGap },
  trailing: {
    position: 'absolute',
    right: theme.space.inlineTight,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
