import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderKeyboardView } from '@/components/keyboard-view';
import { AddressFields } from '@/components/address-fields';
import { Button, Field } from '@/components/ui';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { closeModal, notify } from '@/lib/confirm';
import { isValidEmail, isValidPhone, maskPhone, onlyDigits } from '@/lib/format';
import { requireFeature } from '@/lib/upgrade';
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

/** "1992-03-15" -> "15/03/1992" */
const isoToBirth = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');

/** Cadastro de cliente; com `id`, edita a cliente existente. */
export default function NovaCliente() {
  const params = useLocalSearchParams<{ name?: string; id?: string }>();
  const insets = useSafeAreaInsets();
  const { addClient, updateClient, clients, serviceAreas } = useStore();
  const editing = params.id ? clients.find((c) => c.id === params.id) : undefined;
  // Endereço só interessa a quem atende a domicílio (na edição, mantém o que já existe)
  const access = usePlanAccess();
  const homeService = access.serviceMode !== 'fixed' || !!editing?.address;

  const [name, setName] = useState(editing?.name ?? params.name ?? '');
  const [phone, setPhone] = useState(editing?.whatsapp ? maskPhone(editing.whatsapp) : '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [birth, setBirth] = useState(isoToBirth(editing?.birthDate));
  const [notes, setNotes] = useState(editing?.technicalNotes ?? '');
  const [address, setAddress] = useState(editing?.address ?? '');
  const [neighborhood, setNeighborhood] = useState(editing?.neighborhood ?? '');
  const [saving, setSaving] = useState(false);

  const birthIso = birth ? birthToIso(birth) : null;
  const birthOk = !birth || !!birthIso;
  const emailOk = !email || isValidEmail(email);
  // Mesma regra do link público: DDD + número (10 ou 11 dígitos), se preenchido
  const phoneOk = !phone || isValidPhone(phone);
  // O que falta, em vez de botão apagado sem explicação (UX-03)
  const problems = [
    ...(name.trim().length < 2 ? ['nome (pelo menos 2 letras)'] : []),
    ...(!phoneOk ? ['WhatsApp com DDD'] : []),
    ...(!emailOk ? ['e-mail válido'] : []),
    ...(!birthOk ? ['data de nascimento válida'] : []),
  ];

  async function save() {
    if (saving) return;
    if (problems.length) {
      notify('Confira o cadastro', `Falta: ${problems.join(', ')}.`, 'info');
      return;
    }
    const data = {
      name: name.trim(),
      whatsapp: onlyDigits(phone) || undefined,
      email: email.trim() || undefined,
      birthDate: birthIso ?? undefined,
      technicalNotes: notes.trim() || undefined,
      address: address.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
    };
    if (editing) {
      setSaving(true);
      const ok = await updateClient(editing.id, data);
      if (!ok) {
        setSaving(false);
        return;
      }
      notify('Dados atualizados', data.name);
      closeModal();
      return;
    }
    if (!requireFeature(access.canAddClient(), 'unlimitedClients')) return;
    setSaving(true); // trava o botão no primeiro toque (evita cadastro duplicado)
    const created = await addClient(data);
    if (!created) {
      setSaving(false);
      return;
    }
    notify('Cliente cadastrada', created.name);
    router.replace({ pathname: '/clientes/[id]', params: { id: created.id } });
  }

  return (
    <HeaderKeyboardView>
      {editing ? <Stack.Screen options={{ title: 'Editar cliente' }} /> : null}
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Field label="Nome completo" value={name} onChangeText={setName} placeholder="Ex: Maria Silva" autoFocus />
        <Field
          label={phoneOk ? 'WhatsApp' : 'WhatsApp — confira o número (DDD + número)'}
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
        {homeService ? (
          <AddressFields
            address={address}
            neighborhood={neighborhood}
            onChangeAddress={setAddress}
            onChangeNeighborhood={setNeighborhood}
            areas={serviceAreas}
            optional
          />
        ) : null}
        <Text className="mb-1.5 text-[13px] font-medium text-muted">Anotações técnicas (opcional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Ex: alergia a cola, formato de unha preferido, nº da henna…"
          placeholderTextColor={colors.muted}
          multiline
          accessibilityLabel="Anotações técnicas (opcional)"
          className="min-h-[90px] rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink"
          style={{ textAlignVertical: 'top' }}
        />
      </ScrollView>
      <View
        className="border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Button title={saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar cliente'} loading={saving} onPress={save} />
      </View>
    </HeaderKeyboardView>
  );
}
