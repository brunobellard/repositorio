import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { HeaderKeyboardView } from '@/components/keyboard-view';
import { Button, Chip, Field, SectionLabel } from '@/components/ui';
import { expenseCategories } from '@/data/mock';
import { useStore } from '@/data/store';
import { closeModal, notify } from '@/lib/confirm';
import { formatBRL, maskBRL } from '@/lib/format';

export default function NovaDespesa() {
  const { addTransaction } = useStore();
  // Valor em reais, digitado como na maquininha: 1250 → R$ 12,50 (sem dúvida entre ponto e vírgula)
  const [value, setValue] = useState(0);
  const [category, setCategory] = useState('Materiais');
  const [description, setDescription] = useState('');

  const valid = value > 0;

  const [saving, setSaving] = useState(false);

  async function save() {
    if (!valid || saving) return;
    setSaving(true); // trava no primeiro toque: evita lançar a despesa duas vezes
    const ok = await addTransaction({
      type: 'despesa',
      amount: Math.round(value * 100) / 100,
      category,
      description: description.trim() || undefined,
      occurredAt: new Date().toISOString(),
    });
    if (ok) {
      notify('Despesa lançada');
      closeModal();
    } else setSaving(false);
  }

  return (
    <HeaderKeyboardView>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <View className="mb-3">
          <Text className="mb-1.5 text-[13px] font-medium text-muted">Valor</Text>
          <TextInput
            value={formatBRL(value)}
            onChangeText={(t) => setValue(maskBRL(t).value)}
            keyboardType="number-pad"
            autoFocus
            className="rounded-2xl border border-line bg-surface px-4 py-3 text-[20px] font-semibold text-ink"
          />
        </View>
        <SectionLabel>Categoria</SectionLabel>
        <View className="flex-row flex-wrap">
          {expenseCategories.map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
        <View className="mt-3">
          <Field label="Descrição" value={description} onChangeText={setDescription} placeholder="Ex: esmaltes, algodão" />
        </View>
        <View className="mt-2">
          <Button title={saving ? 'Salvando…' : 'Lançar despesa'} loading={saving} onPress={save} disabled={!valid} />
        </View>
      </ScrollView>
    </HeaderKeyboardView>
  );
}
