import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Chip, Field, SectionLabel } from '@/components/ui';
import { expenseCategories } from '@/data/mock';
import { useStore } from '@/data/store';
import { closeModal } from '@/lib/confirm';

export default function NovaDespesa() {
  const { addTransaction } = useStore();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Materiais');
  const [description, setDescription] = useState('');

  const value = Number(amount.replace(/\./g, '').replace(',', '.'));
  const valid = Number.isFinite(value) && value > 0;

  async function save() {
    if (!valid) return;
    const ok = await addTransaction({
      type: 'despesa',
      amount: Math.round(value * 100) / 100,
      category,
      description: description.trim() || undefined,
      occurredAt: new Date().toISOString(),
    });
    if (ok) closeModal();
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
        <Button title="Lançar despesa" onPress={save} disabled={!valid} />
      </View>
    </ScrollView>
  );
}
