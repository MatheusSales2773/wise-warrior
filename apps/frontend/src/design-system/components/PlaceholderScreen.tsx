import { Screen } from './screen';
import { WiseText } from './WiseText';

type PlaceholderScreenProps = {
  message: string;
  title: string;
};

export function PlaceholderScreen({ message, title }: PlaceholderScreenProps) {
  return (
    <Screen safeAreaEdges={[]} title={title}>
      <WiseText color="textSecondary" variant="body">
        {message}
      </WiseText>
    </Screen>
  );
}
