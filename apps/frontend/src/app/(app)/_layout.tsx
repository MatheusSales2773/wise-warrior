import { Slot } from 'expo-router';
import { AppShell } from '@/design-system/components/AppShell';
import { StudySessionHeartbeatRuntime } from '@/features/study-session/study-session-heartbeat-runtime';

export default function ApplicationLayout() {
  return (
    <AppShell>
      <StudySessionHeartbeatRuntime />
      <Slot />
    </AppShell>
  );
}
