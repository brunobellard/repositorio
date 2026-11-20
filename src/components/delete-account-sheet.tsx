import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showToast } from '@/components/toast';
import { Button } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { colors } from '@/theme/colors';

const CONFIRM_WORD = 'EXCLUIR';

/**
 * Confirmação da exclusão permanente da conta: exige digitar EXCLUIR.
 * Ao concluir, a sessão termina e o app volta sozinho para a tela de login.
 */
export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { deleteAccount } = useAuth();
  const insets = useSafeAreaInsets();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = typed.trim().toUpperCase() === CONFIRM_WORD && !busy;

  function close() {
    if (busy) return;
    setTyped('');
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const err = await deleteAccount();
    setBusy(false);
    if (err) return setError(err);
    showToast('Sua conta foi excluída');
    setTyped('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <Pressable accessible={false} onPress={close} className="flex-1 justify-end bg-black/30">
          <Pressable accessible={false}
            onPress={() => {}}
            className="rounded-t-3xl bg-surface px-5 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 4 }}>
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-line" />
            <View className="flex-row items-center">
              <Ionicons name="warning-outline" size={20} color="#B2474F" />
              <Text className="ml-2 text-[17px] font-semibold text-ink">Excluir minha conta</Text>
            </View>
            <Text className="mt-2 text-[13px] leading-5 text-muted">
              Isso apaga para sempre sua conta e todos os dados do estúdio: clientes, agenda, histórico, financeiro,
              pacotes, serviços e o logo. Não é possível desfazer.
            </Text>
            <Text className="mt-2 text-[13px] leading-5 text-muted">
              Se você tiver uma assinatura paga, cancele também na loja de aplicativos para não ser cobrada.
            </Text>

            <Text className="mb-1.5 mt-4 text-[13px] font-medium text-muted">
              Para confirmar, digite <Text className="font-bold text-ink">{CONFIRM_WORD}</Text>
            </Text>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder={CONFIRM_WORD}
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!busy}
              className="rounded-2xl border border-line bg-bg px-4 py-3 text-[15px] text-ink"
            />

            {error ? (
              <View className="mt-3 rounded-2xl bg-primary-soft px-4 py-3">
                <Text className="text-[13px] text-primary-dark">{error}</Text>
              </View>
            ) : null}

            <View className="mt-4">
              <Button
                title={busy ? 'Excluindo…' : 'Excluir conta para sempre'}
                variant="danger"
                icon="trash-outline"
                loading={busy}
                disabled={!ready}
                onPress={confirm}
              />
            </View>
            <Pressable accessibilityRole="button" onPress={close} disabled={busy} className="mt-1 items-center py-3">
              <Text className="text-[15px] font-medium text-muted">Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
