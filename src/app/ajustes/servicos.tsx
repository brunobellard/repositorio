import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListSkeleton } from '@/components/skeleton';
import { Button, EmptyState, Toggle } from '@/components/ui';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { requireFeature } from '@/lib/upgrade';
import { formatDuration } from '@/lib/dates';
import { formatBRL } from '@/lib/format';
import { colors } from '@/theme/colors';

export default function ServicosScreen() {
  const { services, setServiceActive, loading } = useStore();
  const access = usePlanAccess();
  const insets = useSafeAreaInsets();
  const categories = [...new Set(services.map((s) => s.category))].sort();
  const activeCount = services.filter((s) => s.active).length;

  if (loading) return <ListSkeleton rows={7} />;

  return (
    <View className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text className="mb-1 text-[13px] text-muted">
          {activeCount} {activeCount === 1 ? 'serviço ativo' : 'serviços ativos'}
          {services.length > activeCount ? ` · ${services.length - activeCount} desativado(s)` : ''}. Serviços
          desativados não aparecem ao agendar.
        </Text>

        {services.length === 0 ? <EmptyState icon="sparkles-outline" text="Nenhum serviço cadastrado" /> : null}

        {categories.map((cat) => (
          <View key={cat}>
            <Text className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted">{cat}</Text>
            <View className="overflow-hidden rounded-card border border-line bg-surface">
              {services
                .filter((s) => s.category === cat)
                .map((s, i) => (
                  <View key={s.id} className={`flex-row items-center pr-4 ${i ? 'border-t border-line' : ''}`}>
                    {/* Tocar no nome edita; o interruptor fica fora, para não abrir a edição */}
                    <Pressable
                      onPress={() => router.push({ pathname: '/ajustes/servico', params: { id: s.id } })}
                      className="flex-1 flex-row items-center py-3 pl-4 active:opacity-60">
                      <View className="mr-3 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <View className={`flex-1 ${s.active ? '' : 'opacity-40'}`}>
                        <Text className="text-[15px] font-medium text-ink">{s.name}</Text>
                        <Text className="text-xs text-muted">
                          {formatDuration(s.durationMin)} · {formatBRL(s.price)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ marginHorizontal: 8 }} />
                    </Pressable>
                    <Toggle value={s.active} onChange={(on) => {
                        // Reativar conta no limite de serviços ativos do plano
                        if (on && !requireFeature(access.canAddService(), 'unlimitedServices')) return;
                        setServiceActive(s.id, on);
                      }} />
                  </View>
                ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Button
          title="Adicionar serviço"
          icon="add"
          onPress={() =>
            // Serviço novo entra ativo: respeita o limite de serviços ativos do plano
            requireFeature(access.canAddService(), 'unlimitedServices') && router.push('/ajustes/servico')
          }
        />
      </View>
    </View>
  );
}
