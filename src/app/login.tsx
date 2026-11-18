import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ForgotPasswordSheet } from '@/components/forgot-password-sheet';
import { Button, Field, Segmented } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { useBiometricLock } from '@/data/biometric-lock';
import { confirmAction } from '@/lib/confirm';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const biometric = useBiometricLock();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  const creating = mode === 'criar';
  // Termos de Uso e Privacidade: aceitos uma única vez, no primeiro acesso (onboarding)
  const valid =
    email.includes('@') && password.length >= 6 && (!creating || (businessName.trim() && ownerName.trim()));

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setMessage(null);
    const err = creating
      ? await signUp(email, password, businessName, ownerName)
      : await signIn(email, password);
    setBusy(false);
    if (err) return setMessage(err);
    // Primeiro acesso com senha neste aparelho: oferece entrar com digital nas próximas vezes
    if (biometric.support.available && !biometric.enabled) {
      confirmAction(
        `Entrar com ${biometric.support.label}?`,
        `Nas próximas vezes você abre o app com sua ${biometric.support.label}, sem digitar a senha.`,
        () => biometric.enable(),
        'Ativar',
      );
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 48, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled">
        <View className="mb-8 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-primary">
            <Text className="text-3xl">💅</Text>
          </View>
          <Text className="text-[28px] font-bold tracking-tight text-ink">Agenda Beleza</Text>
          <Text className="mt-1 text-center text-[14px] text-muted">
            Agenda, clientes e financeiro do seu estúdio em um só lugar
          </Text>
        </View>

        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setMessage(null);
          }}
          options={[
            { value: 'entrar', label: 'Entrar' },
            { value: 'criar', label: 'Criar conta' },
          ]}
        />

        <View className="mt-5">
          {creating ? (
            <>
              <Field label="Nome do estúdio" value={businessName} onChangeText={setBusinessName} placeholder="Ex: Studio Ana Lima" />
              <Field label="Seu nome" value={ownerName} onChangeText={setOwnerName} placeholder="Ex: Ana Lima" />
            </>
          ) : null}
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="voce@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
            autoComplete={creating ? 'new-password' : 'current-password'}
            onSubmitEditing={submit}
          />
        </View>

        {!creating ? (
          <Pressable onPress={() => setForgot(true)} className="-mt-1 mb-3 self-end py-1 active:opacity-60">
            <Text className="text-[13px] font-medium text-primary-dark">Esqueci minha senha</Text>
          </Pressable>
        ) : null}

        {message ? (
          <View className="mb-3 rounded-2xl bg-primary-soft px-4 py-3">
            <Text className="text-[13px] text-primary-dark">{message}</Text>
          </View>
        ) : null}

        <Button title={busy ? 'Aguarde…' : creating ? 'Criar conta' : 'Entrar'} onPress={submit} disabled={!valid || busy} />

        {!creating ? (
          <Pressable onPress={() => setMode('criar')} className="mt-5 items-center">
            <Text className="text-[14px] text-muted">
              Ainda não tem conta? <Text className="font-semibold text-primary-dark">Criar conta</Text>
            </Text>
          </Pressable>
        ) : null}

      </ScrollView>
      <ForgotPasswordSheet visible={forgot} initialEmail={email} onClose={() => setForgot(false)} />
    </KeyboardAvoidingView>
  );
}
