import { Stack } from 'expo-router';

export default function PublicLayout() {
  return <Stack initialRouteName="cadastro" screenOptions={{ headerShown: false }} />;
}
