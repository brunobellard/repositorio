import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/ui';
import { useStore } from '@/data/store';
import { notify } from '@/lib/confirm';
import { maskPhone, onlyDigits } from '@/lib/format';
import { colors } from '@/theme/colors';

/** "1503" -> "15/03", "15031992" -> "15/03/1992" (máscara enquanto digita) */
function maskBirth(t: string) {
  const d = onlyDigits(t).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "15/03/1992" -> "1992-03-15" (ou null se incompleta/inválida) */
function birthToIso(t: string): string | null {
  const [dd, mm, yyyy] = t.split('/').map(Number);
  if (!dd || !mm || !yyyy || yyyy < 1900 || mm > 12 || dd > 31) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getDate() !== dd || d > new Date()) return null;
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export default function NovaCliente() {
  const params = useLocalSearchParams<{ name?: string }>();
  const insets = useSafeAreaInsets();
  const { addClient } = useStore();

  const [name, setName] = useState(params.name ?? '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birth, setBirth] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const birthIso = birth ? birthToIso(birth) : null;
  const birthOk = !birth || !!birthIso;
  const emailOk = !email || /^\S+@\S+\.\S+$/.test(email.trim());
  const canSave = name.trim().length >= 2 && birthOk && emailOk && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true); // trava o botão no primeiro toque (evita cadastro duplicado)
    const created = await addClient({
      name: name.trim(),
      whatsapp: onlyDigits(phone) || undefined,
      email: email.trim() || undefined,
      birthDate: birthIso ?? undefined,
      technicalNotes: notes.trim() || undefined,
    });
    if (!created) {
      setSaving(false);
      return;
    }
    notify('Cliente cadastrada', created.name);
    router.replace({ pathname: '/clientes/[id]', params: { id: created.id } });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Field label="Nome completo" value={name} onChangeText={setName} placeholder="Ex: Maria Silva" autoFocus />
        <Field
          label="WhatsApp"
          value={phone}
          onChangeText={(t) => setPhone(maskPhone(t))}
          placeholder="(11) 90000-0000"
          keyboardType="phone-pad"
        />
        <Field
          label={emailOk ? 'E-mail (opcional)' : 'E-mail — confira o endereço'}
          value={email}
          onChangeText={setEmail}
          placeholder="maria@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label={birthOk ? 'Data de nascimento (opcional)' : 'Data de nascimento — confira a data'}
          value={birth}
          onChangeText={(t) => setBirth(maskBirth(t))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
        />
        <Text className="mb-1.5 text-[13px] font-medium text-muted">Anotações técnicas (opcional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Ex: alergia a cola, formato de unha preferido, nº da henna…"
          placeholderTextColor={colors.muted}
          multiline
          className="min-h-[90px] rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink"
          style={{ textAlignVertical: 'top' }}
        />
      </ScrollView>
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Button title={saving ? 'Salvando…' : 'Cadastrar cliente'} loading={saving} onPress={save} disabled={!canSave} />
      </View>
    </KeyboardAvoidingView>
  );
}
