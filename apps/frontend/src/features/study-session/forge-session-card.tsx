import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { WiseButton, WiseCard, WiseText, theme } from '@/design-system';
import { FeedbackMessage } from '@/design-system/components/FeedbackMessage';
import { profileQueryOptions } from '@/features/dashboard/queries';
import { useSessionsObjective } from '@/features/chronicles/queries';
import { StopConfirmation, type StopKind } from './stop-confirmation';
import { ForgeCardTitle } from './forge-primitives';
import { goalLine, levelLine } from './meanwhile';
import { styles } from './forge-styles';
import { formatElapsedTime } from './timer';

/** The one thing the controls row shows, decided by the screen from the session's command and completion state. */
export type ForgeSessionControl =
  | { kind: 'retry-completion'; onRetry: () => void }
  | { kind: 'refresh-waiting'; onRefresh: () => void }
  | { kind: 'refresh-conflict'; fetching: boolean; onRefresh: () => void }
  | { kind: 'retry-transition'; label: string; onRetry: () => void }
  | {
    kind: 'controls';
    stop: { label: string; loading: boolean; disabled: boolean; onPress: () => void };
    main: { icon: 'pause' | 'play'; label: string; loading: boolean; disabled: boolean; onPress: () => void; testID: string };
  }
  | { kind: 'none' };

/** On the compact layout the buttons share a row, so they show the first word; the accessible name stays whole. */
function shortLabel(label: string): string {
  const [first = label] = label.split(' ');
  const word = first.replace('…', '');
  return label.endsWith('…') ? `${word}…` : word;
}

/** Pause/resume and stop of a running or paused session, or the one recovery action that replaces them. */
export function ForgeSessionActions({ control, stopConfirmation, compact }: {
  control: ForgeSessionControl;
  stopConfirmation: { kind: StopKind; onConfirm: () => void; onDecline: () => void } | null;
  compact: boolean;
}) {
  const body = (() => {
    switch (control.kind) {
      case 'retry-completion':
        return <WiseButton label="Tentar confirmar novamente" onPress={control.onRetry} variant="secondary" testID="study-session-completion-retry" />;
      case 'refresh-waiting':
        return <WiseButton label="Atualizar estado" onPress={control.onRefresh} variant="secondary" testID="study-session-completion-refresh" />;
      case 'refresh-conflict':
        return (
          <WiseButton
            label={control.fetching ? 'Atualizando estado…' : 'Atualizar estado'}
            loading={control.fetching}
            disabled={control.fetching}
            onPress={control.onRefresh}
            variant="secondary"
            testID="study-session-completion-refresh"
          />
        );
      case 'retry-transition':
        return <WiseButton label={control.label} onPress={control.onRetry} variant="secondary" testID="study-session-transition-retry" />;
      case 'controls': {
        const buttons = [
          { ...control.main, variant: 'secondary' as const, icon: <Ionicons name={control.main.icon} size={12} color={theme.color.textPrimary} /> },
          { ...control.stop, variant: 'danger' as const, icon: <Ionicons name="stop" size={12} color={theme.color.feedbackDanger} />, testID: 'study-session-stop' },
        ];
        return (
          <View style={compact ? styles.actionsCompact : styles.actionsStacked}>
            {buttons.map(({ icon, variant, label, ...button }) => (
              <View key={variant} style={compact ? styles.actionCompactCell : undefined}>
                <WiseButton
                  accessibilityLabel={label}
                  label={compact ? shortLabel(label) : label}
                  leading={icon}
                  loading={button.loading}
                  disabled={button.disabled}
                  onPress={button.onPress}
                  testID={button.testID}
                  variant={variant}
                />
              </View>
            ))}
          </View>
        );
      }
      case 'none':
        return null;
    }
  })();
  return <>
    {body}
    {stopConfirmation ? <StopConfirmation kind={stopConfirmation.kind} onConfirm={stopConfirmation.onConfirm} onDecline={stopConfirmation.onDecline} /> : null}
  </>;
}

/** What stopping does, told before the user reaches for the button: a Foco livre has no early end, only a conclusion. */
export function ForgeStopNotice({ free }: { free: boolean }) {
  return (
    <Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textTertiary }]} testID="study-session-stop-notice">
      {free
        ? 'Parar conclui o foco livre. Com menos de 5 minutos de foco, não concede XP.'
        : 'Encerrar antes do fim registra apenas o foco válido até agora.'}
    </Text>
  );
}

export type ForgeSessionFeedbackProps = {
  transitionError: { versionConflict: boolean; needsCanonicalRefresh: boolean; refreshFailed: boolean } | null;
  completionError: boolean;
  completionConflict: { fetching: boolean } | null;
  sessionStatus: string;
};

