import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseField, WiseText, theme } from '@/design-system';
import { useAuth } from '@/core/auth/auth-context';
import { AuthShell } from './components/AuthShell';
import { AuthNavigationLink } from './components/AuthNavigationLink';
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
      description="Retome o fio da sua jornada e transforme cada minuto de concentração em progresso visível."
      eyebrow="A fortaleza espera"
      title="Entre na batalha"
    >
      <View aria-busy={submitting} style={styles.form}>
        <View style={styles.formHead}>
          <WiseText accessibilityRole="header" variant="subtitle">Abra seu grimório</WiseText>
          <WiseText color="textTertiary" variant="body">Seus registros de foco aguardam por você.</WiseText>
        </View>
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
        <View style={styles.metaRow}>
          <WiseText color="accentPrimary" variant="caption">✦</WiseText>
          <Text style={styles.meta}>Seu progresso permanece protegido no grimório</Text>
        </View>
        <WiseButton
          label="Entrar na batalha"
          loading={submitting}
          size="large"
          onPress={() => {
            void handleSubmit();
          }}
        />
        <AuthNavigationLink href="/cadastro" label="Ainda não tem uma conta? Crie seu personagem" />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.space.stackDefault },
  formHead: { alignItems: 'center', gap: theme.space.inlineHairline, marginBottom: theme.space.inlineTight },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.inlineTight },
  meta: { fontFamily: 'Inter-Medium', color: theme.color.textTertiary, fontSize: 11 },
});
