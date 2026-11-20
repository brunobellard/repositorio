// Toasts minimalistas: avisos curtos no topo da tela, sem bloquear o uso (substituem Alert).
// Uso em qualquer lugar (inclusive fora de componentes): showToast('Agendamento salvo')
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
}

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();
let nextId = 1;

/** Mostra um aviso curto. Erros ficam um pouco mais na tela. */
export function showToast(title: string, message?: string, tone: ToastTone = 'success') {
  const item = { id: nextId++, title, message, tone };
  listeners.forEach((l) => l(item));
}

const TONES: Record<ToastTone, { icon: 'checkmark-circle' | 'alert-circle' | 'information-circle'; color: string }> = {
  success: { icon: 'checkmark-circle', color: '#5E8B6A' },
  error: { icon: 'alert-circle', color: '#B2474F' },
  info: { icon: 'information-circle', color: colors.primaryDark },
};

/** Coloque uma vez no layout raiz. */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<ToastItem | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const listener: Listener = (t) => {
      if (timer.current) clearTimeout(timer.current);
      setItem(t);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      timer.current = setTimeout(
        () => Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setItem(null)),
        t.tone === 'error' ? 4500 : 2600,
      );
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [anim]);

  if (!item) return null;
  const tone = TONES[item.tone];
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 1000,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      }}>
      <Pressable accessibilityRole="button"
        onPress={() => setItem(null)}
        className="flex-row items-center self-center rounded-2xl border border-line bg-surface px-4 py-3"
        style={{
          maxWidth: 520,
          shadowColor: '#2A2326',
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}>
        <Ionicons name={tone.icon} size={20} color={tone.color} />
        <View className="ml-2.5 flex-shrink">
          <Text className="text-[14px] font-semibold text-ink">{item.title}</Text>
          {item.message ? <Text className="text-[12px] leading-4 text-muted">{item.message}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
