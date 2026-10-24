import { useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { WiseButton, WiseCard, WiseField, WiseText, theme } from '@/design-system';
import { controlStyles } from '@/design-system/components/control-styles';
import { FeedbackMessage } from '@/design-system/components/FeedbackMessage';
import { useDevicePreference, useDevicePreferencesLoaded } from '@/core/preferences/device-preferences';
import type { ActiveRaid } from '@/features/guild/api';
import { FOCUS_CHOICES, FREE_FOCUS, focusChoiceLabel, type FocusChoice } from './focus-choice';
import { useRecentStudySessionSubjects } from './queries';
import { ForgeAction, ForgeCardTitle } from './forge-primitives';
import { styles } from './forge-styles';

export function DurationSettings({ selected, focusedDuration, startPending, onSelect, onFocus, onClose, inline = false }: {
  selected: FocusChoice;
  focusedDuration: FocusChoice | null;
  startPending: boolean;
  onSelect: (duration: FocusChoice) => void;
  onFocus: (duration: FocusChoice | null) => void;
  onClose: () => void;
  inline?: boolean;
}) {
  return <WiseCard style={inline ? styles.inlineSettingsCard : styles.sideCard}>
    <ForgeCardTitle>Quanto tempo você vai focar?</ForgeCardTitle>
    <View style={styles.presets} accessibilityRole="radiogroup">
      {FOCUS_CHOICES.map((duration) => (
        <Pressable
          accessibilityLabel={duration === FREE_FOCUS ? 'Foco livre, sem duração definida' : `${duration / 60} minutos`}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === duration, disabled: startPending }}
          aria-checked={selected === duration}
          aria-disabled={startPending}
          disabled={startPending}
          key={duration}
          onPress={() => onSelect(duration)}
          onFocus={() => onFocus(duration)}
          onBlur={() => onFocus(focusedDuration === duration ? null : focusedDuration)}
          style={[
            styles.preset,
            selected === duration && styles.selected,
            focusedDuration === duration && Platform.OS === 'web' && controlStyles.webFocus,
          ]}
          testID={duration === FREE_FOCUS ? 'study-duration-free' : `study-duration-${duration / 60}`}
        >
          <WiseText variant="label">{focusChoiceLabel(duration)}</WiseText>
        </Pressable>
      ))}
    </View>
    {inline ? null : <Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textSecondary }]}>Escolha uma duração, ou Livre para contar até parar, e inicie sua sessão.</Text>}
    <WiseButton label="Fechar configurações" onPress={onClose} variant="secondary" />
  </WiseCard>;
}

type RecentSubjectSuggestionsProps = {
  selectedSubject: string | null;
  disabled: boolean;
  onSelect: (subject: string) => void;
};

/** Mounts the list, and so its request, only once the stored preference is read and still on. */
function RecentSubjectSuggestions(props: RecentSubjectSuggestionsProps) {
  const [suggestRecentSubjects] = useDevicePreference('suggestRecentSubjects');
  const preferencesLoaded = useDevicePreferencesLoaded();
  return suggestRecentSubjects && preferencesLoaded ? <RecentSubjectSuggestionList {...props} /> : null;
}

