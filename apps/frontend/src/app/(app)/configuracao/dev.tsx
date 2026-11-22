import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { profileQueryOptions } from '@/features/dashboard/queries';
import { SettingsSectionScreen } from '@/features/settings/settings-screen';

export default function SettingsDevRoute() {
  const profile = useQuery(profileQueryOptions());
  if (profile.data && !profile.data.devTools) return <Redirect href="/configuracao" />;
  return <SettingsSectionScreen id="dev" />;
}
