import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { LEGAL_INFO, type LegalDocument } from '@/constants/legal';
import { useAuth } from '@/data/auth';
import { useStore } from '@/data/store';
import { colors } from '@/theme/colors';

/** Abre os Termos ou a Política dentro do app (rota pública, com ou sem login). */
export function openLegal(kind: 'terms' | 'privacy') {
  // from=app: a página mostra "voltar" e "Entendi" (no site, um visitante direto não tem para onde voltar)
  router.push({ pathname: kind === 'terms' ? '/termos' : '/privacidade', params: { from: 'app' } });
}

/** Corpo de um texto legal (seções, parágrafos e listas). `compact` = letra menor, para a caixa de aceite. */
export function LegalDocumentView({ doc, compact = false }: { doc: LegalDocument; compact?: boolean }) {
  const text = compact ? 'text-[13px] leading-5' : 'text-[15px] leading-6';
  return (
    <View>
      <Text className={`${compact ? 'text-[16px]' : 'text-[28px] tracking-tight'} font-bold text-ink`}>{doc.title}</Text>
      <Text className={`mt-1 ${compact ? 'text-[11px]' : 'text-[13px]'} text-muted`}>
        Última atualização: {LEGAL_INFO.updatedAt}
      </Text>
      <Text className={`mt-3 ${text} text-ink`}>{doc.intro}</Text>
      {doc.sections.map((s) => (
        <View key={s.heading} className={compact ? 'mt-4' : 'mt-7'}>
          <Text className={`mb-1.5 ${compact ? 'text-[14px]' : 'text-[18px]'} font-semibold text-ink`}>{s.heading}</Text>
          {s.body.map((block, i) =>
            typeof block === 'string' ? (
              <Text key={i} className={`mb-2 ${text} text-ink`}>
                {block}
              </Text>
            ) : (
              <View key={i} className="mb-2">
                {block.map((item) => (
                  <View key={item} className="mb-1 flex-row pl-1">
                    <Text className={`mr-2 ${text} text-primary-dark`}>•</Text>
                    <Text className={`flex-1 ${text} text-ink`}>{item}</Text>
                  </View>
                ))}
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

/** Página pública e responsiva para os textos legais (Termos de Uso e Política de Privacidade). */
export function LegalPage({ doc, current }: { doc: LegalDocument; current: 'terms' | 'privacy' }) {
  const insets = useSafeAreaInsets();
  const { from } = useLocalSearchParams<{ from?: string }>();
  // Aberta de dentro do app: sempre há como voltar. Visitante direto no site: não há para onde voltar.
  const canLeave = Platform.OS !== 'web' || from === 'app';
  const { session } = useAuth();
  const { profile } = useStore();
  // Sem tela anterior (ex: aberta por um link): vai para a tela certa de quem está usando
  const home = !session ? '/login' : profile.onboardingCompleted === false ? '/onboarding' : '/';
  const leave = () => (router.canGoBack() ? router.back() : router.replace(home));

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: `${doc.title} · ${LEGAL_INFO.appName}` }} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: canLeave ? 24 : insets.bottom + 48,
          paddingHorizontal: 20,
        }}>
        <View className="w-full max-w-[760px] self-center">
          <View className="mb-6 flex-row items-center">
            {canLeave ? (
              <Pressable onPress={leave} hitSlop={10} className="-ml-1 mr-2 p-1 active:opacity-60">
                <Ionicons name="chevron-back" size={24} color={colors.ink} />
              </Pressable>
            ) : null}
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Text className="text-lg">💅</Text>
            </View>
            <Text className="ml-2.5 flex-1 text-[16px] font-bold text-ink">{LEGAL_INFO.appName}</Text>
            <Link
              href={{ pathname: current === 'terms' ? '/privacidade' : '/termos', params: from ? { from } : {} }}
              replace
              className="text-[13px] font-medium text-primary-dark">
              {current === 'terms' ? 'Política de Privacidade' : 'Termos de Uso'}
            </Link>
          </View>

          <LegalDocumentView doc={doc} />

          <Text className="mt-10 border-t border-line pt-4 text-center text-[12px] text-muted">
            © {new Date().getFullYear()} {LEGAL_INFO.company}
          </Text>
        </View>
      </ScrollView>

      {canLeave ? (
        <View
          className="border-t border-line bg-surface px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <View className="w-full max-w-[760px] self-center">
            <Button title="Entendi" onPress={leave} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
