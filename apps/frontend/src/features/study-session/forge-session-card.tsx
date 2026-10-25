import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { WiseButton, WiseCard, WiseText, theme } from '@/design-system';
import { FeedbackMessage } from '@/design-system/components/FeedbackMessage';
import { formatXp } from '@/features/dashboard/formatters';
import { profileQueryOptions } from '@/features/dashboard/queries';
import { useSessionsObjective } from '@/features/chronicles/queries';
import { StopConfirmation, type StopKind } from './stop-confirmation';
import { ForgeCardTitle } from './forge-primitives';
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
      case 'controls':
        return (
          <View style={compact ? styles.actionsCompact : styles.actionsStacked}>
            <View style={compact ? styles.actionCompactCell : undefined}>
              <WiseButton
                accessibilityLabel={control.main.label}
                label={compact ? shortLabel(control.main.label) : control.main.label}
                leading={<Ionicons name={control.main.icon} size={12} color={theme.color.textPrimary} />}
                loading={control.main.loading}
                disabled={control.main.disabled}
                onPress={control.main.onPress}
                testID={control.main.testID}
                variant="secondary"
              />
            </View>
            <View style={compact ? styles.actionCompactCell : undefined}>
              <WiseButton
                accessibilityLabel={control.stop.label}
                label={compact ? shortLabel(control.stop.label) : control.stop.label}
                leading={<Ionicons name="stop" size={12} color={theme.color.feedbackDanger} />}
                loading={control.stop.loading}
                disabled={control.stop.disabled}
                onPress={control.stop.onPress}
                testID="study-session-stop"
                variant="danger"
              />
            </View>
          </View>
        );
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
  const lines: { key: string; icon: 'flash' | 'flame' | 'sparkles'; color: string; text: string }[] = [];
  if (raidName) lines.push({ key: 'raid', icon: 'flash', color: theme.color.accentHighlight, text: `Ao concluir, o XP vira um Golpe na Raid ${raidName}.` });
  if (objective && objective.progress < objective.target) {
    const left = objective.target - objective.progress - 1;
    lines.push({
      key: 'goal',
      icon: 'flame',
      color: theme.color.feedbackEnergy,
      text: left > 0
        ? `Concluindo esta, ${left === 1 ? 'falta 1 sessão' : `faltam ${left} sessões`} para a meta de ${objective.target}.`
        : `Concluindo esta, você bate a meta de ${objective.target}.`,
    });
  }
  const xpLeft = profile ? profile.nextLevelXp - profile.xpTotal : 0;
  if (profile && xpLeft > 0) {
    lines.push({ key: 'level', icon: 'sparkles', color: theme.color.accentHighlight, text: `Faltam ${formatXp(xpLeft)} XP para o nível ${profile.level + 1}.` });
  }
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
