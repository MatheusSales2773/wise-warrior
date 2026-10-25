import type { ReactNode } from 'react';
import { View } from 'react-native';
import { WiseCard } from '@/design-system';
import { ForgeStageGradient, ForgeTimer, type TimerReading } from './forge-primitives';
import { styles } from './forge-styles';

/** The Bigorna: the ring timer under a header. `children` is the space below it for the Herói, the summary and the card's own controls. */
export function ForgeAnvil({ wide, header, reading, phase, ringSize, timerTestID, timerAccessibilityLabel, timerCaption, dimmed, ornate, tone, progress, children, testID = 'study-session-stage' }: {
  wide: boolean;
  /** Left out, the card opens on the ring, as the v2 Bigorna of a running session does. */
  header?: ReactNode;
  reading: TimerReading;
  phase: string;
  ringSize: number;
  timerTestID?: string;
  timerAccessibilityLabel?: string;
  timerCaption?: string;
  dimmed?: boolean;
  ornate?: boolean;
  tone?: 'focus' | 'break';
  progress?: number;
  children?: ReactNode;
  testID?: string;
}) {
  return (
    <WiseCard style={[styles.stage, wide && styles.stageWide]} testID={testID}>
      <ForgeStageGradient />
      {header ? <View style={styles.stageHeader}>{header}</View> : null}
      <View style={styles.stageBody}>
        <ForgeTimer reading={reading} phase={phase} size={ringSize} testID={timerTestID} accessibilityLabel={timerAccessibilityLabel} caption={timerCaption} dimmed={dimmed} ornate={ornate} tone={tone} progress={progress} />
      </View>
      {children}
    </WiseCard>
  );
}

/** The Forja's two columns: the Bigorna with its card, and the supporting cards beside it on a wide screen. */
export function ForgeColumns({ wide, testID, anvil, support }: { wide: boolean; testID: string; anvil: ReactNode; support: ReactNode }) {
  return (
    <View style={[styles.forgeColumns, wide && styles.forgeColumnsWide]} testID={testID}>
      {anvil}
      <View style={[styles.sideColumn, wide && styles.sideColumnWide]}>{support}</View>
    </View>
  );
}
