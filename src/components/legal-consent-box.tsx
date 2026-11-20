import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { LegalDocumentView } from '@/components/legal-page';
import { PRIVACY, TERMS } from '@/constants/legal';
import { colors } from '@/theme/colors';

/**
 * Termos de Uso + Política de Privacidade numa só caixa com rolagem.
 * A caixa de "Li e aceito" só libera depois de rolar até o fim.
 */
export function LegalConsentBox({ accepted, onChange }: { accepted: boolean; onChange: (v: boolean) => void }) {
  const [readAll, setReadAll] = useState(false);
  // Posição da marca "Fim dos termos" e altura da caixa (medidas na tela, não dependem do evento de rolagem)
  const endY = useRef(0);
  const boxHeight = useRef(0);

  /** Chegou ao fim quando a marca "Fim dos termos" entra na parte visível da caixa. */
  function check(offsetY: number) {
    if (readAll || !endY.current || !boxHeight.current) return;
    if (offsetY + boxHeight.current >= endY.current - 8) setReadAll(true);
  }

  // Confere em todo tipo de rolagem: no Android o último evento às vezes chega só no fim do arrasto/inércia
  const onScrollEvent = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (e.nativeEvent.layoutMeasurement?.height) boxHeight.current = e.nativeEvent.layoutMeasurement.height;
    check(e.nativeEvent.contentOffset?.y ?? 0);
  };

  return (
    <View className="mb-4">
      <View className="overflow-hidden rounded-2xl border border-line bg-surface">
        <ScrollView
          style={{ height: 260 }}
          contentContainerStyle={{ padding: 16 }}
          nestedScrollEnabled
          onLayout={(e: LayoutChangeEvent) => (boxHeight.current = e.nativeEvent.layout.height)}
          onScroll={onScrollEvent}
          onScrollEndDrag={onScrollEvent}
          onMomentumScrollEnd={onScrollEvent}
          scrollEventThrottle={16}>
          <LegalDocumentView doc={TERMS} compact />
          <View className="my-5 h-px bg-line" />
          <LegalDocumentView doc={PRIVACY} compact />
          <Text
            onLayout={(e: LayoutChangeEvent) => (endY.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
            className="mt-4 text-center text-[12px] font-medium text-primary-dark">
            Fim dos termos ✓
          </Text>
        </ScrollView>
      </View>

      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted, disabled: !readAll }}
        onPress={() => readAll && onChange(!accepted)}
        disabled={!readAll}
        className={`mt-3 flex-row items-center ${readAll ? 'active:opacity-70' : 'opacity-50'}`}>
        <View
          className={`h-6 w-6 items-center justify-center rounded-md border-2 ${
            accepted ? 'border-primary bg-primary' : 'border-line bg-surface'
          }`}>
          {accepted ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
        </View>
        <Text className="ml-3 flex-1 text-[13px] leading-5 text-ink">
          Li e aceito os <Text className="font-semibold">Termos de Uso</Text> e a{' '}
          <Text className="font-semibold">Política de Privacidade</Text>
        </Text>
      </Pressable>
      {!readAll ? (
        <Text className="ml-9 mt-1 text-[12px] text-muted">Role o texto até o fim para poder aceitar.</Text>
      ) : null}
    </View>
  );
}
