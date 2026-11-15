import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

import { showToast, type ToastTone } from '@/components/toast';

/** Fecha o modal; se a tela foi aberta direto (sem histórico), volta para a Agenda. */
export function closeModal() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Confirmação simples que funciona no celular e no navegador. */
export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = 'Confirmar',
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Voltar', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Aviso rápido (toast no topo da tela, sem bloquear o uso).
 * O tom é deduzido do título: mensagens de erro ficam em vermelho e mais tempo na tela.
 */
export function notify(title: string, message?: string, tone?: ToastTone) {
  const isError = /não foi possível|erro|falha|sem conexão|bloqueou/i.test(title);
  showToast(title, message, tone ?? (isError ? 'error' : 'success'));
}
