import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useAuth } from '@/core/auth/auth-context';
import { FeedbackMessage, WiseButton, WiseField, theme } from '@/design-system';
import { AuthNavigationLink } from './components/AuthNavigationLink';
import { AuthPasswordField } from './components/AuthPasswordField';
import { AuthShell } from './components/AuthShell';
import { registerErrorMessage } from './messages';
import {
  normalizeRegistration,
  validateRegistration,
  type RegistrationFieldErrors,
} from './validation';

export function RegisterForm() {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);

  async function handleSubmit() {
    if (submitting) return;

    const nextErrors = validateRegistration({ displayName, email, password, passwordConfirmation });
    setErrors(nextErrors);
    if (nextErrors.displayName) {
      nameRef.current?.focus();
      return;
    }
    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }
    if (nextErrors.passwordConfirmation) {
      confirmationRef.current?.focus();
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await register(normalizeRegistration({ displayName, email, password, passwordConfirmation }));
    } catch (error) {
      setFormError(registerErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      description="Escolha seu nome, fortaleça sua presença e transforme cada minuto de concentração em progresso visível."
      eyebrow="Uma nova jornada começa"
      title="Crie seu personagem"
    >
      <View aria-busy={submitting} style={styles.form}>
        <WiseField
          ref={nameRef}
          autoCapitalize="words"
          autoComplete="name"
          editable={!submitting}
          error={errors.displayName}
          label="Nome do guerreiro"
          maxLength={60}
          nativeID="register-display-name"
          onChangeText={setDisplayName}
          onSubmitEditing={() => emailRef.current?.focus()}
          returnKeyType="next"
          textContentType="name"
          value={displayName}
        />
        <WiseField
          ref={emailRef}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!submitting}
          error={errors.email}
          label="E-mail"
          nativeID="register-email"
          onChangeText={setEmail}
          onSubmitEditing={() => passwordRef.current?.focus()}
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
        />
        <AuthPasswordField
          ref={passwordRef}
          autoCapitalize="none"
          autoComplete="new-password"
          editable={!submitting}
          error={errors.password}
          label="Senha"
          maxLength={128}
          nativeID="register-password"
          onChangeText={setPassword}
          onSubmitEditing={() => confirmationRef.current?.focus()}
          returnKeyType="next"
          textContentType="newPassword"
          value={password}
        />
        <AuthPasswordField
          ref={confirmationRef}
          autoCapitalize="none"
          autoComplete="new-password"
          editable={!submitting}
          error={errors.passwordConfirmation}
          label="Confirmar senha"
          maxLength={128}
          nativeID="register-password-confirmation"
          onChangeText={setPasswordConfirmation}
          onSubmitEditing={() => {
            void handleSubmit();
          }}
          returnKeyType="go"
          textContentType="newPassword"
          value={passwordConfirmation}
        />
        {formError ? <FeedbackMessage message={formError} title="Erro" variant="error" /> : null}
        <WiseButton
          label="Criar personagem"
          loading={submitting}
          size="large"
          onPress={() => {
            void handleSubmit();
          }}
        />
        <AuthNavigationLink href="/entrar" label="Já tem uma conta? Entre na batalha" />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.space.stackDefault },
});
