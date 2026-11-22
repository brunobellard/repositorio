import '@/global.css';

import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultTheme, router, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, type ColorValue, Platform, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastHost } from '@/components/toast';
import { Button } from '@/components/ui';
import { UpgradeHost } from '@/components/upgrade-modal';
import { ThemeProvider as ColorThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/data/auth';
import { BiometricLockProvider } from '@/data/biometric-lock';
import { effectivePlan, planHas } from '@/hooks/usePlanAccess';
import { StoreProvider, useStore } from '@/data/store';
import { isSupabaseConfigured } from '@/lib/supabase';
import { registerForPushAsync, useNotificationNavigation } from '@/services/notifications';
import { TelemetryService } from '@/services/telemetry';
import { colors } from '@/theme/colors';

SplashScreen.preventAutoHideAsync();
// Sentry (erros e desempenho) o quanto antes; sem EXPO_PUBLIC_SENTRY_DSN não faz nada
TelemetryService.init();

/** Rotas abertas a qualquer pessoa, com ou sem login */
const PUBLIC_ROUTES = ['agendar', 'termos', 'privacidade', 'redefinir-senha', '+not-found', '_sitemap'];

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

/** Voltar do cabeçalho na web: o padrão é lido como "(tabs), back" (BUG-009) */
function WebBackButton({ tintColor, canGoBack }: { tintColor?: ColorValue; canGoBack?: boolean }) {
  if (!canGoBack) return null;
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={8}
      className="px-3 py-2">
      <Ionicons name="chevron-back" size={24} color={typeof tintColor === 'string' ? tintColor : colors.ink} />
    </Pressable>
  );
}

const STACK_OPTIONS = {
  headerShadowVisible: false,
  headerTintColor: colors.ink,
  // No celular, o texto/leitura do botão de voltar vira "Voltar" em vez do nome da rota anterior
  headerBackTitle: 'Voltar',
  ...(Platform.OS === 'web' ? { headerLeft: WebBackButton } : null),
};

function Loading({ text }: { text?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <ActivityIndicator color={colors.primary} />
      {text ? <Text className="mt-3 text-[13px] text-muted">{text}</Text> : null}
    </View>
  );
}

/** A primeira carga dos dados falhou (sem cópia no aparelho): não abre a agenda vazia. */
function LoadFailed() {
  const { retryLoad } = useStore();
  const { signOut } = useAuth();
  return (
    <View className="flex-1 items-center justify-center bg-bg px-8">
      <Text className="mb-2 text-lg font-semibold text-ink">Não foi possível carregar seus dados</Text>
      <Text className="mb-6 text-center text-[14px] leading-5 text-muted">
        Confira a conexão com a internet e tente de novo.
      </Text>
      <View className="w-full gap-3">
        <Button title="Tentar de novo" icon="refresh" onPress={retryLoad} />
        <Button title="Sair da conta" variant="secondary" onPress={signOut} />
      </View>
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
  const { profile, updateProfile, refresh } = useStore();
  const registeredFor = useRef<string | null>(null);
  // Agendamento online novo: recarrega os dados para ele aparecer na agenda
  useNotificationNavigation(active, refresh);

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
    // Já registrado nesta abertura e o token continua salvo: nada a fazer. Se o token sumiu
    // (saiu da conta em outro aparelho, plano voltou a ter push), registra de novo; antes
    // só voltava a receber avisos depois de fechar e abrir o app.
    if (registeredFor.current === profile.id && profile.expoPushToken) return;
    registeredFor.current = profile.id;
    registerForPushAsync()
      .then((r) => {
        if (r.ok && r.token !== profile.expoPushToken) updateProfile({ expoPushToken: r.token });
        // Falha passageira (ex: sem internet): tenta de novo na próxima vez que o perfil mudar
        if (!r.ok && r.reason === 'error') registeredFor.current = null;
      })
      .catch(() => {
        registeredFor.current = null; // falha de push nunca deve atrapalhar o uso do app
      });
  }, [active, hasPush, profile.id, profile.pushNotificationsEnabled, profile.expoPushToken, updateProfile]);

  return null;
}

