import { useId, useState, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { theme, typographyFor } from '../tokens/theme';
import { useFontFallback } from './font-runtime';
import { FeedbackMessage } from './FeedbackMessage';
import { WiseText } from './WiseText';
import { controlStyles } from './control-styles';

export type WiseFieldProps = Omit<TextInputProps, 'style' | 'children' | 'accessibilityLabel' | 'accessibilityLabelledBy' | 'accessibilityHint' | 'aria-label' | 'aria-labelledby' | 'id'> & {
  label: string;
  helpText?: string;
  error?: string;
  ref?: Ref<TextInput>;
};

export function WiseField({ label, helpText, error, nativeID, onFocus, onBlur, ref, ...inputProps }: WiseFieldProps) {
  const generatedId = useId();
  const [focused, setFocused] = useState(false);
  const fallback = useFontFallback();
  const id = nativeID ?? `wise-field-${generatedId}`;
  const message = error || helpText;
  const messageId = message ? `${id}-message` : undefined;

  return (
    <View style={styles.field}>
      <WiseText variant="label" nativeID={`${id}-label`}>{label}</WiseText>
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
          typographyFor('body', fallback),
          error && { borderColor: theme.color.feedbackDanger },
          focused && { borderColor: theme.color.accentPrimary },
          focused && Platform.OS === 'web' && controlStyles.webFocus,
        ]}
      />
      {error ? (
        <FeedbackMessage nativeID={messageId} variant="error" title="Erro" message={error} />
      ) : helpText ? (
        <WiseText nativeID={messageId} variant="body" color="textSecondary">{helpText}</WiseText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: theme.space.inlineTight },
  input: {
    minHeight: theme.layout.touchTarget,
    minWidth: theme.layout.touchTarget,
    paddingHorizontal: theme.space.controlInset,
    paddingVertical: theme.space.inlineTight,
    borderWidth: theme.border.standard,
    borderColor: theme.color.borderEmphasis,
    borderRadius: theme.radius.control,
    color: theme.color.textPrimary,
    backgroundColor: theme.color.surfaceInset,
  },
});
