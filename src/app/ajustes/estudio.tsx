import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderKeyboardView } from '@/components/keyboard-view';
import { DeleteAccountSheet } from '@/components/delete-account-sheet';
import { ServiceModePicker } from '@/components/service-mode-picker';
import { Button, Field, SectionLabel, Toggle } from '@/components/ui';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { openUpgrade } from '@/lib/upgrade';
import { bookingUrl, isValidSlug, sanitizeSlugInput, slugify } from '@/lib/booking';
import { notify } from '@/lib/confirm';
import { initials, maskDocument, maskPhone, maskZip, onlyDigits } from '@/lib/format';
import { colors } from '@/theme/colors';

export default function DadosEstudio() {
  const { profile, updateProfile, uploadLogo, serviceAreas } = useStore();
  const access = usePlanAccess();
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
    slug: profile.slug ?? '',
    bookingAutoApprove: profile.bookingAutoApprove,
    serviceMode: profile.serviceMode,
  }));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  const slugOk = !form.slug || isValidSlug(form.slug);
  const canSave = !!form.businessName.trim() && docValid && emailValid && slugOk && !saving;

  // Só mostra o link depois de salvo (é o que a cliente vai acessar)
  const savedLink = profile.slug ? bookingUrl(profile.slug) : null;

  async function copyLink() {
    if (!savedLink) return;
    await Clipboard.setStringAsync(savedLink);
    notify('Link copiado', 'Cole na bio do Instagram ou no WhatsApp.');
  }

  function shareLink() {
    if (!savedLink) return;
    const text = `Agende seu horário no ${profile.businessName} pelo link: ${savedLink}`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }

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
      slug: form.slug.trim(),
      bookingAutoApprove: form.bookingAutoApprove,
      serviceMode: form.serviceMode,
    });
    setSaving(false);
    if (ok) notify('Dados salvos', 'Recibos e mensagens já usam as novas informações.');
  }

  return (
    <HeaderKeyboardView>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View className="items-center">
          <Pressable accessibilityRole="button" accessibilityLabel="Escolher logo do estúdio" onPress={pickLogo} disabled={uploading} className="active:opacity-70">
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
              <Ionicons name="camera-outline" size={15} color={colors.onPrimary} />
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

        <SectionLabel>Modelo de atendimento</SectionLabel>
        <ServiceModePicker value={form.serviceMode} onChange={(serviceMode) => set({ serviceMode })} />
        {form.serviceMode !== 'fixed' ? (
          <Pressable accessibilityRole="button"
            onPress={() => router.push('/ajustes/regioes')}
            className="mt-2 flex-row items-center rounded-2xl border border-line bg-surface px-4 py-3 active:opacity-70">
            <Ionicons name="map-outline" size={18} color={colors.primaryDark} />
            <View className="ml-3 flex-1">
              <Text className="text-[15px] text-ink">Regiões e taxas de deslocamento</Text>
              <Text className="text-[12px] text-muted">
                {serviceAreas.length
                  ? `${serviceAreas.length} ${serviceAreas.length === 1 ? 'bairro' : 'bairros'} · deslocamento de ${profile.travelBufferMinutes} min`
                  : 'Cadastre os bairros que você atende'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        ) : null}

        <SectionLabel>{form.serviceMode === 'home_service' ? 'Endereço (base)' : 'Endereço'}</SectionLabel>
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
          Esses dados aparecem no cabeçalho dos recibos e nas variáveis {'{estudio}'} e {'{endereco}'}{' '}
          das mensagens. Em atendimento a domicílio, {'{endereco}'} usa o endereço da cliente.
        </Text>

        {/* Agendamento online */}
        <SectionLabel>Agendamento online</SectionLabel>
        {!access.hasPublicLink ? (
          <Pressable accessibilityRole="button"
            onPress={() => openUpgrade('publicLink')}
            className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-3 active:opacity-70">
            <Ionicons name="link-outline" size={18} color={colors.muted} />
            <View className="ml-3 flex-1">
              <Text className="text-[15px] text-ink">Link de agendamento online</Text>
              <Text className="text-[12px] leading-4 text-muted">
                Suas clientes marcam sozinhas pelo link. Disponível a partir do plano Intermediário.
              </Text>
            </View>
            <Ionicons name="lock-closed" size={15} color={colors.primaryDark} />
          </Pressable>
        ) : (
        <>
        <Text className="mb-1.5 text-[13px] font-medium text-muted">Link personalizado</Text>
        <View className="mb-1 flex-row items-center rounded-2xl border border-line bg-surface pl-4">
          <Text className="text-[15px] text-muted">/agendar/</Text>
          <TextInput
            value={form.slug}
            onChangeText={(t) => set({ slug: sanitizeSlugInput(t) })}
            placeholder={slugify(form.businessName) || 'seu-estudio'}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 py-3 pr-4 text-[15px] text-ink"
          />
        </View>
        <Text className={`mb-3 text-[12px] ${slugOk ? 'text-muted' : 'text-[#B2474F]'}`}>
          {slugOk
            ? 'Use letras minúsculas, números e hífen. Ex: studio-ana-lima'
            : 'De 3 a 40 caracteres: letras minúsculas, números e hífen (sem começar ou terminar com hífen).'}
        </Text>

        {savedLink ? (
          <View className="mb-3 rounded-2xl bg-primary-soft p-3">
            <Text selectable className="text-[13px] font-medium text-primary-dark">
              {savedLink}
            </Text>
            <View className="mt-2 flex-row gap-2">
              <View className="flex-1">
                <Button title="Copiar link" icon="copy-outline" variant="secondary" onPress={copyLink} />
              </View>
              <View className="flex-1">
                <Button title="WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={shareLink} />
              </View>
            </View>
          </View>
        ) : profile.slug ? (
          <Text className="mb-3 text-[12px] leading-4 text-muted">
            Publique a versão web do app e informe o endereço em EXPO_PUBLIC_BOOKING_URL para gerar o link completo.
          </Text>
        ) : null}

        <View className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-3">
          <View className="flex-1 pr-3">
            <Text className="text-[15px] text-ink">Aprovação automática</Text>
            <Text className="text-[12px] leading-4 text-muted">
              {form.bookingAutoApprove
                ? 'Agendamentos online entram na agenda já confirmados.'
                : 'Agendamentos online entram como pendentes até você confirmar.'}
            </Text>
          </View>
          <Toggle value={form.bookingAutoApprove} onChange={(v) => set({ bookingAutoApprove: v })} />
        </View>
        </>
        )}

        {/* Zona de perigo: exclusão permanente (exigência das lojas) */}
        <View className="mt-10 border-t border-line pt-5">
          <Text className="text-xs font-semibold uppercase tracking-wider text-[#B2474F]">Zona de perigo</Text>
          <Text className="mb-3 mt-1 text-[12px] leading-4 text-muted">
            Excluir a conta apaga para sempre todos os dados do estúdio.
          </Text>
          <Pressable accessibilityRole="button"
            onPress={() => setDeleting(true)}
            className="flex-row items-center self-start rounded-2xl border border-[#E5C4C7] px-4 py-2.5 active:opacity-60">
            <Ionicons name="trash-outline" size={16} color="#B2474F" />
            <Text className="ml-2 text-[14px] font-medium text-[#B2474F]">Excluir minha conta</Text>
          </Pressable>
        </View>
      </ScrollView>
      <DeleteAccountSheet visible={deleting} onClose={() => setDeleting(false)} />

      <View
        className="border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Button title={saving ? 'Salvando…' : 'Salvar dados'} onPress={save} disabled={!canSave} />
      </View>
    </HeaderKeyboardView>
  );
}
