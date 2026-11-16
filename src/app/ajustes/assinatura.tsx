import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { openLegal } from '@/components/legal-page';
import { Button, Card, Segmented } from '@/components/ui';
import { PLANS, planRank, yearlySavings, type BillingCycle, type PlanTier } from '@/constants/plans';
import { useAuth } from '@/data/auth';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { notify } from '@/lib/confirm';
import { formatBRL } from '@/lib/format';
import { billingProvider } from '@/services/billing';
import { colors } from '@/theme/colors';

const PAID: Exclude<PlanTier, 'free'>[] = ['basic', 'pro', 'enterprise'];

export default function Assinatura() {
  const params = useLocalSearchParams<{ plan?: PlanTier }>();
  const { session } = useAuth();
  const access = usePlanAccess();
  const [cycle, setCycle] = useState<BillingCycle>(access.billingCycle ?? 'monthly');
  const [busy, setBusy] = useState<PlanTier | null>(null);

  async function subscribe(tier: Exclude<PlanTier, 'free'>) {
    if (busy || !session) return;
    setBusy(tier);
    try {
      const r = await billingProvider.startCheckout(tier, cycle, session.user.id);
      if (r.status === 'unavailable') notify('Assinatura em breve', r.message, 'info');
    } catch (e) {
      notify('Não foi possível abrir o pagamento', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const statusLine = access.isTrialActive
    ? `Teste grátis do ${PLANS[access.subscribedPlan].name} · ${access.daysLeftInTrial} ${access.daysLeftInTrial === 1 ? 'dia restante' : 'dias restantes'}`
    : access.trialExpired
      ? 'Seu teste grátis terminou · você está no plano Free'
      : access.subscriptionStatus === 'past_due'
        ? 'Pagamento pendente · recursos do plano pausados'
        : `Plano ${access.plan.name}${access.subscriptionStatus === 'active' && access.currentPlan !== 'free' ? ` · ${access.billingCycle === 'yearly' ? 'anual' : 'mensal'}` : ''}`;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <View className="mb-4 flex-row items-center rounded-2xl bg-primary-soft px-4 py-3">
        <Ionicons name="sparkles-outline" size={18} color={colors.primaryDark} />
        <Text className="ml-2 flex-1 text-[13px] font-medium text-primary-dark">{statusLine}</Text>
      </View>

      <Segmented
        value={cycle}
        onChange={setCycle}
        options={[
          { value: 'monthly', label: 'Mensal' },
          { value: 'yearly', label: 'Anual · 2 meses grátis' },
        ]}
      />

      <View className="mt-4 gap-3">
        {PAID.map((tier) => {
          const p = PLANS[tier];
          const featured = !!p.highlight;
          const suggested = params.plan === tier;
          const isCurrent = access.subscriptionStatus === 'active' && access.subscribedPlan === tier;
          const price = cycle === 'monthly' ? p.price.monthly : p.price.yearly;
          return (
            <View
              key={tier}
              className={`rounded-card border bg-surface p-4 ${featured || suggested ? 'border-primary' : 'border-line'}`}
              style={featured ? { borderWidth: 2 } : undefined}>
              <View className="flex-row items-center justify-between">
                <Text className="text-[17px] font-bold text-ink">{p.name}</Text>
                {p.highlight ? (
                  <View className="rounded-full bg-primary px-2.5 py-1">
                    <Text className="text-[11px] font-semibold text-on-primary">{p.highlight}</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-[13px] text-muted">{p.tagline}</Text>

              <View className="mt-3 flex-row items-end">
                <Text className="text-[26px] font-bold text-ink">{formatBRL(price)}</Text>
                <Text className="mb-1 ml-1 text-[13px] text-muted">/{cycle === 'monthly' ? 'mês' : 'ano'}</Text>
              </View>
              {cycle === 'yearly' ? (
                <Text className="text-[12px] text-status-confirmado">
                  Equivale a {formatBRL(p.price.yearly / 12)}/mês · economia de {formatBRL(yearlySavings(p))}
                </Text>
              ) : null}

              <View className="mb-4 mt-3 gap-1.5">
                {p.benefits.map((b) => (
                  <View key={b} className="flex-row items-start">
                    <Ionicons name="checkmark" size={16} color={colors.primary} style={{ marginTop: 1 }} />
                    <Text className="ml-2 flex-1 text-[14px] text-ink">{b}</Text>
                  </View>
                ))}
              </View>

              {isCurrent ? (
                <Button title="Seu plano atual" variant="secondary" disabled />
              ) : (
                <Button
                  title={
                    busy === tier
                      ? 'Abrindo pagamento…'
                      : planRank(tier) < planRank(access.currentPlan) && access.subscriptionStatus === 'active'
                        ? `Mudar para o ${p.name}`
                        : `Assinar o ${p.name}`
                  }
                  variant={featured ? 'primary' : 'secondary'}
                  loading={busy === tier}
                  disabled={busy !== null}
                  onPress={() => subscribe(tier)}
                />
              )}
            </View>
          );
        })}
      </View>

      <Card className="mt-3">
        <Text className="text-[15px] font-semibold text-ink">Free</Text>
        <Text className="mt-1 text-[13px] leading-5 text-muted">{PLANS.free.benefits.join(' · ')}.</Text>
      </Card>

      <Text className="mt-4 text-center text-[11px] leading-4 text-muted">
        Cancele quando quiser. Ao fim do teste grátis, sem assinatura, a conta passa para o plano Free e seus dados
        continuam guardados.
      </Text>
      <Text className="mt-3 text-center text-[12px] text-muted">
        <Text className="font-medium text-primary-dark" onPress={() => openLegal('terms')}>
          Termos de Uso
        </Text>
        {'   ·   '}
        <Text className="font-medium text-primary-dark" onPress={() => openLegal('privacy')}>
          Política de Privacidade
        </Text>
      </Text>
    </ScrollView>
  );
}
