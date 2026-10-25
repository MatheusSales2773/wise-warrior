import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { WiseButton, WiseCard, WiseText, theme } from '@/design-system';
import type { StudySessionTransitionResult } from './api';
import { BreakOfferCopy, breakStartLabel } from './forge-break';
import { ForgeAnvil, ForgeColumns } from './forge-anvil';
import { ForgeHero, ForgeStrip, ForgeSummary } from './forge-hero';
import { ForgeTodayCard } from './forge-ready';
import { ForgeCardTitle } from './forge-primitives';
import { ForgeRow } from './forge-session-card';
import { styles } from './forge-styles';
import type { BreakKind } from './pomodoro-break';
import { formatElapsedTime, isFreeFocus } from './timer';

const NO_SUBJECT_LABEL = 'Sem matéria';

const RESULT_COPY: Record<StudySessionTransitionResult['state'], { title: string; compactPhase: string }> = {
  completed: { title: 'Sessão concluída', compactPhase: 'Concluída' },
  stopped_early: { title: 'Sessão encerrada antecipadamente', compactPhase: 'Encerrada' },
  cancelled: { title: 'Sessão cancelada', compactPhase: 'Cancelada' },
  discarded: { title: 'Sessão não contabilizada', compactPhase: 'Não contabilizada' },
  running: { title: 'Sessão encerrada', compactPhase: 'Encerrada' },
  paused: { title: 'Sessão encerrada', compactPhase: 'Encerrada' },
};

/** The break offered after a focus completed in full, and where it leaves the user in the cycle of four. */
export type ResultOffer = { kind: BreakKind; completedInCycle: number | null; onStart: (kind: BreakKind) => void };

