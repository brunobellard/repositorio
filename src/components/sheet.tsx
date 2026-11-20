import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui';
import type { SeriesScope } from '@/lib/recurrence';
import { colors } from '@/theme/colors';

/** Painel que sobe da parte de baixo da tela, com fundo escurecido. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessible={false} onPress={onClose} className="flex-1 justify-end bg-black/30">
        {/* Pressable interno impede que tocar no painel feche o modal */}
        <Pressable accessible={false}
          onPress={() => {}}
          className="rounded-t-3xl bg-surface px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 4 }}>
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-line" />
          <Text className="text-[17px] font-semibold text-ink">{title}</Text>
          {subtitle ? <Text className="mt-1 text-[13px] leading-5 text-muted">{subtitle}</Text> : null}
          <View className="mt-4">{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SheetOption({
  icon,
  label,
  detail,
  onPress,
  tone = 'default',
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  const color = tone === 'danger' ? '#B2474F' : colors.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={detail}
      onPress={onPress}
      className="mb-2 flex-row items-center rounded-2xl border border-line bg-bg px-4 py-3.5 active:opacity-70">
      <Ionicons name={icon} size={18} color={tone === 'danger' ? color : colors.primaryDark} />
      <View className="ml-3 flex-1">
        <Text className="text-[15px] font-medium" style={{ color }}>
          {label}
        </Text>
        {detail ? <Text className="text-xs text-muted">{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Pergunta se a ação vale só para esta sessão, para as próximas ou para a série toda. */
export function SeriesScopeSheet({
  visible,
  action,
  counts,
  onChoose,
  onClose,
}: {
  visible: boolean;
  action: 'editar' | 'cancelar';
  /** Quantas sessões cada opção afeta */
  counts: Record<SeriesScope, number>;
  onChoose: (scope: SeriesScope) => void;
  onClose: () => void;
}) {
  const verb = action === 'editar' ? 'Alterar' : 'Cancelar';
  const tone = action === 'cancelar' ? 'danger' : 'default';
  const n = (k: SeriesScope) => `${counts[k]} ${counts[k] === 1 ? 'sessão' : 'sessões'}`;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={action === 'editar' ? 'Alterar agendamento recorrente' : 'Cancelar agendamento recorrente'}
      subtitle="Este agendamento faz parte de uma série. Sessões já concluídas não são alteradas.">
      <SheetOption icon="calendar-outline" label={`${verb} apenas este`} tone={tone} onPress={() => onChoose('one')} />
      <SheetOption
        icon="arrow-forward-outline"
        label={`${verb} este e os próximos`}
        detail={n('following')}
        tone={tone}
        onPress={() => onChoose('following')}
      />
      <SheetOption
        icon="repeat-outline"
        label={`${verb} todos da série`}
        detail={`${n('all')} de hoje em diante`}
        tone={tone}
        onPress={() => onChoose('all')}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onClose} className="mt-1 items-center py-3">
        <Text className="text-[15px] font-medium text-muted">Voltar</Text>
      </Pressable>
    </Sheet>
  );
}
