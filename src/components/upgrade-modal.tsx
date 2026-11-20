// Paywall contextual: ao tocar num recurso fora do plano, explica qual plano libera
// e leva direto para a assinatura. Uso: openUpgrade('export') de qualquer lugar.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { Button } from '@/components/ui';
import { FEATURES, PLANS, type PlanFeature } from '@/constants/plans';
import { formatBRL } from '@/lib/format';
import { onUpgradeRequest } from '@/lib/upgrade';
import { colors } from '@/theme/colors';

/** Coloque uma vez no layout raiz (dentro do router). */
export function UpgradeHost() {
  const [feature, setFeature] = useState<PlanFeature | null>(null);

  useEffect(() => onUpgradeRequest(setFeature), []);

  const info = feature ? FEATURES[feature] : null;
  const plan = info ? PLANS[info.minPlan] : null;
  const close = () => setFeature(null);

  return (
    <Sheet
      visible={!!info}
      onClose={close}
      title={info?.title ?? ''}
      subtitle={info?.description}>
      {plan ? (
        <View>
          <View className="mb-4 flex-row items-center rounded-2xl bg-primary-soft px-4 py-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-surface">
              <Ionicons name="sparkles" size={18} color={colors.primaryDark} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[14px] font-semibold text-primary-dark">Disponível no plano {plan.name}</Text>
              <Text className="text-[12px] text-primary-dark">
                a partir de {formatBRL(plan.price.monthly)}/mês · ou {formatBRL(plan.price.yearly)}/ano
              </Text>
            </View>
          </View>
          <Button
            title={`Assinar o ${plan.name}`}
            icon="arrow-forward"
            onPress={() => {
              close();
              router.push({ pathname: '/ajustes/assinatura', params: { plan: plan.tier } });
            }}
          />
          <Pressable accessibilityRole="button" onPress={close} className="mt-1 items-center py-3">
            <Text className="text-[15px] font-medium text-muted">Agora não</Text>
          </Pressable>
        </View>
      ) : null}
    </Sheet>
  );
}
