import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { WiseCard, WiseField, WiseText, theme } from '@/design-system';
import { controlStyles } from '@/design-system/components/control-styles';
import { FeedbackMessage } from '@/design-system/components/FeedbackMessage';
import { useDevicePreference, useDevicePreferencesLoaded } from '@/core/preferences/device-preferences';
import type { ActiveRaid } from '@/features/guild/api';
import { FOCUS_CHOICES, FREE_FOCUS, focusChoiceLabel, type FocusChoice } from './focus-choice';
import { useRecentStudySessionSubjects } from './queries';
import { ForgeAction, ForgeCardTitle } from './forge-primitives';
import { styles } from './forge-styles';

type SegmentOption<T extends string | number> = { value: T; label: string; accessibilityLabel?: string; testID: string };

/** A radiogroup of mutually exclusive options: the Forja's Duração and Modo. Arrow-key focus is the platform's own. */
function ForgeSegmented<T extends string | number>({ label, options, value, disabled, onSelect, testID }: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  disabled: boolean;
  onSelect: (value: T) => void;
  testID?: string;
}) {
  const [focused, setFocused] = useState<T | null>(null);
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.segmented} testID={testID}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <Pressable
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked, disabled }}
            aria-checked={checked}
            aria-disabled={disabled}
            disabled={disabled}
            key={option.value}
            onBlur={() => setFocused((current) => (current === option.value ? null : current))}
            onFocus={() => setFocused(option.value)}
            onPress={() => onSelect(option.value)}
            style={[styles.segment, checked && styles.segmentActive, focused === option.value && Platform.OS === 'web' && controlStyles.webFocus]}
            testID={option.testID}
          >
            <Text allowFontScaling numberOfLines={1} style={[styles.segmentText, checked && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const DURATION_OPTIONS: readonly SegmentOption<FocusChoice>[] = FOCUS_CHOICES.map((duration) => ({
  value: duration,
  label: focusChoiceLabel(duration),
  accessibilityLabel: duration === FREE_FOCUS ? 'Foco livre, sem duração definida' : `${duration / 60} minutos`,
  testID: duration === FREE_FOCUS ? 'study-duration-free' : `study-duration-${duration / 60}`,
}));

const MODE_OPTIONS: readonly SegmentOption<SessionMode>[] = [
  { value: 'solo', label: 'Solo', accessibilityLabel: 'Sessão solo', testID: 'study-session-mode-solo' },
  { value: 'guild', label: 'Guilda', accessibilityLabel: 'Sessão de guilda', testID: 'study-session-mode-guild' },
];

type RecentSubjectSuggestionsProps = {
  selectedSubject: string | null;
  disabled: boolean;
  /** A phone scrolls the chips sideways instead of wrapping them. */
  compact: boolean;
  onSelect: (subject: string) => void;
};

/** Mounts the list, and so its request, only once the stored preference is read and still on. */
function RecentSubjectSuggestions(props: RecentSubjectSuggestionsProps) {
  const [suggestRecentSubjects] = useDevicePreference('suggestRecentSubjects');
  const preferencesLoaded = useDevicePreferencesLoaded();
  return suggestRecentSubjects && preferencesLoaded ? <RecentSubjectSuggestionList {...props} /> : null;
}

/** Loading, failure and an empty history render nothing: suggestions must never get in the way of starting. */
function RecentSubjectSuggestionList({ selectedSubject, disabled, compact, onSelect }: RecentSubjectSuggestionsProps) {
  const { data: subjects } = useRecentStudySessionSubjects();
  const [focusedSubject, setFocusedSubject] = useState<string | null>(null);
  if (!subjects?.length) return null;

  const chips = (
    <View accessibilityLabel="Matérias recentes" role="group" style={compact ? styles.suggestionsScroll : styles.suggestions} testID="study-session-subject-suggestions">
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
  return compact ? <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="study-session-subject-scroll">{chips}</ScrollView> : chips;
}

export type SessionMode = 'solo' | 'guild';
export type ForgeRaid = { guildId: string; raid: ActiveRaid };

export type ForgePrepCardProps = {
  /** A phone: no card, the chips scroll sideways and the start button lives in the screen's footer. */
  compact: boolean;
  selected: FocusChoice;
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
  onStart: () => void;
};

/** The start button: inside the "Prepare sua forja" card, or pinned above the tab bar on a phone. */
export function ForgeStartButton({ label, loading, disabled, onPress }: { label: string; loading: boolean; disabled: boolean; onPress: () => void }) {
  return <ForgeAction fullWidth icon="play" primary label={label} loading={loading} disabled={disabled} onPress={onPress} testID="study-session-start" />;
}

function StartFeedback({ raidEndedNotice, dailyLimitReached, startFailed }: Pick<ForgePrepCardProps, 'raidEndedNotice' | 'dailyLimitReached' | 'startFailed'>) {
  if (raidEndedNotice) {
    return <FeedbackMessage
      variant="error"
      title="A Raid foi encerrada"
      message="Não foi possível iniciar a sessão de guilda. Você pode iniciar uma sessão solo."
      testID="study-session-raid-ended"
    />;
  }
  if (dailyLimitReached) {
    return <FeedbackMessage
      variant="error"
      title="Limite diário de foco atingido"
      message="O tempo de foco permitido por dia foi usado. Não é possível iniciar um novo foco agora."
      testID="study-session-daily-limit"
    />;
  }
  return startFailed ? <WiseText color="feedbackDanger" variant="body">Não foi possível confirmar o início. Tente novamente.</WiseText> : null;
}

/** Duração, Matéria and, with an active Raid, Modo: the "Prepare sua forja" card on a wide screen, bare fields on a phone. */
export function ForgePrepCard(props: ForgePrepCardProps) {
  const { compact, forgeRaid, startPending } = props;
  const durations = <ForgeSegmented disabled={startPending} label="Duração" onSelect={props.onSelectDuration} options={DURATION_OPTIONS} testID="study-session-duration" value={props.selected} />;
  const subject = (
    <View style={styles.fieldGroup}>
      <WiseField
        autoCapitalize="sentences"
        editable={!startPending}
        error={props.subjectMessage}
        hint={compact ? undefined : 'OPCIONAL'}
        label={compact ? 'Matéria (opcional)' : 'Matéria'}
        onChangeText={props.onChangeSubject}
        placeholder="Ex.: Cálculo II"
        returnKeyType="done"
        testID="study-session-subject-input"
        value={props.subjectInput}
      />
      <RecentSubjectSuggestions compact={compact} disabled={startPending} onSelect={props.onChangeSubject} selectedSubject={props.selectedSubject} />
    </View>
  );
  const mode = forgeRaid ? (
    <View style={styles.fieldGroup}>
      <ForgeSegmented disabled={startPending} label="Tipo de sessão" onSelect={props.onChangeMode} options={MODE_OPTIONS} testID="study-session-mode" value={props.sessionMode} />
      {props.sessionMode === 'guild' ? (
        <Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textSecondary }]} testID="study-session-guild-raid">
          {forgeRaid.raid.me.participating
            ? `O XP desta sessão conta para a Raid ${forgeRaid.raid.mission.name}.`
            : `Você vai confirmar sua participação na Raid ${forgeRaid.raid.mission.name} e começar a sessão.`}
        </Text>
      ) : null}
    </View>
  ) : null;
  const feedback = <StartFeedback dailyLimitReached={props.dailyLimitReached} raidEndedNotice={props.raidEndedNotice} startFailed={props.startFailed} />;

  if (compact) {
    return <View style={styles.prepFlat}>{durations}{subject}{mode}{feedback}</View>;
  }
  return (
    <WiseCard style={styles.prepCard} testID="study-session-prep">
      <ForgeCardTitle>Prepare sua forja</ForgeCardTitle>
      <View style={styles.fieldGroup}><Text allowFontScaling style={styles.fieldLabel}>Duração</Text>{durations}</View>
      {subject}
      {mode ? <View style={styles.fieldGroup}><Text allowFontScaling style={styles.fieldLabel}>Modo</Text>{mode}</View> : null}
      <ForgeStartButton disabled={props.startDisabled} label={props.startLabel} loading={startPending} onPress={props.onStart} />
      {feedback}
    </WiseCard>
  );
}
