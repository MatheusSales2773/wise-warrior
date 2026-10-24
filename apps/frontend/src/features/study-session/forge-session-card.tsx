import { Text, View, type StyleProp, type ViewStyle, useWindowDimensions } from 'react-native';
import { WiseButton, WiseCard, WiseText, theme } from '@/design-system';
import { FeedbackMessage } from '@/design-system/components/FeedbackMessage';
import { StopConfirmation, type StopKind } from './stop-confirmation';
import { ForgeAction, ForgeCardTitle } from './forge-primitives';
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

export type ForgeSessionCardProps = {
  wide: boolean;
  plannedLabel: string;
  settingsOpen: boolean;
  control: ForgeSessionControl;
  stopConfirmation: { kind: StopKind; onConfirm: () => void; onDecline: () => void } | null;
  transitionError: { versionConflict: boolean; needsCanonicalRefresh: boolean; refreshFailed: boolean } | null;
  completionError: boolean;
  completionConflict: { fetching: boolean } | null;
  sessionStatus: string;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
};

/** The settings of a running session: shown inline on a narrow screen, in the support column on a wide one. */
function SessionSettings({ plannedLabel, onClose, style }: { plannedLabel: string; onClose: () => void; style: StyleProp<ViewStyle> }) {
  return <WiseCard style={style}>
    <ForgeCardTitle>Configurações da sessão</ForgeCardTitle>
    <View style={styles.statRow}><Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textSecondary }]}>Tempo de foco</Text><WiseText color="accentHighlight" variant="mono">{plannedLabel}</WiseText></View>
    <Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textSecondary }]}>A duração não pode ser alterada durante a sessão.</Text>
    <WiseButton label="Fechar configurações" onPress={onClose} variant="secondary" />
  </WiseCard>;
}

function SessionControls({ control }: { control: ForgeSessionControl }) {
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
        <View style={styles.controls}>
          <ForgeAction icon="stop" iconOnly {...control.stop} testID="study-session-stop" />
          <ForgeAction primary {...control.main} />
        </View>
      );
    case 'none':
      return null;
  }
}

/** What sits under the Bigorna while a session runs or is paused: controls, their feedback and the status line. */
export function ForgeSessionCard(props: ForgeSessionCardProps) {
  const { width } = useWindowDimensions();
  const { control, stopConfirmation, transitionError, completionConflict } = props;
  return <>
    <View style={[styles.stageActions, width < 450 && styles.stageActionsCompact]}>
      {props.settingsOpen && !props.wide ? <SessionSettings plannedLabel={props.plannedLabel} onClose={props.onCloseSettings} style={styles.inlineSettingsCard} /> : null}
      <View style={[styles.actionRow, width < 450 && styles.actionRowCompact]}>
        <SessionControls control={control} />
        {stopConfirmation ? <StopConfirmation kind={stopConfirmation.kind} onConfirm={stopConfirmation.onConfirm} onDecline={stopConfirmation.onDecline} /> : null}
        <ForgeAction icon="settings-outline" iconOnly label="Configurações da sessão" expanded={props.settingsOpen} onPress={props.onToggleSettings} />
      </View>
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
      {props.completionError ? (
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
    </View>
    <View style={styles.stageFeedback}>
      <WiseText accessibilityLiveRegion="polite" aria-live="polite" testID="study-session-state" variant="body">{props.sessionStatus}</WiseText>
    </View>
  </>;
}

/** Support column while a session runs: its data, or its settings in place of them on a wide screen. */
export function ForgeActiveSupport({ wide, settingsOpen, plannedLabel, validFocusSeconds, onCloseSettings }: {
  wide: boolean;
  settingsOpen: boolean;
  plannedLabel: string;
  validFocusSeconds: number;
  onCloseSettings: () => void;
}) {
  if (settingsOpen && wide) return <SessionSettings plannedLabel={plannedLabel} onClose={onCloseSettings} style={styles.sideCard} />;
  return <>
    <WiseCard style={styles.sideCard}>
      <ForgeCardTitle>Sua sessão</ForgeCardTitle>
      <View style={styles.statRow}><Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textSecondary }]}>Duração planejada</Text><WiseText color="accentHighlight" variant="mono">{plannedLabel}</WiseText></View>
      <View style={styles.statRow}><Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textSecondary }]}>Foco válido</Text><WiseText color="accentHighlight" variant="mono">{formatElapsedTime(validFocusSeconds)}</WiseText></View>
      <Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textTertiary }]}>O tempo e a conclusão são confirmados pelo servidor.</Text>
    </WiseCard>
    <WiseCard style={styles.sideCard}>
      <ForgeCardTitle>Como funciona</ForgeCardTitle>
      <Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textSecondary }]}>Pause quando precisar. Ao retomar, o contador continua de onde parou.</Text>
      <Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textSecondary }]}>Sessões encerradas antes de 5 minutos não concedem XP.</Text>
    </WiseCard>
  </>;
}
