// Faixa fina no topo: aparece sem internet, ou enquanto as alterações offline são enviadas.
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/data/store';

export function OfflineBanner() {
  const { online, pendingSync, syncing } = useStore();
  const insets = useSafeAreaInsets();
  if (online && !syncing && !pendingSync) return null;

  const offline = !online;
  const text = offline
    ? `Modo offline — alterações serão sincronizadas automaticamente${pendingSync ? ` (${pendingSync} pendente${pendingSync > 1 ? 's' : ''})` : ''}`
    : syncing
      ? 'Sincronizando com a nuvem…'
      : `${pendingSync} alteraç${pendingSync > 1 ? 'ões' : 'ão'} aguardando envio`;

  return (
    // Sobreposta no topo (não empurra o layout das telas) e sem bloquear toques
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 900, paddingTop: insets.top }}
      className={offline ? 'bg-[#4A4246]/95' : 'bg-primary-dark/95'}>
      <View className="flex-row items-center justify-center px-4 py-1.5">
        {offline ? (
          <Ionicons name="cloud-offline-outline" size={13} color="#fff" />
        ) : (
          <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.7 }] }} />
        )}
        <Text numberOfLines={1} className="ml-1.5 text-[12px] font-medium text-white">
          {text}
        </Text>
      </View>
    </View>
  );
}
