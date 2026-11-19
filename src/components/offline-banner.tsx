// Faixa fina no topo das telas principais: aparece sem internet, ou enquanto as
// alterações feitas offline são enviadas. Fica no fluxo da tela (empurra o conteúdo
// para baixo) em vez de flutuar por cima do título.
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Text, View } from 'react-native';

import { useStore } from '@/data/store';
import { colors } from '@/theme/colors';

const OFFLINE_BG = '#4A4246'; // grafite quente, contraste alto com texto branco

export function OfflineBanner() {
  const { online, pendingSync, syncing } = useStore();
  if (online && !syncing && !pendingSync) return null;

  const offline = !online;
  const text = offline
    ? // Só três ações entram na fila offline; o resto precisa de conexão (ver services/offlineSync.ts)
      `Sem internet — dá para cadastrar cliente, agendar e concluir atendimento${
        pendingSync ? ` (${pendingSync} aguardando envio)` : '; o resto espera a conexão'
      }`
    : syncing
      ? 'Sincronizando com a nuvem…'
      : `${pendingSync} alteraç${pendingSync > 1 ? 'ões' : 'ão'} aguardando envio`;

  return (
    <View
      accessibilityRole="alert"
      // Cor direto no estilo: no celular o NativeWind não aplicava a cor com transparência
      style={{ backgroundColor: offline ? OFFLINE_BG : colors.primaryDark }}
      className="flex-row items-center justify-center px-4 py-2">
      {offline ? (
        <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
      ) : (
        <ActivityIndicator size="small" color="#FFFFFF" style={{ transform: [{ scale: 0.7 }] }} />
      )}
      <Text style={{ color: '#FFFFFF' }} numberOfLines={2} className="ml-2 flex-shrink text-center text-[12px] font-medium">
        {text}
      </Text>
    </View>
  );
}
