import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, SectionLabel } from '@/components/ui';
import { useStore } from '@/data/store';
import { notify } from '@/lib/confirm';
import { initials, maskDocument, maskPhone, maskZip, onlyDigits } from '@/lib/format';
import { colors } from '@/theme/colors';

export default function DadosEstudio() {
  const { profile, updateProfile, uploadLogo } = useStore();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState(() => ({
    businessName: profile.businessName,
    ownerName: profile.ownerName,
    tradeName: profile.tradeName ?? '',
    document: maskDocument(profile.document ?? ''),
    phone: maskPhone(profile.phone ?? ''),
    email: profile.email ?? '',
    instagram: profile.instagram ? `@${profile.instagram}` : '',
    addressZip: maskZip(profile.addressZip ?? ''),
    addressStreet: profile.addressStreet ?? '',
    addressNumber: profile.addressNumber ?? '',
    addressDistrict: profile.addressDistrict ?? '',
    addressCity: profile.addressCity ?? '',
    addressState: profile.addressState ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lookingUpZip, setLookingUpZip] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function onZipChange(text: string) {
    const zip = maskZip(text);
    set({ addressZip: zip });
    const digits = onlyDigits(zip);
    if (digits.length !== 8) return;
    // Preenche rua, bairro e cidade pelo CEP (ViaCEP, serviço público dos Correios)
    setLookingUpZip(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          addressStreet: data.logradouro || f.addressStreet,
          addressDistrict: data.bairro || f.addressDistrict,
          addressCity: data.localidade || f.addressCity,
          addressState: data.uf || f.addressState,
        }));
      }
    } catch {
      // sem internet: a pessoa preenche à mão
    } finally {
      setLookingUpZip(false);
    }
  }

  async function pickLogo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.base64) return;
    setUploading(true);
    await uploadLogo(asset.base64, asset.mimeType ?? 'image/jpeg');
    setUploading(false);
  }

  const docDigits = onlyDigits(form.document);
  const docValid = !docDigits || docDigits.length === 11 || docDigits.length === 14;
  const emailValid = !form.email || /^\S+@\S+\.\S+$/.test(form.email.trim());
  const canSave = !!form.businessName.trim() && docValid && emailValid && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const ok = await updateProfile({
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim(),
      tradeName: form.tradeName.trim(),
      document: docDigits,
      phone: onlyDigits(form.phone),
      email: form.email.trim(),
      instagram: form.instagram.trim().replace(/^@+/, '').replace(/\s/g, ''),
      addressZip: onlyDigits(form.addressZip),
      addressStreet: form.addressStreet.trim(),
      addressNumber: form.addressNumber.trim(),
      addressDistrict: form.addressDistrict.trim(),
      addressCity: form.addressCity.trim(),
      addressState: form.addressState.trim().toUpperCase(),
    });
    setSaving(false);
    if (ok) notify('Dados salvos', 'Recibos e mensagens já usam as novas informações.');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View className="items-center">
          <Pressable onPress={pickLogo} disabled={uploading} className="active:opacity-70">
            <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-line bg-primary-soft">
              {profile.logoUrl ? (
                <Image source={{ uri: profile.logoUrl }} style={{ width: 96, height: 96 }} contentFit="cover" />
              ) : (
                <Text className="text-2xl font-semibold text-primary-dark">{initials(form.businessName || 'E')}</Text>
              )}
              {uploading ? (
                <View className="absolute inset-0 items-center justify-center bg-white/70">
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : null}
            </View>
            <View className="absolute -bottom-1 -right-1 h-8 w-8 items-center justify-center rounded-full border-2 border-bg bg-primary">
              <Ionicons name="camera-outline" size={15} color="#fff" />
            </View>
          </Pressable>
          <Text className="mt-2 text-[13px] text-muted">
            {profile.logoUrl ? 'Toque para trocar o logo' : 'Adicionar foto ou logo'}
          </Text>
        </View>

        <SectionLabel>Identidade</SectionLabel>
        <Field
          label="Nome do estúdio ou profissional"
          value={form.businessName}
          onChangeText={(businessName) => set({ businessName })}
          placeholder="Ex: Studio Ana Lima"
        />
        <Field
          label="Seu nome"
          value={form.ownerName}
          onChangeText={(ownerName) => set({ ownerName })}
          placeholder="Ex: Ana Lima"
        />
        <Field
          label="Nome fantasia / Razão social (opcional)"
          value={form.tradeName}
          onChangeText={(tradeName) => set({ tradeName })}
          placeholder="Ex: Ana Lima Beleza LTDA"
        />
        <Field
          label={docValid ? 'CPF ou CNPJ' : 'CPF ou CNPJ — confira os números'}
          value={form.document}
          onChangeText={(t) => set({ document: maskDocument(t) })}
          placeholder="000.000.000-00"
          keyboardType="number-pad"
        />

        <SectionLabel>Contato</SectionLabel>
        <Field
          label="WhatsApp comercial"
          value={form.phone}
          onChangeText={(t) => set({ phone: maskPhone(t) })}
          placeholder="(11) 90000-0000"
          keyboardType="phone-pad"
        />
        <Field
          label={emailValid ? 'E-mail de contato' : 'E-mail — confira o endereço'}
          value={form.email}
          onChangeText={(email) => set({ email })}
          placeholder="contato@seuestudio.com.br"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Instagram"
          value={form.instagram}
          onChangeText={(t) => set({ instagram: t && !t.startsWith('@') ? `@${t}` : t })}
          placeholder="@seuestudio"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <SectionLabel>Endereço</SectionLabel>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label={lookingUpZip ? 'CEP — buscando…' : 'CEP'}
              value={form.addressZip}
              onChangeText={onZipChange}
              placeholder="00000-000"
              keyboardType="number-pad"
            />
          </View>
          <View className="w-24">
            <Field
              label="Número"
              value={form.addressNumber}
              onChangeText={(addressNumber) => set({ addressNumber })}
              placeholder="123"
            />
          </View>
        </View>
        <Field
          label="Rua"
          value={form.addressStreet}
          onChangeText={(addressStreet) => set({ addressStreet })}
          placeholder="Rua, avenida…"
        />
        <Field
          label="Bairro"
          value={form.addressDistrict}
          onChangeText={(addressDistrict) => set({ addressDistrict })}
          placeholder="Bairro"
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label="Cidade"
              value={form.addressCity}
              onChangeText={(addressCity) => set({ addressCity })}
              placeholder="Cidade"
            />
          </View>
          <View className="w-20">
            <Field
              label="UF"
              value={form.addressState}
              onChangeText={(t) => set({ addressState: t.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() })}
              placeholder="SP"
              autoCapitalize="characters"
            />
          </View>
        </View>
        <Text className="text-[12px] leading-4 text-muted">
          Esses dados aparecem no cabeçalho dos recibos por e-mail e nas variáveis {'{estudio}'} e {'{endereco}'}{' '}
          das mensagens.
        </Text>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Button title={saving ? 'Salvando…' : 'Salvar dados'} onPress={save} disabled={!canSave} />
      </View>
    </KeyboardAvoidingView>
  );
}
