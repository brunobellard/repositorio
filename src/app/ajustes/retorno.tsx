import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip } from '@/components/ui';
import { useStore } from '@/data/store';
import { notify } from '@/lib/confirm';
import { onlyDigits } from '@/lib/format';
import { clientsToRecall } from '@/lib/recall';
import { colors } from '@/theme/colors';

const OPTIONS = [15, 20, 30, 45, 60];

export default function RetornoClientes() {
  const { profile, clients, appointments, clientHistory, updateProfile } = useStore();
  const [days, setDays] = useState(profile.recallDays);
  const [custom, setCustom] = useState(OPTIONS.includes(profile.recallDays) ? '' : String(profile.recallDays));
  const [saving, setSaving] = useState(false);

  const valid = days >= 5 && days <= 365;
  const preview = valid ? clientsToRecall(clients, appointments, days, undefined, clientHistory).length : 0;

  async function save() {
    setSaving(true);
    const ok = await updateProfile({ recallDays: days });
    setSaving(false);
    if (ok) notify('Prazo salvo', `Clientes sem voltar há mais de ${days} dias aparecem em "Para chamar de volta".`);
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Text className="mb-4 text-[13px] leading-5 text-muted">
        Uma cliente entra na lista &quot;Para chamar de volta&quot; quando o último atendimento concluído foi há mais
        dias que o prazo abaixo e ela não tem nenhum horário marcado.
      </Text>

      <Card>
        <Text className="mb-2 text-[15px] font-semibold text-ink">Chamar de volta depois de</Text>
        <View className="flex-row flex-wrap items-center">
          {OPTIONS.map((d) => (
            <Chip
              key={d}
              label={`${d} dias`}
              selected={!custom && days === d}
              onPress={() => {
                setCustom('');
                setDays(d);
              }}
            />
          ))}
          <TextInput
            value={custom}
            onChangeText={(t) => {
              const v = onlyDigits(t).slice(0, 3);
              setCustom(v);
              if (Number(v) > 0) setDays(Number(v));
            }}
            placeholder="Outro"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            className={`mb-2 w-20 rounded-full border px-4 py-2 text-center text-sm text-ink ${
              custom ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
            }`}
          />
        </View>
        <Text className="mt-1 text-[13px] text-muted">
          {valid
            ? `Com ${days} dias, ${preview} ${preview === 1 ? 'cliente aparece' : 'clientes aparecem'} na lista hoje.`
            : 'Use um prazo entre 5 e 365 dias.'}
        </Text>
      </Card>

      {days !== profile.recallDays ? (
        <View className="mt-4">
          <Button title={saving ? 'Salvando…' : 'Salvar prazo'} onPress={save} disabled={!valid || saving} />
        </View>
      ) : null}

      <View className="mt-4">
        <Button
          title="Editar mensagens de retorno e aniversário"
          icon="chatbubbles-outline"
          variant="secondary"
          onPress={() => router.push('/ajustes/mensagens')}
        />
      </View>
    </ScrollView>
  );
}
