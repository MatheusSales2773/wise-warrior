import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isApiError } from '@/core/api/api-error';
import { FeedbackMessage, WiseButton, WiseField, WiseIcon, theme } from '@/design-system';
import { useFocusRing } from '@/features/character/character-parts';
import type { UserProfile } from '@/features/dashboard/api';
import { dashboardKeys, profileQueryOptions } from '@/features/dashboard/queries';
import { guildKeys } from '@/features/guild/queries';
import { updateMyDisplayName } from './api';
import { AccountHeader } from './settings-content';

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 60;

/** The backend's rule for a warrior name, on the name as it will be saved (trimmed). */
export function isValidDisplayName(name: string): boolean {
  const length = name.trim().length;
  return length >= DISPLAY_NAME_MIN && length <= DISPLAY_NAME_MAX;
}

const RULE_MESSAGE = `O nome precisa ter de ${DISPLAY_NAME_MIN} a ${DISPLAY_NAME_MAX} letras.`;

function failureMessage(error: unknown): string {
  if (isApiError(error) && error.category === 'network') return 'Sem conexão. Verifique sua internet e tente de novo; seu nome não foi alterado.';
  if (isApiError(error) && error.category === 'validation') return RULE_MESSAGE;
  return 'Não foi possível salvar o nome agora. Tente novamente em instantes.';
}

/** Saves the name, then refreshes everything that shows it: the profile, the Configuração header, the Personagem and the Guilda. */
function useRenameWarrior() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => updateMyDisplayName(displayName),
    onSuccess: (profile) => {
      queryClient.setQueryData<UserProfile>(dashboardKeys.profile(), profile);
      // Guild members, Raid ranking and the Mural read the name through the Guilda queries.
      void queryClient.invalidateQueries({ queryKey: guildKeys.all });
    },
  });
}

function PersonagemShortcut() {
  const { focusProps, focusStyle } = useFocusRing();
  return <Link asChild href="/perfil">
    <Pressable {...focusProps} accessibilityRole="link" style={StyleSheet.flatten([styles.shortcut, focusStyle])}>
      <Text style={styles.shortcutText}>Título e aparência são escolhidos no</Text>
      <Text style={styles.shortcutLink}>Personagem</Text>
      <WiseIcon color="textSecondary" name="chevron-forward" size="xsmall" />
    </Pressable>
  </Link>;
}

/** The name field with "Salvar", shared by the desktop card and the phone's edit screen. */
export function RenameForm({ user }: { user: UserProfile }) {
  const [name, setName] = useState(user.displayName);
  const rename = useRenameWarrior();
  const changed = name.trim() !== user.displayName;
  const valid = isValidDisplayName(name);
  const canSave = changed && valid && !rename.isPending;
  const save = () => {
    if (!canSave) return;
    const trimmed = name.trim();
    rename.mutate(trimmed, { onSuccess: () => setName(trimmed) });
  };

  return <View style={styles.form} testID="settings-rename-form">
    <WiseField
      autoCapitalize="words"
      autoComplete="name"
      error={changed && !valid ? RULE_MESSAGE : undefined}
      hint={`${DISPLAY_NAME_MIN}–${DISPLAY_NAME_MAX} letras`}
      label="Nome do guerreiro"
      maxLength={DISPLAY_NAME_MAX}
      onChangeText={(text) => { setName(text); if (!rename.isIdle) rename.reset(); }}
      onSubmitEditing={save}
      returnKeyType="done"
      value={name}
    />
    {rename.isError ? <FeedbackMessage message={failureMessage(rename.error)} title="Nome não salvo" variant="error" /> : null}
    {rename.isSuccess ? <FeedbackMessage message="Seu nome na guilda foi atualizado." title="Nome salvo" variant="success" /> : null}
    <View style={styles.actions}>
      <WiseButton disabled={!canSave} label="Salvar" loading={rename.isPending} onPress={save} />
    </View>
    <PersonagemShortcut />
  </View>;
}

/** Shows `render` once the profile is loaded, and the account header's loading and failure states until then. */
export function WithProfile({ render }: { render: (user: UserProfile) => ReactNode }) {
  const profile = useQuery(profileQueryOptions());
  return profile.data ? render(profile.data) : <AccountHeader />;
}

/** The phone's edit screen body: the same form, without the card. */
export function RenameContent() {
  return <WithProfile render={(user) => <RenameForm user={user} />} />;
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  actions: { alignItems: 'flex-start' },
  shortcut: { minHeight: theme.layout.touchTarget, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  shortcutText: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 16, color: theme.color.textSecondary },
  shortcutLink: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.accentPrimary },
});
