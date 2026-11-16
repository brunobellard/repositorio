import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import type { IconName } from '@/components/ui';
import { colors } from '@/theme/colors';
import type { ServiceMode } from '@/types';

export const SERVICE_MODES: { value: ServiceMode; label: string; detail: string; icon: IconName }[] = [
  { value: 'fixed', label: 'Espaço fixo', detail: 'As clientes vêm até o seu estúdio', icon: 'storefront-outline' },
  { value: 'home_service', label: 'A domicílio', detail: 'Você vai até a casa da cliente', icon: 'car-outline' },
  { value: 'hybrid', label: 'Híbrido', detail: 'Atende no estúdio e a domicílio', icon: 'swap-horizontal-outline' },
];

/** Seletor do modelo de atendimento (Espaço fixo, A domicílio ou Híbrido). */
export function ServiceModePicker({ value, onChange }: { value: ServiceMode; onChange: (v: ServiceMode) => void }) {
  return (
    <View className="gap-2">
      {SERVICE_MODES.map((m) => {
        const on = m.value === value;
        return (
          <Pressable
            key={m.value}
            onPress={() => onChange(m.value)}
            className={`flex-row items-center rounded-2xl border px-4 py-3 active:opacity-80 ${
              on ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
            }`}>
            <Ionicons name={m.icon} size={20} color={on ? colors.primaryDark : colors.muted} />
            <View className="ml-3 flex-1">
              <Text className="text-[15px] font-medium text-ink">{m.label}</Text>
              <Text className="text-[12px] text-muted">{m.detail}</Text>
            </View>
            <Ionicons
              name={on ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={on ? colors.primary : colors.line}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
