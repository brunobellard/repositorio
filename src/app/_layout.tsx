import '@/global.css';

import { DefaultTheme, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastHost } from '@/components/toast';
import { UpgradeHost } from '@/components/upgrade-modal';
import { ThemeProvider as ColorThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/data/auth';
import { BiometricLockProvider } from '@/data/biometric-lock';
import { effectivePlan, planHas } from '@/hooks/usePlanAccess';
import { StoreProvider, useStore } from '@/data/store';
import { isSupabaseConfigured } from '@/lib/supabase';
import { registerForPushAsync, useNotificationNavigation } from '@/services/notifications';
import { colors } from '@/theme/colors';

SplashScreen.preventAutoHideAsync();

/** Rotas abertas a qualquer pessoa, com ou sem login */
const PUBLIC_ROUTES = ['agendar', 'termos', 'privacidade', 'redefinir-senha'];

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

/**
 * Depois do login: registra o aparelho para receber push de agendamentos online
 * (se a profissional não desligou em Ajustes) e trata o toque na notificação.
 */
function PushSetup({ active }: { active: boolean }) {
  const { profile, updateProfile } = useStore();
  const registeredFor = useRef<string | null>(null);
  useNotificationNavigation(active);

  // Push é recurso do plano Intermediário em diante
  const hasPush = planHas(effectivePlan(profile), 'push');

  useEffect(() => {
    if (!active || !profile.id) return;
    // Plano sem push: apaga o token, para o aparelho deixar de receber avisos
    if (!hasPush) {
      if (profile.expoPushToken) updateProfile({ expoPushToken: undefined });
      return;
    }
    if (!profile.pushNotificationsEnabled) return;
    if (registeredFor.current === profile.id) return;
    registeredFor.current = profile.id;
    registerForPushAsync()
      .then((r) => {
        if (r.ok && r.token !== profile.expoPushToken) updateProfile({ expoPushToken: r.token });
      })
      .catch(() => {}); // falha de push nunca deve atrapalhar o uso do app
  }, [active, hasPush, profile.id, profile.pushNotificationsEnabled, profile.expoPushToken, updateProfile]);

  return null;
}

function AppStack() {
  const { session, loading } = useAuth();
  const { loading: loadingData, profile } = useStore();
  // Páginas públicas (agendamento, textos legais, nova senha): abrem sem login e sem esperar os dados
  const isPublic = PUBLIC_ROUTES.includes(useSegments()[0] ?? '');

  useEffect(() => {
    if (!loading || isPublic) SplashScreen.hideAsync();
  }, [loading, isPublic]);

  const loggedIn = !!session;
  // Conta nova: passa pelos 3 passos iniciais antes de ver a agenda
  // (=== false: perfis antigos no cache, sem o campo, não caem no onboarding)
  const needsOnboarding = loggedIn && !loadingData && profile.onboardingCompleted === false;
  // Só espera a sessão; os dados aparecem em cada tela (cache local + skeletons)
  if (!isPublic && loading) return <Loading />;

  return (
    <>
    <PushSetup active={loggedIn && !loadingData && !isPublic} />
    <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: colors.ink }}>
      {/* Sempre acessível, com ou sem login */}
      <Stack.Screen name="agendar/[slug]" options={{ headerShown: false, title: 'Agendar horário' }} />
      <Stack.Screen name="termos" options={{ headerShown: false, title: 'Termos de Uso' }} />
      <Stack.Screen name="privacidade" options={{ headerShown: false, title: 'Política de Privacidade' }} />
      <Stack.Screen name="redefinir-senha" options={{ headerShown: false, title: 'Redefinir senha' }} />
      <Stack.Protected guard={!loggedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={loggedIn && !needsOnboarding}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="agendamento/novo" options={{ presentation: 'modal', title: 'Novo agendamento' }} />
        <Stack.Screen name="agendamento/[id]" options={{ presentation: 'modal', title: 'Agendamento' }} />
        <Stack.Screen name="bloqueio/novo" options={{ presentation: 'modal', title: 'Bloquear horário' }} />
        <Stack.Screen name="clientes/[id]" options={{ title: 'Ficha da cliente' }} />
        <Stack.Screen name="clientes/nova" options={{ presentation: 'modal', title: 'Nova cliente' }} />
        <Stack.Screen name="financeiro/despesa" options={{ presentation: 'modal', title: 'Nova despesa' }} />
        <Stack.Screen name="ajustes/mensagens" options={{ title: 'Modelos de mensagem' }} />
        <Stack.Screen name="ajustes/estudio" options={{ title: 'Dados do estúdio' }} />
        <Stack.Screen name="ajustes/servicos" options={{ title: 'Serviços e preços' }} />
        <Stack.Screen name="ajustes/servico" options={{ presentation: 'modal', title: 'Serviço' }} />
        <Stack.Screen name="ajustes/horarios" options={{ title: 'Horário de funcionamento' }} />
        <Stack.Screen name="ajustes/taxas" options={{ title: 'Taxas de pagamento' }} />
        <Stack.Screen name="pacote/novo" options={{ presentation: 'modal', title: 'Vender pacote' }} />
        <Stack.Screen name="ajustes/retorno" options={{ title: 'Retorno de clientes' }} />
        <Stack.Screen name="agendamento/recibo" options={{ presentation: 'modal', title: 'Comprovante' }} />
        <Stack.Screen name="ajustes/assinatura" options={{ title: 'Planos' }} />
        <Stack.Screen name="ajustes/regioes" options={{ title: 'Regiões e deslocamento' }} />
        <Stack.Screen name="ajustes/aparencia" options={{ title: 'Aparência e cores' }} />
      </Stack.Protected>
    </Stack>
    {loggedIn && !isPublic ? <UpgradeHost /> : null}
    </>
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
                <ColorThemeProvider>
                  <AppStack />
                </ColorThemeProvider>
              </StoreProvider>
            </BiometricLockProvider>
          </AuthProvider>
        ) : (
          <MissingConfig />
        )}
        <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
