import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseText, theme } from '@/design-system';
import { RadioMark } from '@/features/character/character-art';
import { CharacterModal, usePanelStyle } from '@/features/character/equipment-drawer';
import { SectionHeader, useFocusRing } from '@/features/character/character-parts';
import { chooseNextMission, type AvailableMission, type GuildRole, type MissionOwner, type NextMissionChoice } from './api';
import {
  NEXT_MISSION_LOCK_NOTICE, NEXT_MISSION_ROTATION_NOTICE, chooseNextMissionErrorMessage, formatMissionOwner,
} from './messages';
import { availableMissionsQueryOptions, guildKeys, nextMissionQueryOptions } from './queries';

/* Escolha da Missão da próxima Raid pelo Líder (ADR-012): card "Próxima Raid" da 06c e a gaveta "Publicar missão". */

/** One row of the drawer: a Missão and whose it is. A priced Missão appears once per owner. */
type MissionOption = { key: string; mission: AvailableMission; owner: MissionOwner | null };

function optionsOf(missions: readonly AvailableMission[]): MissionOption[] {
  return missions.flatMap((mission): MissionOption[] => mission.owners.length
    ? mission.owners.map((owner) => ({ key: `${mission.id}:${owner.userId}`, mission, owner }))
    : [{ key: mission.id, mission, owner: null }]);
}

function optionKeyOf(choice: NextMissionChoice | null | undefined): string | null {
  if (!choice) return null;
  return choice.owner ? `${choice.mission.id}:${choice.owner.userId}` : choice.mission.id;
}

/** "Missão de <nome>" / "Missão do rodízio", the seal of the Raid card and of the Raid screen. */
export function MissionOwnerSeal({ owner, testID }: { owner: MissionOwner | null; testID: string }) {
  return <Text style={styles.seal} testID={testID}>{formatMissionOwner(owner)}</Text>;
}

function OptionRow({ onSelect, option, selected }: { onSelect: () => void; option: MissionOption; selected: boolean }) {
  const { focusProps, focusStyle } = useFocusRing();
  const caption = formatMissionOwner(option.owner);
  return <Pressable
    {...focusProps}
    accessibilityLabel={`${option.mission.name}, ${caption}`}
    accessibilityRole="radio"
    accessibilityState={{ checked: selected }}
    aria-checked={selected}
    onPress={onSelect}
    style={StyleSheet.flatten([styles.option, selected && styles.optionSelected, focusStyle])}
    testID={`mission-choice-option-${option.key}`}
  >
    <View style={styles.optionCopy}>
      <Text numberOfLines={1} style={styles.optionName}>{option.mission.name}</Text>
      <Text numberOfLines={1} style={styles.optionCaption}>{caption}</Text>
    </View>
    <RadioMark selected={selected} />
  </Pressable>;
}

