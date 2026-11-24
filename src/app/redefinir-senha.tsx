import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';
import { AppLogo } from '@/components/app-logo';

type Phase = 'checking' | 'form' | 'done' | 'invalid';

/** Lê os dados que o Supabase coloca no endereço do link do e-mail (#access_token=...&type=recovery). */
function readRecoveryHash() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),

  };
}

/**
 * Página do site aberta pelo link "redefinir senha" do e-mail.
 * Pública: não depende de login no app.
 */
export default function RedefinirSenha() {
  const [hash] = useState(readRecoveryHash);
  const hasTokens = !!hash?.accessToken && !!hash.refreshToken;
  const [phase, setPhase] = useState<Phase>(hasTokens ? 'checking' : 'invalid');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hash?.accessToken || !hash.refreshToken) return;
    supabase.auth
      .setSession({ access_token: hash.accessToken, refresh_token: hash.refreshToken })
      .then(({ error: e }) => {
        setPhase(e ? 'invalid' : 'form');
        // Tira os tokens da barra de endereço
        if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
      });
  }, [hash]);

  const valid = password.length >= 6 && password === confirm && !busy;

  async function save() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) return setError(friendlyError(e));
    // Encerra a sessão deste navegador: a pessoa entra no app com a senha nova
    await supabase.auth.signOut({ scope: 'local' });
    setPhase('done');
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <Stack.Screen options={{ title: 'Redefinir senha' }} />
      <View className="w-full max-w-[420px] self-center">
        <View className="mb-6 items-center">
          <View className="mb-3">
            <AppLogo size={56} />
          </View>
          <Text className="text-[22px] font-bold tracking-tight text-ink">Bellaflow</Text>
        </View>

        {phase === 'checking' ? (
          <ActivityIndicator color={colors.primary} />
        ) : phase === 'invalid' ? (
          <View className="items-center">
            <Ionicons name="link-outline" size={32} color={colors.muted} />
            <Text className="mt-3 text-center text-lg font-semibold text-ink">Link inválido ou expirado</Text>
            <Text className="mt-1 text-center text-[14px] leading-5 text-muted">
              O link de redefinição vale por pouco tempo e só pode ser usado uma vez. Peça um novo link no app, em Entrar → &quot;Esqueci minha senha&quot;.
            </Text>
          </View>
        ) : phase === 'done' ? (
          <View className="items-center">
            <Ionicons name="checkmark-circle" size={40} color={colors.primary} />
            <Text className="mt-3 text-center text-lg font-semibold text-ink">Senha alterada!</Text>
            <Text className="mt-1 text-center text-[14px] leading-5 text-muted">
              Volte ao app e entre com seu e-mail e a nova senha.
            </Text>
          </View>
        ) : (
          <>
            <Text className="mb-1 text-[18px] font-semibold text-ink">Crie uma nova senha</Text>
            <Text className="mb-4 text-[13px] text-muted">Use pelo menos 6 caracteres.</Text>
            <Field
              label="Nova senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
            />
            <Field
              label="Repita a nova senha"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoComplete="new-password"
              onSubmitEditing={save}
            />
            {confirm && password !== confirm ? (
              <Text className="-mt-1 mb-3 text-[12px] text-[#B2474F]">As senhas não são iguais.</Text>
            ) : null}
            {error ? (
              <View className="mb-3 rounded-2xl bg-primary-soft px-4 py-3">
                <Text className="text-[13px] text-primary-dark">{error}</Text>
              </View>
            ) : null}
            <Button title={busy ? 'Salvando…' : 'Salvar nova senha'} loading={busy} disabled={!valid} onPress={save} />
          </>
        )}
      </View>
    </ScrollView>
  );
}
