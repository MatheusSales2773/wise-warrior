import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, WiseButton, WiseDialog, WiseText, isDesktopLayout } from '@/design-system';
import { profileQueryOptions } from '@/features/dashboard/queries';
import { resetMyPlan } from './api';
import { billingErrorMessage, subscriptionQueryOptions } from './billing';
import { PlanUnavailable } from './plan-content';
import { planCard } from './plan';
import { InfoRow, settingsStyles } from './settings-content';

/** Desenvolvedor: cancels the test Subscription now so the account can rehearse "assinar → premium" again. */
export function DevContent() {
  const { width } = useWindowDimensions();
  const profile = useQuery(profileQueryOptions());
  const subscription = useQuery(subscriptionQueryOptions());
  const [confirming, setConfirming] = useState(false);
  const reset = useMutation({
    mutationFn: resetMyPlan,
    onSettled: () => setConfirming(false),
  });

  // The route also redirects; this keeps the controls off the screen for the instant before it does.
  if (profile.data?.devTools !== true) return null;
  if (!subscription.data) return <PlanUnavailable subscription={subscription} />;
  const premium = subscription.data.planTier === 'premium';
  const card = planCard(subscription.data);
  return <View style={settingsStyles.stateBlock}>
    <View style={settingsStyles.list}>
      <InfoRow icon="diamond-outline" title="Plano atual" value={premium ? `${card.name} · ${card.situation}` : 'Free'} />
    </View>
    {reset.isSuccess && premium ? <FeedbackMessage message="Assinatura cancelada. O plano volta a Free em instantes." testID="settings-dev-success" variant="info" /> : null}
    {reset.isError ? <FeedbackMessage message={billingErrorMessage(reset.error, [409, 502, 503], 'Não foi possível cancelar a assinatura. Tente de novo.')} testID="settings-dev-failure" variant="error" /> : null}
    {premium ? <WiseButton label="Voltar ao plano Free" loading={reset.isPending} onPress={() => setConfirming(true)} /> : null}
    {confirming
      ? <WiseDialog accessibilityLabel="Confirmar: cancelar a assinatura agora" desktop={isDesktopLayout(Platform.OS, width)} onClose={() => setConfirming(false)} testID="settings-dev-dialog">
        <WiseText variant="title">Cancelar a assinatura agora?</WiseText>
        <WiseText color="textSecondary" variant="body">A assinatura de teste é cancelada no Stripe na hora e os Itens premium ✦ são desequipados.</WiseText>
        <View style={styles.actions}>
          <WiseButton label="Voltar" onPress={() => setConfirming(false)} variant="secondary" />
          <WiseButton label="Cancelar assinatura" loading={reset.isPending} onPress={() => reset.mutate()} variant="danger" />
        </View>
      </WiseDialog>
      : null}
  </View>;
}

const styles = StyleSheet.create({
  actions: { gap: 12 },
});
