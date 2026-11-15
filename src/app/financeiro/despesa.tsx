import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Chip, Field, SectionLabel } from '@/components/ui';
import { expenseCategories } from '@/data/mock';
import { useStore } from '@/data/store';
import { closeModal, notify } from '@/lib/confirm';

export default function NovaDespesa() {
  const { addTransaction } = useStore();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Materiais');
  const [description, setDescription] = useState('');

  const value = Number(amount.replace(/\./g, '').replace(',', '.'));
  const valid = Number.isFinite(value) && value > 0;

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
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <Field
        label="Valor (R$)"
        value={amount}
        onChangeText={setAmount}
        placeholder="0,00"
        keyboardType="decimal-pad"
        autoFocus
      />
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
  );
}
