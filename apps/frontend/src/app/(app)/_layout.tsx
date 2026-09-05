import { Slot } from 'expo-router';
import { AppShell } from '@/design-system/components/AppShell';

export default function ApplicationLayout() {
  return (
    <AppShell>
      <Slot />
    </AppShell>
  );
}
