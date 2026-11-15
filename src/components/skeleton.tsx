// Skeleton loaders: blocos em tom suave que "pulsam" enquanto os dados carregam.
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, View, type DimensionValue } from 'react-native';

/** Bloco com pulso de opacidade (0.4 ↔ 0.9). */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 16,
  className = '',
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  className?: string;
}) {
  const [pulse] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View className={className} style={{ width }}>
      <Animated.View style={{ width: '100%', height, borderRadius: radius, backgroundColor: '#EBE4E2', opacity: pulse }} />
    </View>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return <View className="mb-3 rounded-card border border-line bg-surface p-4">{children}</View>;
}

/** Agenda: barra de dias + 4 cards de horário */
export function AgendaSkeleton() {
  return (
    <View className="px-4 pt-2" accessibilityLabel="Carregando agenda">
      <View className="mb-5 rounded-card border border-line bg-surface p-4">
        <Skeleton width={120} height={16} className="mb-4" />
        <View className="flex-row justify-between">
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} className="items-center">
              <Skeleton width={22} height={10} className="mb-2" />
              <Skeleton width={34} height={34} radius={17} />
            </View>
          ))}
        </View>
      </View>
      <Skeleton width={160} height={18} className="mb-2" />
      <Skeleton width={200} height={12} className="mb-5" />
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} className="mb-3 flex-row">
          <Skeleton width={40} height={12} className="mr-3 mt-1" />
          <View className="flex-1">
            <Skeleton height={64} radius={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Lista de clientes: busca + 6 cards */
export function ClientsSkeleton() {
  return (
    <View className="px-5" accessibilityLabel="Carregando clientes">
      <Skeleton height={46} className="mb-3" />
      <View className="overflow-hidden rounded-card border border-line bg-surface">
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} className={`flex-row items-center px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
            <Skeleton width={40} height={40} radius={20} />
            <View className="ml-3 flex-1">
              <Skeleton width="55%" height={14} className="mb-2" />
              <Skeleton width="35%" height={10} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Financeiro: 4 cards de resumo + lista de transações */
export function FinanceSkeleton() {
  return (
    <View className="px-5" accessibilityLabel="Carregando financeiro">
      <View className="flex-row flex-wrap justify-between">
        {Array.from({ length: 4 }, (_, i) => (
          <View key={i} className="mb-3 w-[48%] rounded-card border border-line bg-surface p-4">
            <Skeleton width="70%" height={10} className="mb-3" />
            <Skeleton width="85%" height={18} />
          </View>
        ))}
      </View>
      <Skeleton width={110} height={10} className="mb-3 mt-4" />
      <Skeleton height={34} radius={17} className="mb-3" />
      <CardShell>
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} className={`flex-row items-center py-2.5 ${i ? 'border-t border-line' : ''}`}>
            <Skeleton width={34} height={34} radius={17} />
            <View className="ml-3 flex-1">
              <Skeleton width="60%" height={12} className="mb-2" />
              <Skeleton width="40%" height={10} />
            </View>
            <Skeleton width={64} height={12} />
          </View>
        ))}
      </CardShell>
    </View>
  );
}

/** Lista simples (ex: serviços) */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View className="p-5" accessibilityLabel="Carregando">
      <CardShell>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} className={`flex-row items-center py-3 ${i ? 'border-t border-line' : ''}`}>
            <Skeleton width={10} height={10} radius={5} className="mr-3" />
            <View className="flex-1">
              <Skeleton width="60%" height={13} className="mb-2" />
              <Skeleton width="30%" height={10} />
            </View>
            <Skeleton width={40} height={22} radius={11} />
          </View>
        ))}
      </CardShell>
    </View>
  );
}
