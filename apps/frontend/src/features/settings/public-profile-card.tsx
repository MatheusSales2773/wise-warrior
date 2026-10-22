import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/design-system';
import { equippedItems } from '@/features/character/catalog';
import { HeroGlow } from '@/features/character/character-art';
import { LayeredHero } from '@/features/character/layered-hero';
import type { UserProfile } from '@/features/dashboard/api';
import { RenameForm, WithProfile } from './rename-form';

// The Figma "Perfil público" avatar: a 96 × 112 frame holding the Herói at 4× and a glow behind it.
const AVATAR = { width: 96, height: 112, heroScale: 4, glowSize: 134.4, glowTop: -12.2, glowLeft: -20.2, heroTop: 11, heroLeft: 15 };

function PublicProfileCard({ user }: { user: UserProfile }) {
  return <View style={styles.card} testID="settings-public-profile">
    <View style={styles.header}>
      <Text style={styles.title}>◈  Perfil público</Text>
      <Text style={styles.note}>Visível para sua guilda</Text>
    </View>
    <View style={styles.body}>
      <View style={styles.avatar}>
        <HeroGlow height={AVATAR.glowSize} opacity={0.24} style={styles.glow} width={AVATAR.glowSize} />
        <LayeredHero equipped={equippedItems(user)} scale={AVATAR.heroScale} style={styles.hero} />
      </View>
      <View style={styles.form}><RenameForm user={user} /></View>
    </View>
  </View>;
}

/** Desktop Conta e segurança: the "Perfil público" card, with the same loading and failure states as the account header. */
export function PublicProfile() {
  return <WithProfile render={(user) => <PublicProfileCard user={user} />} />;
}

const styles = StyleSheet.create({
  card: { gap: theme.space.controlInset, padding: 22, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: 'Cinzel-Bold', fontSize: 11, lineHeight: 15, letterSpacing: 2.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  note: { fontFamily: 'JetBrainsMono-Medium', fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: theme.color.textTertiary },
  body: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  form: { flex: 1, minWidth: 0 },
  avatar: { width: AVATAR.width, height: AVATAR.height, overflow: 'hidden', borderRadius: 5, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceInset },
  glow: { position: 'absolute', top: AVATAR.glowTop, left: AVATAR.glowLeft },
  hero: { position: 'absolute', top: AVATAR.heroTop, left: AVATAR.heroLeft },
});