/** Errors of the last command or completion, and the status line that announces what the session is doing. */
export function ForgeSessionFeedback({ transitionError, completionError, completionConflict, sessionStatus }: ForgeSessionFeedbackProps) {
  return <>
    {transitionError ? (
      <FeedbackMessage
        variant="error"
        title={transitionError.versionConflict ? 'A sessão mudou desde a última confirmação.' : 'Não foi possível confirmar a ação'}
        message={transitionError.versionConflict
          ? transitionError.needsCanonicalRefresh
            ? transitionError.refreshFailed
              ? 'Não foi possível atualizar o estado. O último snapshot confirmado continua visível; atualize antes de enviar outra ação.'
              : 'Atualizando o snapshot confirmado para liberar um novo comando seguro.'
            : 'O estado atual foi carregado. Confira a sessão e envie uma nova ação.'
          : 'A sessão continua no último estado confirmado. Tente novamente para repetir o mesmo comando com segurança.'}
        testID="study-session-transition-error"
      />
    ) : null}
    {completionError ? (
      <FeedbackMessage
        variant="error"
        title="Não foi possível confirmar a conclusão."
        message="O último snapshot continua visível. Tente novamente para recuperar o resultado usando a mesma confirmação."
        testID="study-session-completion-error"
      />
    ) : null}
    {completionConflict ? (
      <FeedbackMessage
        variant="error"
        title="A sessão mudou antes da conclusão."
        message={completionConflict.fetching
          ? 'Atualizando o snapshot canônico da sessão.'
          : 'Atualize o estado para continuar com a versão confirmada pelo servidor.'}
        testID="study-session-completion-conflict"
      />
    ) : null}
    <WiseText accessibilityLiveRegion="polite" aria-live="polite" color="textSecondary" testID="study-session-state" variant="body">{sessionStatus}</WiseText>
  </>;
}

function Row({ label, value, testID, valueTestID }: { label: string; value: string; testID?: string; valueTestID?: string }) {
  return (
    <View style={styles.statRow} testID={testID}>
      <Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textSecondary }]}>{label}</Text>
      <WiseText color="accentHighlight" numberOfLines={1} style={styles.rowValue} testID={valueTestID} variant="mono">{value}</WiseText>
    </View>
  );
}

/** "Sessão atual": the facts of the session, and on the wide layout its controls and their feedback. */
export function ForgeSessionCard({ guild, subject, free, plannedLabel, validFocusSeconds, pauseCount, children }: {
  guild: boolean;
  subject: string;
  free: boolean;
  plannedLabel: string;
  validFocusSeconds: number;
  pauseCount: number | undefined;
  /** Controls and feedback, only where the layout keeps them in the card. */
  children?: React.ReactNode;
}) {
  return (
    <WiseCard style={styles.sideCard} testID="study-session-card">
      <View style={styles.cardHeader}>
        <ForgeCardTitle>Sessão atual</ForgeCardTitle>
        <Text allowFontScaling style={styles.modeTag} testID="study-session-mode-tag">{guild ? 'GUILDA' : 'SOLO'}</Text>
      </View>
      <Row label="Matéria" value={subject} valueTestID="study-session-subject" />
      {free ? <Row label="Tipo" value="Foco livre" /> : <Row label="Duração planejada" value={plannedLabel} />}
      <Row label="Foco válido" value={formatElapsedTime(validFocusSeconds)} />
      {pauseCount != null ? <Row label="Pausas" value={String(pauseCount)} testID="study-session-pause-count" /> : null}
      {children}
    </WiseCard>
  );
}

/**
 * "Enquanto isso": what finishing this session does for the day's Objetivo and the next level, and for the Raid in a
 * guild session. A line whose data is missing is left out, and so is the card when none is left.
 */
export function ForgeMeanwhileCard({ raidName }: { raidName: string | null }) {
  const { data: profile } = useQuery(profileQueryOptions());
  const objective = useSessionsObjective();
  const goal = goalLine(objective);
  const level = levelLine(profile);
  const lines: { key: string; icon: 'flash' | 'flame' | 'sparkles'; color: string; text: string }[] = [
    ...(raidName ? [{ key: 'raid', icon: 'flash' as const, color: theme.color.accentHighlight, text: `Ao concluir, o XP vira um Golpe na Raid ${raidName}.` }] : []),
    ...(goal ? [{ key: 'goal', icon: 'flame' as const, color: theme.color.feedbackEnergy, text: goal }] : []),
    ...(level ? [{ key: 'level', icon: 'sparkles' as const, color: theme.color.accentHighlight, text: level }] : []),
  ];
  if (lines.length === 0) return null;
  return (
    <WiseCard style={styles.sideCard} testID="study-session-meanwhile">
      <ForgeCardTitle>Enquanto isso</ForgeCardTitle>
      {lines.map((line) => (
        <View key={line.key} style={styles.meanwhileLine} testID={`study-session-meanwhile-${line.key}`}>
          <Ionicons accessibilityElementsHidden importantForAccessibility="no" name={line.icon} size={16} color={line.color} />
          <Text allowFontScaling style={[styles.cardCopy, styles.meanwhileText, { color: theme.color.textPrimary }]}>{line.text}</Text>
        </View>
      ))}
    </WiseCard>
  );
}
