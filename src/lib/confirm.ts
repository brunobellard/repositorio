import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

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

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}
