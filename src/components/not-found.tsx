import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';

/**
 * Endereço que não existe no app/site. Substitui a página padrão do Expo Router
 * (em inglês e com o link "Sitemap", que listava todas as telas para qualquer visitante).
 */
export function NotFound() {
  return (
    <View className="flex-1 items-center justify-center bg-bg px-8">
      <Stack.Screen options={{ title: 'Página não encontrada', headerShown: false }} />
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
        <Ionicons name="compass-outline" size={30} color={colors.primary} />
      </View>
      <Text accessibilityRole="header" className="text-center text-lg font-bold text-ink">
        Página não encontrada
      </Text>
      <Text className="mt-2 text-center text-[14px] leading-5 text-muted">
        O endereço pode estar errado ou a página não existe mais.
      </Text>
      <Link href="/" replace asChild>
        <Text accessibilityRole="link" className="mt-6 rounded-2xl bg-primary px-6 py-3 text-[15px] font-semibold text-on-primary">
          Ir para o início
        </Text>
      </Link>
    </View>
  );
}