function ChoicePanel({ desktop, guildId, onClose }: { desktop: boolean; guildId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const available = useQuery(availableMissionsQueryOptions(guildId));
  const current = useQuery(nextMissionQueryOptions(guildId));
  const options = optionsOf(available.data ?? []);
  const [picked, setPicked] = useState<string | null>(null);
  const selectedKey = picked ?? optionKeyOf(current.data);
  const selected = options.find((option) => option.key === selectedKey) ?? null;
  const panelStyle = usePanelStyle(desktop ? 'drawer' : 'sheet');
  const { focusProps, focusStyle } = useFocusRing();

  const save = useMutation({
    mutationFn: (option: MissionOption) => chooseNextMission(guildId, option.owner ? { missionId: option.mission.id, ownerId: option.owner.userId } : { missionId: option.mission.id }),
    onSuccess: (choice) => {
      queryClient.setQueryData(guildKeys.nextMission(guildId), choice);
      onClose();
    },
    // The owner may have left or sold nothing anymore: show what is available now.
    onError: (error) => {
      if ((error as { status?: number }).status === 422 || (error as { status?: number }).status === 404) {
        void queryClient.invalidateQueries({ queryKey: guildKeys.availableMissions(guildId) });
      }
    },
  });

  const list = (() => {
    if (available.isPending) return <Text style={styles.note}>Carregando as Missões da guilda…</Text>;
    if (available.isError) {
      return <View style={styles.stack} testID="mission-choice-load-error">
        <FeedbackMessage message="Não foi possível carregar as Missões da guilda." title="Missões indisponíveis" variant="error" />
        <WiseButton label="Tentar novamente" loading={available.isRefetching} onPress={() => void available.refetch()} variant="secondary" />
      </View>;
    }
    if (!options.length) return <Text style={styles.note}>Nenhuma Missão disponível na guilda ainda.</Text>;
    return options.map((option) => <OptionRow key={option.key} onSelect={() => { save.reset(); setPicked(option.key); }} option={option} selected={option.key === selected?.key} />);
  })();

  return <View accessibilityLabel="Escolher a Missão da próxima Raid" aria-modal accessibilityViewIsModal role="dialog" style={panelStyle} testID="mission-choice-drawer">
    <View style={styles.top}>
      <View style={styles.topCopy}>
        <Text accessibilityRole="header" aria-level={2} style={styles.title}>Escolher missão</Text>
        <Text style={styles.description}>Entre as Missões dos membros atuais, a escolhida vira a próxima Raid.</Text>
      </View>
      <Pressable {...focusProps} accessibilityLabel="Fechar" accessibilityRole="button" hitSlop={8} onPress={onClose} style={StyleSheet.flatten([styles.close, focusStyle])}>
        <Text style={styles.closeGlyph}>✕</Text>
      </Pressable>
    </View>
    <ScrollView accessibilityLabel="Missões da guilda" accessibilityRole="radiogroup" contentContainerStyle={styles.options} style={styles.scroll}>{list}</ScrollView>
    <Text style={styles.note} testID="mission-choice-lock-notice">{NEXT_MISSION_LOCK_NOTICE}</Text>
    {save.isError ? <FeedbackMessage message={chooseNextMissionErrorMessage(save.error)} testID="mission-choice-error" title="Escolha não salva" variant="error" /> : null}
    <View style={styles.footer}>
      <View style={styles.footerAction}><WiseButton label="Cancelar" onPress={onClose} variant="secondary" /></View>
      <View style={styles.footerAction}>
        <WiseButton disabled={!selected || save.isPending} label="Confirmar escolha" loading={save.isPending} onPress={() => { if (selected && !save.isPending) save.mutate(selected); }} />
      </View>
    </View>
  </View>;
}

/** Card "Próxima Raid" (Figma 06c): the chosen Missão (or the rotation) for everyone, and "Escolher missão" for the Leader. */
export function NextRaidCard({ desktop, guildId, role }: { desktop: boolean; guildId: string; role: GuildRole }) {
  const next = useQuery(nextMissionQueryOptions(guildId));
  const [open, setOpen] = useState(false);
  const leader = role === 'leader';

  const body = (() => {
    if (next.isPending) return <WiseText color="textSecondary" testID="next-raid-loading" variant="body">Carregando a próxima Raid…</WiseText>;
    if (next.isError && next.data === undefined) {
      return <View style={styles.stack} testID="next-raid-error">
        <FeedbackMessage message="Não foi possível carregar a Missão da próxima Raid." title="Próxima Raid indisponível" variant="error" />
        <WiseButton label="Tentar novamente" loading={next.isRefetching} onPress={() => void next.refetch()} variant="secondary" />
      </View>;
    }
    const choice = next.data;
    if (!choice) return <Text style={styles.cardText} testID="next-raid-rotation">{NEXT_MISSION_ROTATION_NOTICE}</Text>;
    return <View style={styles.stack}>
      <Text accessibilityRole="header" aria-level={3} style={styles.missionName} testID="next-raid-mission-name">{choice.mission.name}</Text>
      <MissionOwnerSeal owner={choice.owner} testID="next-raid-owner" />
      {desktop ? <Text style={styles.cardText}>{choice.mission.description}</Text> : null}
    </View>;
  })();

  return <View accessibilityLabel="Próxima Raid" role="region" style={styles.block} testID="next-raid">
    <SectionHeader>Próxima Raid</SectionHeader>
    <View style={styles.card}>
      {body}
      {leader ? <>
        <Text style={styles.note}>{NEXT_MISSION_LOCK_NOTICE}</Text>
        <WiseButton label="Escolher missão" onPress={() => setOpen(true)} testID="next-raid-choose" variant="secondary" />
      </> : null}
    </View>
    {open ? <CharacterModal onClose={() => setOpen(false)} testID="mission-choice-modal" variant={desktop ? 'drawer' : 'sheet'}>
      <ChoicePanel desktop={desktop} guildId={guildId} onClose={() => setOpen(false)} />
    </CharacterModal> : null}
  </View>;
}

const inter = { regular: 'Inter-Regular', semiBold: 'Inter-SemiBold' } as const;
const mono = 'JetBrainsMono-Medium';

const styles = StyleSheet.create({
  block: { gap: theme.space.stackTight },
  card: { gap: 14, padding: theme.space.cardInset, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  stack: { gap: theme.space.stackTight },
  missionName: { fontFamily: 'Cinzel-Bold', fontSize: 20, lineHeight: 26, color: theme.color.textPrimary },
  seal: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.color.accentPrimary },
  cardText: { fontFamily: inter.regular, fontSize: 14, lineHeight: 19, color: theme.color.textSecondary },
  note: { fontFamily: inter.regular, fontSize: 13, lineHeight: 18, color: theme.color.textSecondary },

  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.space.stackTight },
  topCopy: { flexShrink: 1, gap: 6 },
  title: { fontFamily: 'Cinzel-Bold', fontSize: 22, lineHeight: 30, color: theme.color.textPrimary },
  description: { fontFamily: inter.regular, fontSize: 13, lineHeight: 16, color: theme.color.textSecondary },
  close: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis },
  closeGlyph: { fontFamily: inter.regular, fontSize: 14, lineHeight: 17, color: theme.color.textSecondary },
  scroll: { flexShrink: 1 },
  options: { gap: 10 },
  footer: { flexDirection: 'row', gap: theme.space.stackTight },
  footerAction: { flex: 1 },

  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 16, borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset },
  optionSelected: { borderColor: theme.color.accentPrimary, backgroundColor: theme.color.surfaceCard },
  optionCopy: { flex: 1, minWidth: 0, gap: 2 },
  optionName: { fontFamily: inter.semiBold, fontSize: 15, lineHeight: 18, color: theme.color.textPrimary },
  optionCaption: { fontFamily: inter.regular, fontSize: 12, lineHeight: 15, color: theme.color.textTertiary },
});