/** What the Herói did: the minutes of valid focus, or nothing worth a count. */
function heroDoing(result: StudySessionTransitionResult): string {
  const minutes = Math.floor(result.durationValidSeconds / 60);
  if (minutes < 1) return 'encerrou a sessão';
  return `forjou ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}

/** The ring of a closed session: full once concluded, otherwise as far as the valid focus got. */
function ringProgress(result: StudySessionTransitionResult): number {
  if (result.state === 'completed') return 1;
  const planned = result.plannedDurationSeconds ?? 0;
  return planned > 0 ? Math.min(1, result.durationValidSeconds / planned) : 0;
}

/** Nova sessão, and the break when one is offered: the break leads on a wide card, and sits last on the compact row. */
export function ForgeResultActions({ offer, onNew, compact }: { offer: ResultOffer | null; onNew: () => void; compact: boolean }) {
  const startLabel = offer ? breakStartLabel(offer.kind) : null;
  const newSession = (
    <WiseButton
      label="Nova sessão"
      leading={<Ionicons name="play" size={12} color={theme.color.textPrimary} />}
      onPress={onNew}
      size={compact ? 'medium' : 'large'}
      testID="study-session-new"
      variant={offer ? 'secondary' : 'primary'}
    />
  );
  const start = offer && startLabel ? (
    <WiseButton
      accessibilityLabel={startLabel}
      label={compact ? (offer.kind === 'long' ? 'Pausa longa' : 'Pausa curta') : startLabel}
      leading={<Ionicons name="time-outline" size={12} color={theme.color.backgroundCanvas} />}
      onPress={() => offer.onStart(offer.kind)}
      testID="study-session-break-start"
    />
  ) : null;
  if (compact) {
    return (
      <View style={styles.actionsCompact}>
        <View style={styles.actionCompactCell}>{newSession}</View>
        {start ? <View style={styles.actionCompactCell}>{start}</View> : null}
      </View>
    );
  }
  return <View style={styles.actionsStacked}>{start}{newSession}</View>;
}

/** The reasons and limits that came with the result: the Raid, the antifraude cap, a session that did not count. */
function ResultNotes({ result }: { result: StudySessionTransitionResult }) {
  const { raidContribution } = result;
  return <>
    {raidContribution ? (
      <WiseText accessibilityLiveRegion="polite" aria-live="polite" color={raidContribution.status === 'counted' ? 'textPrimary' : 'textSecondary'} variant="body" testID="study-session-result-raid-contribution">
        {raidContribution.status === 'counted'
          ? `+${raidContribution.xpContributed} XP para a Raid da Guilda.`
          : raidContribution.status === 'outside-raid-window'
            ? 'Esta sessão não contou para a Raid: terminou fora da janela da Raid.'
            : 'Esta sessão não contou para a Raid: não houve XP validado.'}
      </WiseText>
    ) : null}
    {result.state === 'discarded' ? (
      <WiseText color="textSecondary" variant="body">
        {result.discardedReason === 'continuous-session-exceeds-limit'
          ? 'A duração ultrapassou o limite de foco permitido.'
          : 'O limite diário de foco foi atingido.'}
      </WiseText>
    ) : null}
    {result.cappedReason ? (
      <WiseText color="textSecondary" testID="study-session-result-capped" variant="body">
        {result.cappedReason === 'daily-limit' ? 'XP limitado pelo teto diário.' : 'XP limitado ao máximo de sessão contínua.'}
      </WiseText>
    ) : null}
  </>;
}

function ResultCard({ result, offer, onNew }: { result: StudySessionTransitionResult; offer: ResultOffer | null; onNew: () => void }) {
  const free = isFreeFocus(result);
  return (
    <WiseCard style={styles.sideCard} testID="study-session-result-card">
      <View style={styles.cardHeader}>
        <ForgeCardTitle>{RESULT_COPY[result.state].title}</ForgeCardTitle>
        <Text allowFontScaling style={styles.modeTag}>{result.mode === 'guild' ? 'GUILDA' : 'SOLO'}</Text>
      </View>
      <ForgeRow label="Matéria" value={result.subject ?? NO_SUBJECT_LABEL} valueTestID="study-session-result-subject" />
      {free ? <ForgeRow label="Tipo" value="Foco livre" /> : <ForgeRow label="Duração planejada" value={`${(result.plannedDurationSeconds ?? 0) / 60} min`} />}
      <ForgeRow label="Foco válido" value={formatElapsedTime(result.durationValidSeconds)} valueTestID="study-session-result-valid-focus" />
      {result.pauseCount != null ? <ForgeRow label="Pausas" value={String(result.pauseCount)} testID="study-session-pause-count" /> : null}
      <ResultNotes result={result} />
      <ForgeResultActions offer={offer} onNew={onNew} compact={false} />
      {offer ? <BreakOfferCopy kind={offer.kind} completedInCycle={offer.completedInCycle} /> : null}
    </WiseCard>
  );
}

/** The Resultado: the Bigorna closed on the valid focus, and beside it (or pinned, on a phone) what to do next. */
export function ForgeResult({ result, wide, compact, ringSize, offer, onNew }: {
  result: StudySessionTransitionResult;
  wide: boolean;
  compact: boolean;
  ringSize: number;
  offer: ResultOffer | null;
  onNew: () => void;
}) {
  const copy = RESULT_COPY[result.state];
  const free = isFreeFocus(result);
  const subject = result.subject ?? NO_SUBJECT_LABEL;
  return (
    <ForgeColumns
      wide={wide}
      testID="study-session-result"
      anvil={
        <ForgeAnvil
          wide={wide}
          testID="study-session-result-stage"
          reading={{ elapsed: result.durationValidSeconds }}
          phase={compact ? copy.compactPhase : copy.title}
          ornate={!compact}
          progress={ringProgress(result)}
          timerCaption={result.xpAwarded > 0 ? 'foco válido confirmado' : 'foco válido registrado'}
          ringSize={ringSize}
          timerTestID="study-session-result-timer"
          timerAccessibilityLabel={`Foco válido: ${Math.floor(result.durationValidSeconds / 60)} minutos e ${result.durationValidSeconds % 60} segundos. ${copy.title}.`}
        >
          <ForgeHero compact={compact} doing={heroDoing(result)} guild={result.mode === 'guild'} paused={result.state !== 'completed'} subject={result.subject} />
          {compact ? <>
            <ForgeStrip
              cells={[
                { value: subject, label: 'matéria', testID: 'study-session-result-subject' },
                { value: free ? 'Livre' : `${(result.plannedDurationSeconds ?? 0) / 60} min`, label: free ? 'tipo' : 'planejado', testID: 'study-session-strip-planned' },
                { value: `+${result.xpAwarded} XP`, label: 'confirmado', testID: 'study-session-strip-xp' },
              ]}
            />
            <View style={[styles.stageNotice, styles.stageStatus]}>
              {/* The phone shows only "Concluída" on the ring: the full title is still announced. */}
              <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.srOnly}>{copy.title}</Text>
              <ResultNotes result={result} />
              {offer ? <BreakOfferCopy kind={offer.kind} completedInCycle={offer.completedInCycle} /> : null}
            </View>
          </> : <ForgeSummary xp={result.xpAwarded} free={free} xpLabel="confirmado" />}
        </ForgeAnvil>
      }
      support={compact ? null : <>
        <ResultCard result={result} offer={offer} onNew={onNew} />
        <ForgeTodayCard />
      </>}
    />
  );
}
