import { Link, Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LEGAL_INFO, type LegalDocument } from '@/constants/legal';

/** Página pública e responsiva para os textos legais (Termos de Uso e Política de Privacidade). */
export function LegalPage({ doc, current }: { doc: LegalDocument; current: 'terms' | 'privacy' }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 48, paddingHorizontal: 20 }}>
      <Stack.Screen options={{ title: `${doc.title} · ${LEGAL_INFO.appName}` }} />
      <View className="w-full max-w-[760px] self-center">
        <View className="mb-6 flex-row items-center">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Text className="text-lg">💅</Text>
          </View>
          <Text className="ml-2.5 flex-1 text-[16px] font-bold text-ink">{LEGAL_INFO.appName}</Text>
          <Link href={current === 'terms' ? '/privacidade' : '/termos'} className="text-[13px] font-medium text-primary-dark">
            {current === 'terms' ? 'Política de Privacidade' : 'Termos de Uso'}
          </Link>
        </View>

        <Text className="text-[28px] font-bold tracking-tight text-ink">{doc.title}</Text>
        <Text className="mt-1 text-[13px] text-muted">Última atualização: {LEGAL_INFO.updatedAt}</Text>
        <Text className="mt-4 text-[15px] leading-6 text-ink">{doc.intro}</Text>

        {doc.sections.map((s) => (
          <View key={s.heading} className="mt-7">
            <Text className="mb-2 text-[18px] font-semibold text-ink">{s.heading}</Text>
            {s.body.map((block, i) =>
              typeof block === 'string' ? (
                <Text key={i} className="mb-2 text-[15px] leading-6 text-ink">
                  {block}
                </Text>
              ) : (
                <View key={i} className="mb-2">
                  {block.map((item) => (
                    <View key={item} className="mb-1.5 flex-row pl-1">
                      <Text className="mr-2 text-[15px] leading-6 text-primary-dark">•</Text>
                      <Text className="flex-1 text-[15px] leading-6 text-ink">{item}</Text>
                    </View>
                  ))}
                </View>
              ),
            )}
          </View>
        ))}

        <Text className="mt-10 border-t border-line pt-4 text-center text-[12px] text-muted">
          © {new Date().getFullYear()} {LEGAL_INFO.company}
        </Text>
      </View>
    </ScrollView>
  );
}
