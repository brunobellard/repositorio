import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { colors } from '@/theme/colors';

/** "Esqueci minha senha": envia o e-mail com o link para criar uma nova senha. */
export function ForgotPasswordSheet({
  visible,
  initialEmail,
  onClose,
}: {
  visible: boolean;
  initialEmail: string;
  onClose: () => void;
}) {
  const { resetPassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && !busy;

  function close() {
    if (busy) return;
    setError(null);
    setSentTo(null);
    onClose();
  }

  async function send() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    const err = await resetPassword(email);
    setBusy(false);
    if (err) return setError(err);
    setSentTo(email.trim());
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} onShow={() => setEmail(initialEmail)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <Pressable onPress={close} className="flex-1 justify-end bg-black/30">
          <Pressable
            onPress={() => {}}
            className="rounded-t-3xl bg-surface px-5 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 4 }}>
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-line" />
            <Text className="text-[17px] font-semibold text-ink">Esqueci minha senha</Text>

            {sentTo ? (
              <>
                <Text className="mt-2 text-[14px] leading-5 text-muted">
                  Se existir uma conta com <Text className="font-semibold text-ink">{sentTo}</Text>, você vai receber um
                  e-mail com o link para criar uma nova senha. Confira também a caixa de spam.
                </Text>
                <View className="mt-4">
                  <Button title="Entendi" onPress={close} />
                </View>
              </>
            ) : (
              <>
                <Text className="mt-1 text-[13px] leading-5 text-muted">
                  Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
                </Text>
                <Text className="mb-1.5 mt-4 text-[13px] font-medium text-muted">E-mail</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="voce@email.com"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  onSubmitEditing={send}
                  className="rounded-2xl border border-line bg-bg px-4 py-3 text-[15px] text-ink"
                />
                {error ? (
                  <View className="mt-3 rounded-2xl bg-primary-soft px-4 py-3">
                    <Text className="text-[13px] text-primary-dark">{error}</Text>
                  </View>
                ) : null}
                <View className="mt-4">
                  <Button
                    title={busy ? 'Enviando…' : 'Enviar link'}
                    icon="mail-outline"
                    loading={busy}
                    disabled={!valid}
                    onPress={send}
                  />
                </View>
                <Pressable onPress={close} className="mt-1 items-center py-3">
                  <Text className="text-[15px] font-medium text-muted">Cancelar</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