function AppStack() {
  const { session, loading } = useAuth();
  const { loading: loadingData, loadFailed, profile } = useStore();
  // Páginas públicas (agendamento, textos legais, nova senha): abrem sem login e sem esperar os dados
  const isPublic = PUBLIC_ROUTES.includes(useSegments()[0] ?? '');

  useEffect(() => {
    if (!loading || isPublic) SplashScreen.hideAsync();
  }, [loading, isPublic]);

  const loggedIn = !!session;
  // Telemetria: associa a sessão ao id interno da conta e ao plano (nunca e-mail); ao sair, desassocia
  const userId = session?.user.id ?? null;
  const plan = profile.id ? effectivePlan(profile) : undefined;
  // Contas de QA (link "qa-…") entram na coorte de teste do PostHog e saem dos painéis de uso real
  const isTestAccount = !!profile.id && (profile.slug ?? '').toLowerCase().startsWith('qa-');
  useEffect(() => {
    TelemetryService.identifyUser(userId, plan ? { plan, ...(isTestAccount ? { isTestAccount } : {}) } : undefined);
  }, [userId, plan, isTestAccount]);
  // Conta nova: passa pelos 3 passos iniciais antes de ver a agenda
  // (=== false: perfis antigos no cache, sem o campo, não caem no onboarding)
  const needsOnboarding = loggedIn && !loadingData && profile.onboardingCompleted === false;
  // Tela certa para quem cai numa rota bloqueada
  const home = !loggedIn ? '/login' : needsOnboarding ? '/onboarding' : '/';
  // Espera a sessão. Logado sem dados no aparelho (ex: conta recém-criada), espera também os dados:
  // senão a agenda pisca antes de o app saber que falta o primeiro acesso.
  // Com dados no aparelho, loadingData já é false: abre na hora (cache local + skeletons).
  if (!isPublic && loggedIn && loadFailed) return <LoadFailed />;
  if (!isPublic && (loading || (loggedIn && loadingData))) return <Loading />;

  return (
    <>
    <PushSetup active={loggedIn && !loadingData && !isPublic} />
    <Stack screenOptions={STACK_OPTIONS}>
      {/* redirectTo explícito: sem ele, o roteador escolhe a primeira rota liberada pela ordem dos arquivos,
          e na web uma conta nova caía em /termos em vez do primeiro acesso (BUG-011) */}
      <Stack.Protected guard={!loggedIn} redirectTo={home}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={needsOnboarding} redirectTo={home}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={loggedIn && !needsOnboarding} redirectTo={home}>
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
        <Stack.Screen name="pacote/editar" options={{ presentation: 'modal', title: 'Pacote' }} />
        <Stack.Screen name="ajustes/retorno" options={{ title: 'Retorno de clientes' }} />
        <Stack.Screen name="agendamento/recibo" options={{ presentation: 'modal', title: 'Comprovante' }} />
        <Stack.Screen name="ajustes/assinatura" options={{ title: 'Planos' }} />
        <Stack.Screen name="ajustes/regioes" options={{ title: 'Regiões e deslocamento' }} />
        <Stack.Screen name="ajustes/aparencia" options={{ title: 'Aparência e cores' }} />
      </Stack.Protected>
      {/* Sempre acessível, com ou sem login. Ficam por último: ao abrir o site sem endereço, o app vai para a primeira tela liberada da lista (login, onboarding ou agenda), nunca para os Termos */}
      <Stack.Screen name="agendar/[slug]" options={{ headerShown: false, title: 'Agendar horário' }} />
      <Stack.Screen name="termos" options={{ headerShown: false, title: 'Termos de Uso' }} />
      <Stack.Screen name="privacidade" options={{ headerShown: false, title: 'Política de Privacidade' }} />
      <Stack.Screen name="redefinir-senha" options={{ headerShown: false, title: 'Redefinir senha' }} />
      <Stack.Screen name="+not-found" options={{ headerShown: false, title: 'Página não encontrada' }} />
      <Stack.Screen name="_sitemap" options={{ headerShown: false, title: 'Página não encontrada' }} />
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
