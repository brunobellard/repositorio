// Notificações push: avisa a profissional quando uma cliente agenda pelo link online.
//
// Fluxo:
//   1. O app pede permissão, obtém o ExpoPushToken e salva em profiles.expo_push_token.
//   2. A cliente agenda no link -> o banco chama a Edge Function notify-new-booking
//      (supabase/functions/notify-new-booking), que envia o push pelo serviço da Expo.
//   3. Tocar na notificação abre a Agenda no dia do agendamento.
//
// Importante: no Android, o Expo Go NÃO recebe push remoto desde o SDK 53.
// Para testar o push de verdade é preciso um "development build" (eas build).
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export const PUSH_CHANNEL = 'agendamentos';

/** Dados que acompanham a notificação de novo agendamento */
export interface BookingPushData {
  type: 'new_booking';
  appointmentId: string;
  /** Data do agendamento, 'YYYY-MM-DD' (fuso do estúdio) */
  date: string;
}

// Com o app aberto, mostra a notificação como banner (em vez de ignorar)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PushRegistration =
  | { ok: true; token: string }
  | { ok: false; reason: 'web' | 'simulator' | 'denied' | 'expo-go-android' | 'no-project' | 'error'; message: string };


/**
 * No Expo Go do Android não há push (SDK 53+) e o módulo de canais falha: nem tenta registrar.
 * isRunningInExpoGo() é a forma oficial; executionEnvironment 'storeClient' também vale
 * para builds de desenvolvimento, então não serve para distinguir.
 */
export const pushUnsupportedHere = Platform.OS === 'android' && isRunningInExpoGo();

/**
 * Pede permissão e devolve o ExpoPushToken deste aparelho.
 * Nunca lança erro: qualquer falha vira { ok: false, message } para a tela tratar.
 */
export async function registerForPushAsync(): Promise<PushRegistration> {
  if (Platform.OS === 'web') {
    return { ok: false, reason: 'web', message: 'Notificações push funcionam só no app do celular.' };
  }
  if (!Device.isDevice) {
    return { ok: false, reason: 'simulator', message: 'Use um celular de verdade para receber notificações.' };
  }
  // Antes de qualquer chamada nativa: no Expo Go do Android o módulo de push não funciona
  if (pushUnsupportedHere) {
    return {
      ok: false,
      reason: 'expo-go-android',
      message:
        'O Expo Go no Android não recebe push. Para receber os avisos, instale a versão de desenvolvimento do app.',
    };
  }

  try {
    // Android: o canal precisa existir antes do pedido de permissão / token
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
        name: 'Agendamentos',
        importance: AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#B76E79',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') {
      return {
        ok: false,
        reason: 'denied',
        message: 'Permissão negada. Ative as notificações do Esmero nas configurações do celular.',
      };
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      return { ok: false, reason: 'no-project', message: 'Projeto Expo não configurado (projectId ausente).' };
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { ok: true, token: data };
  } catch (e) {
    // Mensagem técnica fica só no log; a tela mostra um texto claro
    console.warn('[push] falha ao registrar', e);
    return {
      ok: false,
      reason: 'error',
      message: 'Não foi possível ativar as notificações neste aparelho. Feche e abra o app e tente de novo.',
    };
  }
}

/**
 * Notificação de teste.
 * Com token: envia pelo serviço de push da Expo (testa o caminho real).
 * Sem token (ex: Expo Go no Android): mostra uma notificação local.
 */
export async function sendTestNotificationAsync(token?: string): Promise<'push' | 'local'> {
  const content = {
    title: 'Novo Agendamento Online ✨',
    body: 'Teste: Maria Silva agendou Manicure para amanhã às 14:00',
  };
  if (token) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, sound: 'default', channelId: PUSH_CHANNEL, priority: 'high', ...content }),
    });
    const json = await res.json();
    const ticket = Array.isArray(json?.data) ? json.data[0] : json?.data;
    if (ticket?.status === 'error') throw new Error(ticket.message ?? 'Falha no envio');
    return 'push';
  }
  await Notifications.scheduleNotificationAsync({ content, trigger: null });
  return 'local';
}

const isNewBooking = (n: Notifications.Notification | undefined) =>
  (n?.request.content.data as Partial<BookingPushData> | undefined)?.type === 'new_booking';

/**
 * Liga as notificações de agendamento online ao app (com o app aberto ou abrindo do zero):
 *   * ao chegar uma, com o app aberto, recarrega os dados (o novo horário aparece na agenda);
 *   * ao tocar nela, recarrega e abre a Agenda no dia do agendamento.
 */
export function useNotificationNavigation(enabled: boolean, onNewBooking?: () => void) {
  // Guarda a função mais recente sem refazer as inscrições
  const reload = useRef(onNewBooking);
  useEffect(() => {
    reload.current = onNewBooking;
  }, [onNewBooking]);

  useEffect(() => {
    // No Expo Go do Android não há push: nada para ouvir
    if (!enabled || Platform.OS === 'web' || pushUnsupportedHere) return;

    const open = (response: Notifications.NotificationResponse | null | undefined) => {
      if (!isNewBooking(response?.notification)) return;
      reload.current?.();
      const date = (response!.notification.request.content.data as Partial<BookingPushData>).date;
      if (date) router.navigate({ pathname: '/', params: { date } });
    };

    // App aberto a partir de uma notificação (estava fechado)
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        open(r);
        if (r) return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => {});
    try {
      // Toque com o app aberto ou em segundo plano
      const tap = Notifications.addNotificationResponseReceivedListener(open);
      // Chegou com o app aberto: atualiza a agenda mesmo sem toque
      const received = Notifications.addNotificationReceivedListener((n) => {
        if (isNewBooking(n)) reload.current?.();
      });
      return () => {
        tap.remove();
        received.remove();
      };
    } catch {
      return;
    }
  }, [enabled]);
}
