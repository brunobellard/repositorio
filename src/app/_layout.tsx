import '@/global.css';

import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/data/auth';
import { BiometricLockProvider } from '@/data/biometric-lock';
import { StoreProvider, useStore } from '@/data/store';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors } from '@/theme/colors';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    primary: colors.primary,
    text: colors.ink,
    border: colors.line,
  },
};

function Loading({ text }: { text?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <ActivityIndicator color={colors.primary} />
      {text ? <Text className="mt-3 text-[13px] text-muted">{text}</Text> : null}
    </View>
  );
}

function MissingConfig() {
  return (
    <View className="flex-1 items-center justify-center bg-bg px-8">
      <Text className="mb-2 text-lg font-semibold text-ink">Supabase não configurado</Text>
      <Text className="text-center text-[14px] leading-5 text-muted">
        Crie o arquivo .env.local na raiz do projeto (veja .env.example) com a URL e a publishable key do seu
        projeto Supabase e reinicie o Expo.
      </Text>
    </View>
  );
}

function AppStack() {
  const { session, loading } = useAuth();
  const { loading: loadingData } = useStore();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return <Loading />;
  const loggedIn = !!session;
  if (loggedIn && loadingData) return <Loading text="Carregando sua agenda…" />;

  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: colors.ink }}>
      <Stack.Protected guard={!loggedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={loggedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="agendamento/novo" options={{ presentation: 'modal', title: 'Novo agendamento' }} />
        <Stack.Screen name="agendamento/[id]" options={{ presentation: 'modal', title: 'Agendamento' }} />
        <Stack.Screen name="bloqueio/novo" options={{ presentation: 'modal', title: 'Bloquear horário' }} />
        <Stack.Screen name="clientes/[id]" options={{ title: 'Ficha da cliente' }} />
        <Stack.Screen name="financeiro/despesa" options={{ presentation: 'modal', title: 'Nova despesa' }} />
        <Stack.Screen name="ajustes/mensagens" options={{ title: 'Modelos de mensagem' }} />
        <Stack.Screen name="ajustes/estudio" options={{ title: 'Dados do estúdio' }} />
        <Stack.Screen name="ajustes/servicos" options={{ title: 'Serviços e preços' }} />
        <Stack.Screen name="ajustes/servico" options={{ presentation: 'modal', title: 'Serviço' }} />
        <Stack.Screen name="ajustes/horarios" options={{ title: 'Horário de funcionamento' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (!isSupabaseConfigured) SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        <StatusBar style="dark" />
        {isSupabaseConfigured ? (
          <AuthProvider>
            <BiometricLockProvider>
              <StoreProvider>
                <AppStack />
              </StoreProvider>
            </BiometricLockProvider>
          </AuthProvider>
        ) : (
          <MissingConfig />
        )}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
