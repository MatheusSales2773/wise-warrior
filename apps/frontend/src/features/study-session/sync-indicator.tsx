import { StyleSheet, View } from 'react-native';
import { WiseButton, WiseText, theme } from '@/design-system';
import { FORGE_SYNC_COPY, type ForgeSyncStatus } from './sync-status';

const DOT_COLOR: Record<ForgeSyncStatus, string> = {
  online: theme.color.feedbackSuccess,
  offline: theme.color.textTertiary,
  syncing: theme.color.accentPrimary,
  failed: theme.color.feedbackDanger,
};

/**
 * Connection state of the Study Session (#17). The label always names the state, so the dot is never the only
 * cue; offline and failed states also explain what happens next, and a failure offers to try again.
 */
export function ForgeSyncIndicator({ status, onRetry }: { status: ForgeSyncStatus; onRetry: () => void }) {
  const copy = FORGE_SYNC_COPY[status];
  const explain = status === 'offline' || status === 'failed';
  return (
    <View
      accessibilityLabel={`${copy.label}. ${copy.message}`}
      accessibilityLiveRegion="polite"
      aria-live="polite"
      style={[styles.container, explain && styles.containerExpanded]}
      testID={`study-session-sync-${status}`}
    >
      <View style={styles.row}>
        <View accessibilityElementsHidden aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.dot, { backgroundColor: DOT_COLOR[status] }]} />
        <WiseText color={status === 'failed' ? 'feedbackDanger' : 'textSecondary'} testID="study-session-sync-label" variant="label">{copy.label}</WiseText>
      </View>
      {explain ? <WiseText color="textSecondary" variant="body">{copy.message}</WiseText> : null}
      {status === 'failed' ? <WiseButton label="Sincronizar agora" onPress={onRetry} testID="study-session-sync-retry" variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'flex-end', gap: theme.space.inlineTight, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: theme.color.borderSubtle, borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceInset },
  containerExpanded: { alignSelf: 'stretch', borderRadius: theme.radius.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.inlineTight },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
