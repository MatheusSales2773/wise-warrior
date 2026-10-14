import { useLocalSearchParams } from 'expo-router';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';

export default function StudySessionRoute() {
  const { modo } = useLocalSearchParams<{ modo?: string }>();
  return <StudySessionScreen initialMode={modo === 'guilda' ? 'guild' : 'solo'} />;
}
