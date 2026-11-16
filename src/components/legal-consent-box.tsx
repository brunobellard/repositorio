import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { LegalDocumentView } from '@/components/legal-page';
import { PRIVACY, TERMS } from '@/constants/legal';
import { colors } from '@/theme/colors';

/**
 * Termos de Uso + Política de Privacidade numa só caixa com rolagem.
 * A caixa de "Li e aceito" só libera depois de rolar até o fim.
 */
export function LegalConsentBox({ accepted, onChange }: { accepted: boolean; onChange: (v: boolean) => void }) {
  const [readAll, setReadAll] = useState(false);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (readAll) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 32) setReadAll(true);
  }

  return (
    <View className="mb-4">
      <View className="overflow-hidden rounded-2xl border border-line bg-surface">
        <ScrollView
          style={{ height: 260 }}
          contentContainerStyle={{ padding: 16 }}
          nestedScrollEnabled
          onScroll={onScroll}
          scrollEventThrottle={64}>
          <LegalDocumentView doc={TERMS} compact />
          <View className="my-5 h-px bg-line" />
          <LegalDocumentView doc={PRIVACY} compact />
          <Text className="mt-4 text-center text-[12px] font-medium text-primary-dark">Fim dos termos ✓</Text>
        </ScrollView>
      </View>

      <Pressable
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
