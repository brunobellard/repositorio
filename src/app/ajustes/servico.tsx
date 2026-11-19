import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderKeyboardView } from '@/components/keyboard-view';
import { Button, Chip, Field, SectionLabel } from '@/components/ui';
import { serviceCategories } from '@/data/mock';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { requireFeature } from '@/lib/upgrade';
import { closeModal, confirmAction, notify } from '@/lib/confirm';
import { formatDuration } from '@/lib/dates';
import { formatBRL, maskBRL, onlyDigits } from '@/lib/format';
import { colors } from '@/theme/colors';

const DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180];

export default function EditarServico() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { services, saveService, deleteService, setServiceActive } = useStore();
  const access = usePlanAccess();
  const insets = useSafeAreaInsets();
  const existing = services.find((s) => s.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? 'Unhas');
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [price, setPrice] = useState(existing?.price ?? 0);
  const [duration, setDuration] = useState(existing?.durationMin ?? 60);
  const [customDuration, setCustomDuration] = useState(
    existing && !DURATIONS.includes(existing.durationMin) ? String(existing.durationMin) : '',
  );
  const [saving, setSaving] = useState(false);

  const categories = [...new Set([...serviceCategories, ...services.map((s) => s.category)])];
  const finalCategory = (newCategory ?? category).trim();
  const canSave = !!name.trim() && !!finalCategory && duration > 0 && !saving;

  async function save() {
    if (!canSave) return;
    // Serviço novo entra ativo: respeita o limite de serviços ativos do plano
    if (!existing && !requireFeature(access.canAddService(), 'unlimitedServices')) return;
    setSaving(true);
    const ok = await saveService({
      id: existing?.id,
      name: name.trim(),
      category: finalCategory,
      price,
      durationMin: duration,
      active: existing?.active ?? true,
    });
    setSaving(false);
    if (ok) closeModal();
  }

  function remove() {
    if (!existing) return;
    confirmAction('Excluir serviço?', `"${existing.name}" será removido do catálogo.`, async () => {
      const result = await deleteService(existing.id);
      if (result === 'ok') closeModal();
      if (result === 'in_use') {
        confirmAction(
          'Serviço já usado',
          'Este serviço aparece no histórico de agendamentos, então não pode ser excluído. Quer desativá-lo? Ele some da tela de agendar, mas o histórico fica guardado.',
          async () => {
            await setServiceActive(existing.id, false);
            notify('Serviço desativado');
            closeModal();
          },
          'Desativar',
        );
      }
    }, 'Excluir');
  }

  return (
    <HeaderKeyboardView>
      <Stack.Screen options={{ title: existing ? 'Editar serviço' : 'Novo serviço' }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
        <Field
          label="Nome do serviço"
          value={name}
          onChangeText={setName}
          placeholder="Ex: Alongamento em gel"
          autoFocus={!existing}
        />

        <View className="mb-3">
          <Text className="mb-1.5 text-[13px] font-medium text-muted">Preço</Text>
          <TextInput
            value={formatBRL(price)}
            onChangeText={(t) => setPrice(maskBRL(t).value)}
            keyboardType="number-pad"
            className="rounded-2xl border border-line bg-surface px-4 py-3 text-[20px] font-semibold text-ink"
          />
        </View>

        <SectionLabel>Categoria</SectionLabel>
        <View className="flex-row flex-wrap">
          {categories.map((c) => (
            <Chip
              key={c}
              label={c}
              selected={newCategory === null && category === c}
              onPress={() => {
                setCategory(c);
                setNewCategory(null);
              }}
            />
          ))}
          <Chip label="+ Nova" selected={newCategory !== null} onPress={() => setNewCategory('')} />
        </View>
        {newCategory !== null ? (
          <Field
            label="Nome da nova categoria"
            value={newCategory}
            onChangeText={setNewCategory}
            placeholder="Ex: Massagem"
            autoFocus
          />
        ) : null}

        <SectionLabel>Duração estimada · {formatDuration(duration)}</SectionLabel>
        <View className="flex-row flex-wrap">
          {DURATIONS.map((d) => (
            <Chip
              key={d}
              label={formatDuration(d)}
              selected={!customDuration && duration === d}
              onPress={() => {
                setDuration(d);
                setCustomDuration('');
              }}
            />
          ))}
        </View>
        <View className="mt-1 flex-row items-center">
          <TextInput
            value={customDuration}
            onChangeText={(t) => {
              const v = onlyDigits(t).slice(0, 3);
              setCustomDuration(v);
              if (Number(v) > 0) setDuration(Number(v));
            }}
            placeholder="Outro"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            className={`w-24 rounded-2xl border px-4 py-2.5 text-[15px] text-ink ${
              customDuration ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
            }`}
          />
          <Text className="ml-2 text-[14px] text-muted">minutos</Text>
        </View>
        <Text className="mt-3 text-[12px] leading-4 text-muted">
          Ao agendar, a duração dos serviços escolhidos é somada para calcular o horário de término.
        </Text>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 gap-2 border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Button title={saving ? 'Salvando…' : 'Salvar serviço'} onPress={save} disabled={!canSave} />
        {existing ? <Button title="Excluir serviço" variant="danger" icon="trash-outline" onPress={remove} /> : null}
      </View>
    </HeaderKeyboardView>
  );
}
