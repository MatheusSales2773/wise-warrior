import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { WiseButton, WiseCard, theme } from '@/design-system';
import { BREAK_SECONDS, type BreakKind, type BreakPrevious, type BreakRun } from './pomodoro-break';
import { ForgeAnvil, ForgeColumns } from './forge-anvil';
import { ForgeHero, ForgeStrip, ForgeSummary } from './forge-hero';
import { ForgeCardTitle } from './forge-primitives';
import { ForgeMeanwhileCard, ForgeRow } from './forge-session-card';
import { styles } from './forge-styles';
import { formatElapsedTime } from './timer';

const BREAK_COPY: Record<BreakKind, { phase: string; compactPhase: string; action: string; offer: (minutes: number) => string }> = {
  short: {
    phase: 'PAUSA CURTA',
    compactPhase: 'Pausa curta',
    action: 'Iniciar pausa curta',
    offer: (minutes) => `Pausa curta de ${minutes} minutos. Não concede XP.`,
  },
  long: {
    phase: 'PAUSA LONGA',
    compactPhase: 'Pausa longa',
    action: 'Iniciar pausa longa',
    offer: (minutes) => `Quatro focos concluídos. Pausa longa de ${minutes} minutos, sem XP.`,
  },
};

/** The label of the button that starts the break offered after a result. */
export const breakStartLabel = (kind: BreakKind) => BREAK_COPY[kind].action;

/** The offer line under a result: where the user stands in the cycle of four, and the break that comes next. */
export function BreakOfferCopy({ kind, completedInCycle }: { kind: BreakKind; completedInCycle: number | null }) {
  return (
    <Text allowFontScaling style={[styles.cardCopy, { color: theme.color.textTertiary }]} testID="study-session-break-offer">
      {'Hora de descansar'}
      {completedInCycle !== null ? <>{' · '}<Text>{`Forja ${completedInCycle} de 4`}</Text></> : null}
      {'. '}
      <Text>{BREAK_COPY[kind].offer(BREAK_SECONDS[kind] / 60)}</Text>
    </Text>
  );
}

/** The skip while the break runs, or Nova sessão once it is over. */
export function ForgeBreakActions({ finished, onSkip, onFinish }: { finished: boolean; onSkip: () => void; onFinish: () => void }) {
  return finished
    ? <WiseButton label="Nova sessão" onPress={onFinish} size="large" testID="study-session-break-new" />
    : (
      <WiseButton
        label="Pular pausa"
        leading={<Ionicons name="chevron-forward" size={12} color={theme.color.textPrimary} />}
        onPress={onSkip}
        variant="secondary"
        testID="study-session-break-skip"
      />
    );
}

const PAUSE_COPY = 'Descanse. O contador segue mesmo se você sair desta tela.';
const FINISHED_COPY = 'Pausa concluída. Pronto para outra forja?';

function BreakCopy({ finished }: { finished: boolean }) {
  return (
    <Text accessibilityLiveRegion="polite" allowFontScaling aria-live="polite" style={[styles.cardCopy, { color: theme.color.textTertiary }]}>
      {finished ? FINISHED_COPY : PAUSE_COPY}
    </Text>
  );
}

/** How many focuses are still missing for the long break; none once this break is the long one. */
function longBreakIn(run: BreakRun, previous: BreakPrevious): string | null {
  if (run.kind === 'long' || previous.completedInCycle === null) return null;
  const left = 4 - previous.completedInCycle;
  return left > 0 ? `após ${left} ${left === 1 ? 'foco' : 'focos'}` : null;
}

/** "Hora de descansar": the focus that earned the break, and the way out of it. */
export function ForgeBreakCard({ run, finished, onSkip, onFinish }: {
  run: BreakRun;
  finished: boolean;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const { previous } = run;
  const longIn = previous ? longBreakIn(run, previous) : null;
  return (
    <WiseCard style={styles.sideCard} testID="study-session-break-card">
      <View style={styles.cardHeader}>
        <ForgeCardTitle>Hora de descansar</ForgeCardTitle>
        {previous?.completedInCycle != null ? <Text allowFontScaling style={styles.modeTag}>{`FORJA ${previous.completedInCycle} DE 4`}</Text> : null}
      </View>
      {previous ? <>
        <ForgeRow label="Última sessão" value={previous.subject ?? 'Sem matéria'} />
        <ForgeRow label="Foco válido" value={formatElapsedTime(previous.validSeconds)} />
        <ForgeRow label="XP confirmado" value={`+${previous.xpAwarded}`} />
        {longIn ? <ForgeRow label="Pausa longa" value={longIn} /> : null}
      </> : null}
      <ForgeBreakActions finished={finished} onSkip={onSkip} onFinish={onFinish} />
      <BreakCopy finished={finished} />
    </WiseCard>
  );
}

/** The Pausa Pomodoro: the Bigorna counting the break down, and beside it (or pinned, on a phone) the way out. */
export function ForgeBreak({ run, remaining, wide, compact, ringSize, onSkip, onFinish }: {
  run: BreakRun;
  remaining: number;
  wide: boolean;
  compact: boolean;
  ringSize: number;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const copy = BREAK_COPY[run.kind];
  const finished = remaining === 0;
  const minutes = run.durationSeconds / 60;
  const { previous } = run;
  return (
    <ForgeColumns
      wide={wide}
      testID="study-session-break"
      anvil={
        <ForgeAnvil
          wide={wide}
          testID="study-session-break-stage"
          reading={{ remaining, duration: run.durationSeconds }}
          phase={compact ? copy.compactPhase : copy.phase}
          ornate={!compact}
          tone="break"
          // The arc is what is left of the break and empties as it runs, where a focus fills.
          progress={remaining / run.durationSeconds}
          timerCaption={compact ? `${minutes} min · sem XP` : `restantes · ${minutes} min · sem XP`}
          ringSize={ringSize}
          timerTestID="study-session-break-timer"
          timerAccessibilityLabel={`Tempo restante da pausa: ${Math.floor(remaining / 60)} minutos e ${remaining % 60} segundos.`}
        >
          <ForgeHero compact={compact} doing="descansa ao lado da bigorna" guild={false} paused subject={null} />
          {previous && !compact ? <ForgeSummary xp={previous.xpAwarded} free={false} xpLabel="na última sessão" /> : null}
          {previous && compact ? (
            <ForgeStrip
              cells={[
                { value: previous.subject ?? 'Sem matéria', label: 'última sessão', testID: 'study-session-strip-subject' },
                ...(previous.completedInCycle !== null ? [{ value: `${previous.completedInCycle} de 4`, label: 'forja', testID: 'study-session-strip-cycle' }] : []),
                { value: `+${previous.xpAwarded} XP`, label: 'confirmado', testID: 'study-session-strip-xp' },
              ]}
            />
          ) : null}
          {compact ? <View style={styles.stageNotice}><BreakCopy finished={finished} /></View> : null}
        </ForgeAnvil>
      }
      support={<>
        {compact ? null : <ForgeBreakCard run={run} finished={finished} onSkip={onSkip} onFinish={onFinish} />}
        <ForgeMeanwhileCard raidName={null} afterSession />
      </>}
    />
  );
}
