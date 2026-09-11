import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseField, theme } from '@/design-system';
import { useAuth } from '@/core/auth/auth-context';
import { AuthShell } from './components/AuthShell';
import { AuthPasswordField } from './components/AuthPasswordField';
import { loginErrorMessage } from './messages';
import { normalizeEmail, validateLogin, type LoginFieldErrors } from './validation';

/**
 * Login universal. Valida localmente, evita submissão duplicada, move o foco
 * pelo teclado e associa erros aos campos; a falha da API é anunciada.
 */
export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  async function handleSubmit() {
    if (submitting) return;

    const nextErrors = validateLogin({ email, password });
    setErrors(nextErrors);
    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await login({ email: normalizeEmail(email), password });
    } catch (error) {
      setFormError(loginErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      description="Retome sua jornada rumo ao foco lendário."
      eyebrow="Portal da fortaleza"
      title="Entre na batalha"
    >
      <View aria-busy={submitting} style={styles.form}>
        <WiseField
          ref={emailRef}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!submitting}
          error={errors.email}
          keyboardType="email-address"
          label="E-mail"
          nativeID="login-email"
          onChangeText={setEmail}
          onSubmitEditing={() => passwordRef.current?.focus()}
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
        />
        <AuthPasswordField
          ref={passwordRef}
          autoCapitalize="none"
          autoComplete="current-password"
          editable={!submitting}
          error={errors.password}
          label="Senha"
          nativeID="login-password"
          onChangeText={setPassword}
          onSubmitEditing={() => {
            void handleSubmit();
          }}
          returnKeyType="go"
          textContentType="password"
          value={password}
        />
        {formError ? (
          <FeedbackMessage message={formError} title="Erro" variant="error" />
        ) : null}
        <WiseButton
          label="Entrar na batalha"
          loading={submitting}
          onPress={() => {
            void handleSubmit();
          }}
        />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.space.stackDefault },
});
