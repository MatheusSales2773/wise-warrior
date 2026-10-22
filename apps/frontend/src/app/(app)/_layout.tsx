import { Slot } from 'expo-router';
import { RealtimeRuntime } from '@/core/realtime/realtime-runtime';
import { AppShell } from '@/design-system/components/AppShell';
import { StudySessionHeartbeatRuntime } from '@/features/study-session/study-session-heartbeat-runtime';
import { StudySessionSoundRuntime } from '@/features/study-session/study-session-sound-runtime';

export default function ApplicationLayout() {
  return (
    <AppShell>
      <RealtimeRuntime />
      <StudySessionHeartbeatRuntime />
      <StudySessionSoundRuntime />
      <Slot />
    </AppShell>
  );
}
