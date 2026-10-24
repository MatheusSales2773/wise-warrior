import { Text, View } from 'react-native';
import { WiseButton, WiseText } from '@/design-system';
import { BREAK_SECONDS, type BreakKind, type BreakRun } from './pomodoro-break';
import { ForgeAnvil } from './forge-anvil';
import { ForgeCardTitle } from './forge-primitives';
import { styles } from './forge-styles';

const BREAK_COPY: Record<BreakKind, { title: string; phase: string; action: string; offer: (minutes: number) => string }> = {
  short: {
    title: 'Pausa curta',
    phase: 'PAUSA CURTA',
    action: 'Iniciar pausa curta',
    offer: (minutes) => `Pausa curta de ${minutes} minutos. Não concede XP.`,
  },
  long: {
    title: 'Pausa longa',
    phase: 'PAUSA LONGA',
    action: 'Iniciar pausa longa',
    offer: (minutes) => `Quatro focos concluídos. Pausa longa de ${minutes} minutos, sem XP.`,
  },
};

/** After a completed focus: the next break and where the user stands in the cycle of four. */
export function BreakOffer({ kind, completedInCycle, onStart }: {
  kind: BreakKind;
  completedInCycle: number | null;
  onStart: (kind: BreakKind) => void;
}) {
  const copy = BREAK_COPY[kind];
  return (
    <View style={styles.breakOffer} testID="study-session-break-offer">
      <ForgeCardTitle>Hora de descansar</ForgeCardTitle>
      {completedInCycle !== null ? <WiseText color="accentHighlight" variant="mono">Forja {completedInCycle} de 4</WiseText> : null}
      <WiseText color="textSecondary" variant="body">{copy.offer(BREAK_SECONDS[kind] / 60)}</WiseText>
      <WiseButton label={copy.action} onPress={() => onStart(kind)} testID="study-session-break-start" />
    </View>
  );
}

export function BreakStage({ run, remaining, ringSize, onSkip, onFinish }: {
  run: BreakRun;
  remaining: number;
  ringSize: number;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const copy = BREAK_COPY[run.kind];
  const finished = remaining === 0;
  return (
    <ForgeAnvil
      wide={false}
      testID="study-session-break"
      header={<>
        <Text accessibilityRole="header" allowFontScaling style={styles.stageTitle}>{copy.title}</Text>
        <Text allowFontScaling style={styles.stageMeta}>{run.durationSeconds / 60} min · sem XP</Text>
      </>}
      reading={{ remaining, duration: run.durationSeconds }}
      phase={copy.phase}
      ringSize={ringSize}
      timerTestID="study-session-break-timer"
      timerAccessibilityLabel={`Tempo restante da pausa: ${Math.floor(remaining / 60)} minutos e ${remaining % 60} segundos.`}
    >
      <View style={styles.stageActions}>
        <WiseText accessibilityLiveRegion="polite" aria-live="polite" color="textSecondary" variant="body">
          {finished ? 'Pausa concluída. Pronto para outra forja?' : 'Descanse. O contador segue mesmo se você sair desta tela.'}
        </WiseText>
        {finished
          ? <WiseButton label="Nova sessão" onPress={onFinish} size="large" testID="study-session-break-new" />
          : <WiseButton label="Pular pausa" onPress={onSkip} variant="secondary" testID="study-session-break-skip" />}
      </View>
    </ForgeAnvil>
  );
}