/** Loading, failure and an empty history render nothing: suggestions must never get in the way of starting. */
function RecentSubjectSuggestionList({ selectedSubject, disabled, onSelect }: RecentSubjectSuggestionsProps) {
  const { data: subjects } = useRecentStudySessionSubjects();
  const [focusedSubject, setFocusedSubject] = useState<string | null>(null);
  if (!subjects?.length) return null;

  return (
    <View accessibilityLabel="Matérias recentes" role="group" style={styles.suggestions} testID="study-session-subject-suggestions">
      {subjects.map((subject) => {
        const selected = subject === selectedSubject;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            aria-selected={selected}
            disabled={disabled}
            hitSlop={{ top: 4, bottom: 4 }}
            key={subject}
            onBlur={() => setFocusedSubject((current) => (current === subject ? null : current))}
            onFocus={() => setFocusedSubject(subject)}
            onPress={() => onSelect(subject)}
            style={[
              styles.suggestion,
              selected && styles.selected,
              disabled && styles.actionButtonDisabled,
              focusedSubject === subject && Platform.OS === 'web' && controlStyles.webFocus,
            ]}
          >
            <Text allowFontScaling numberOfLines={1} style={[styles.suggestionText, selected && styles.suggestionTextSelected]}>{subject}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type SessionMode = 'solo' | 'guild';
export type ForgeRaid = { guildId: string; raid: ActiveRaid };

function SessionModeOptions({ mode, disabled, onSelect }: {
  mode: SessionMode;
  disabled: boolean;
  onSelect: (mode: SessionMode) => void;
}) {
  const [focusedMode, setFocusedMode] = useState<SessionMode | null>(null);
  const options: { value: SessionMode; label: string }[] = [
    { value: 'solo', label: 'Sessão solo' },
    { value: 'guild', label: 'Sessão de guilda' },
  ];
  return (
    <View accessibilityLabel="Tipo de sessão" accessibilityRole="radiogroup" style={styles.presets} testID="study-session-mode">
      {options.map((option) => (
        <Pressable
          accessibilityLabel={option.label}
          accessibilityRole="radio"
          accessibilityState={{ checked: mode === option.value, disabled }}
          aria-checked={mode === option.value}
          aria-disabled={disabled}
          disabled={disabled}
          key={option.value}
          onBlur={() => setFocusedMode((current) => (current === option.value ? null : current))}
          onFocus={() => setFocusedMode(option.value)}
          onPress={() => onSelect(option.value)}
          style={[styles.preset, mode === option.value && styles.selected, focusedMode === option.value && Platform.OS === 'web' && controlStyles.webFocus]}
          testID={`study-session-mode-${option.value}`}
        >
          <WiseText variant="label">{option.label}</WiseText>
        </Pressable>
      ))}
    </View>
  );
}


export type ForgePrepCardProps = {
  wide: boolean;
  selected: FocusChoice;
  focusedDuration: FocusChoice | null;
  settingsOpen: boolean;
  startPending: boolean;
  startLabel: string;
  startDisabled: boolean;
  subjectInput: string;
  subjectMessage: string | undefined;
  selectedSubject: string | null;
  forgeRaid: ForgeRaid | null;
  sessionMode: SessionMode;
  raidEndedNotice: boolean;
  dailyLimitReached: boolean;
  startFailed: boolean;
  onChangeSubject: (text: string) => void;
  onChangeMode: (mode: SessionMode) => void;
  onSelectDuration: (duration: FocusChoice) => void;
  onFocusDuration: (duration: FocusChoice | null) => void;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  onStart: () => void;
};

/** What sits under the Bigorna while a session is being prepared: Matéria, mode, duration and start. */
export function ForgePrepCard(props: ForgePrepCardProps) {
  const { width } = useWindowDimensions();
  const { forgeRaid, settingsOpen, startPending } = props;
  return <>
    <View style={styles.subjectSection}>
      <WiseField
        autoCapitalize="sentences"
        editable={!startPending}
        error={props.subjectMessage}
        label="Matéria (opcional)"
        onChangeText={props.onChangeSubject}
        placeholder="Ex.: Cálculo II"
        returnKeyType="done"
        testID="study-session-subject-input"
        value={props.subjectInput}
      />
      <RecentSubjectSuggestions
        disabled={startPending}
        onSelect={props.onChangeSubject}
        selectedSubject={props.selectedSubject}
      />
    </View>
    {forgeRaid ? (
      <View style={styles.subjectSection}>
        <SessionModeOptions disabled={startPending} mode={props.sessionMode} onSelect={props.onChangeMode} />
        {props.sessionMode === 'guild' ? (
          <Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textSecondary }]} testID="study-session-guild-raid">
            {forgeRaid.raid.me.participating
              ? `O XP desta sessão conta para a Raid ${forgeRaid.raid.mission.name}.`
              : `Você vai confirmar sua participação na Raid ${forgeRaid.raid.mission.name} e começar a sessão.`}
          </Text>
        ) : null}
      </View>
    ) : null}
    <View style={[styles.stageActions, width < 450 && styles.stageActionsCompact]}>
      {settingsOpen && !props.wide ? <DurationSettings selected={props.selected} focusedDuration={props.focusedDuration} startPending={startPending} onSelect={props.onSelectDuration} onFocus={props.onFocusDuration} onClose={props.onCloseSettings} inline /> : null}
      <View style={[styles.actionRow, width < 450 && styles.actionRowCompact]}>
        <View style={styles.actionButtonPlaceholder} />
        <ForgeAction icon="play" primary label={props.startLabel} loading={startPending} disabled={props.startDisabled} onPress={props.onStart} testID="study-session-start" />
        <ForgeAction icon="settings-outline" iconOnly label="Configurar duração" expanded={settingsOpen} onPress={props.onToggleSettings} />
      </View>
      {props.raidEndedNotice ? (
        <FeedbackMessage
          variant="error"
          title="A Raid foi encerrada"
          message="Não foi possível iniciar a sessão de guilda. Você pode iniciar uma sessão solo."
          testID="study-session-raid-ended"
        />
      ) : props.dailyLimitReached ? (
        <FeedbackMessage
          variant="error"
          title="Limite diário de foco atingido"
          message="O tempo de foco permitido por dia foi usado. Não é possível iniciar um novo foco agora."
          testID="study-session-daily-limit"
        />
      ) : props.startFailed ? <WiseText color="feedbackDanger" variant="body">Não foi possível confirmar o início. Tente novamente.</WiseText> : null}
    </View>
  </>;
}

/** Setup's support column: the duration picker replaces the card on a wide screen while the settings are open. */
export function ForgeSetupSupport({ wide, settingsOpen, ...duration }: {
  wide: boolean;
  settingsOpen: boolean;
  selected: FocusChoice;
  focusedDuration: FocusChoice | null;
  startPending: boolean;
  onSelect: (duration: FocusChoice) => void;
  onFocus: (duration: FocusChoice | null) => void;
  onClose: () => void;
}) {
  return settingsOpen && wide ? <DurationSettings {...duration} /> : <WiseCard style={styles.sideCard}>
    <ForgeCardTitle>Seu progresso</ForgeCardTitle>
    <Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textSecondary }]}>O foco válido e o XP aparecem ao concluir a sessão.</Text>
    <Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textTertiary }]}>Se encerrar antes de 5 minutos, a sessão não concede XP.</Text>
  </WiseCard>;
}
