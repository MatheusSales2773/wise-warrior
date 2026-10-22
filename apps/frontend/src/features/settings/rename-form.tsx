import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isApiError } from '@/core/api/api-error';
import { FeedbackMessage, WiseButton, WiseField, WiseIcon, theme } from '@/design-system';
import { HeroGlow } from '@/features/character/character-art';
import { equippedItems } from '@/features/character/catalog';
import { useFocusRing } from '@/features/character/character-parts';
import { LayeredHero } from '@/features/character/layered-hero';
import type { UserProfile } from '@/features/dashboard/api';
import { dashboardKeys, profileQueryOptions } from '@/features/dashboard/queries';
import { guildKeys } from '@/features/guild/queries';
import { AccountHeader } from './settings-content';
import { updateMyDisplayName } from './api';

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 60;

/** The backend's rule for a warrior name, on the name as it will be saved (trimmed). */
export function isValidDisplayName(name: string): boolean {
  const length = name.trim().length;
  return length >= DISPLAY_NAME_MIN && length <= DISPLAY_NAME_MAX;
}

function failureMessage(error: unknown): string {
  if (isApiError(error) && error.category === 'network') return 'Sem conexão. Verifique sua internet e tente de novo; seu nome não foi alterado.';
  if (isApiError(error) && error.category === 'validation') return `O nome precisa ter de ${DISPLAY_NAME_MIN} a ${DISPLAY_NAME_MAX} letras.`;
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
      error={changed && !valid ? `O nome precisa ter de ${DISPLAY_NAME_MIN} a ${DISPLAY_NAME_MAX} letras.` : undefined}
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

/** The desktop card "Perfil público": the warrior beside the rename form. */
function PublicProfileCard({ user }: { user: UserProfile }) {
  return <View style={styles.card} testID="settings-public-profile">
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>◈  Perfil público</Text>
      <Text style={styles.cardNote}>Visível para sua guilda</Text>
    </View>
    <View style={styles.cardBody}>
      <View style={styles.avatar}>
        <HeroGlow height={134.4} opacity={0.24} style={styles.glow} width={134.4} />
        <LayeredHero equipped={equippedItems(user)} scale={4} style={styles.hero} />
      </View>
      <View style={styles.cardForm}><RenameForm user={user} /></View>
    </View>
  </View>;
}

/** Desktop Conta e segurança: the "Perfil público" card, with the same loading and failure states as the account header. */
export function PublicProfile() {
  const profile = useQuery(profileQueryOptions());
  return profile.data ? <PublicProfileCard user={profile.data} /> : <AccountHeader />;
}

/** The phone's edit screen body: the same form, without the card. */
export function RenameContent() {
  const profile = useQuery(profileQueryOptions());
  return profile.data ? <RenameForm user={profile.data} /> : <AccountHeader />;
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  actions: { alignItems: 'flex-start' },
  shortcut: { minHeight: theme.layout.touchTarget, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  shortcutText: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 16, color: theme.color.textSecondary },
  shortcutLink: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.accentPrimary },
  card: { gap: theme.space.controlInset, padding: 22, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontFamily: 'Cinzel-Bold', fontSize: 11, lineHeight: 15, letterSpacing: 2.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  cardNote: { fontFamily: 'JetBrainsMono-Medium', fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: theme.color.textTertiary },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  cardForm: { flex: 1, minWidth: 0 },
  avatar: { width: 96, height: 112, overflow: 'hidden', borderRadius: 5, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceInset },
  glow: { position: 'absolute', top: -12.2, left: -20.2 },
  hero: { position: 'absolute', top: 11, left: 15 },
});
