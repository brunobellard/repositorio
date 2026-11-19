import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderKeyboardView } from '@/components/keyboard-view';
import { showToast } from '@/components/toast';
import { Button, SectionLabel } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { initials } from '@/lib/format';
import { openUpgrade } from '@/lib/upgrade';
import { colors } from '@/theme/colors';
import {
  DEFAULT_THEME_COLOR,
  deriveTheme,
  isPresetColor,
  isTooLight,
  normalizeHex,
  THEME_PRESETS,
  type ThemeColors,
} from '@/theme/palette';

/** Mini-card com botão, badge e cabeçalho do link público, pintados com a cor em teste. */
function Preview({ t, studio }: { t: ThemeColors; studio: string }) {
  return (
    <View className="overflow-hidden rounded-card border border-line bg-surface">
      {/* Cabeçalho do link público */}
      <View className="items-center border-b border-line px-4 py-4" style={{ backgroundColor: t.primarySoft }}>
        <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: t.primary }}>
          <Text className="text-[16px] font-bold" style={{ color: t.onPrimary }}>
            {initials(studio || 'Estúdio')}
          </Text>
        </View>
        <Text className="mt-2 text-[15px] font-bold text-ink">{studio || 'Seu estúdio'}</Text>
        <Text className="text-[12px] font-medium" style={{ color: t.primaryDark }}>
          Link de agendamento
        </Text>
      </View>
      <View className="p-4">
        <View className="mb-3 flex-row items-center">
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: t.primarySoft }}>
            <Text className="text-[12px] font-semibold" style={{ color: t.primaryDark }}>
              Selecionado
            </Text>
          </View>
          <View className="ml-2 h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: t.primary }}>
            <Text className="text-[13px] font-bold" style={{ color: t.onPrimary }}>
              15
            </Text>
          </View>
          <Text className="ml-2 flex-1 text-[12px] text-muted">dia escolhido</Text>
        </View>
        <View
          className="flex-row items-center justify-center rounded-2xl py-3"
          style={{ backgroundColor: t.primary }}>
          <Ionicons name="add" size={18} color={t.onPrimary} />
          <Text className="ml-1.5 text-[15px] font-semibold" style={{ color: t.onPrimary }}>
            Novo agendamento
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Ajustes › Aparência e cores */
export default function Aparencia() {
  const { profile, updateProfile } = useStore();
  const { primaryColor } = useTheme();
  const access = usePlanAccess();
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState(primaryColor);
  const [hexInput, setHexInput] = useState(isPresetColor(primaryColor) ? '' : primaryColor.slice(1));
  const [saving, setSaving] = useState(false);

  const customHex = normalizeHex(hexInput);
  const customError = !hexInput
    ? null
    : !customHex
      ? 'Use 6 dígitos de 0-9 e A-F. Ex: 9D5C63'
      : isTooLight(customHex)
        ? 'Cor muito clara: botões e textos sumiriam no fundo branco. Escolha um tom mais forte.'
        : null;
  const theme = deriveTheme(selected);
  const changed = selected !== primaryColor;

  function pickPreset(hex: string) {
    if (hex !== DEFAULT_THEME_COLOR && !access.hasThemes) return openUpgrade('themes');
    setSelected(hex);
  }

  function onHexChange(t: string) {
    const v = t.replace(/[^0-9a-f]/gi, '').slice(0, 6).toUpperCase();
    setHexInput(v);
    const hex = normalizeHex(v);
    if (hex && !isTooLight(hex)) setSelected(hex);
  }

  async function save() {
    if (!changed || saving) return;
    setSaving(true);
    const ok = await updateProfile({ themeColor: selected });
    setSaving(false);
    // O app redesenha com a nova cor (ThemeProvider)
    if (ok)
      showToast(
        'Cor aplicada',
        access.hasPublicLink ? 'O app e o seu link de agendamento já usam a nova cor.' : 'O app já usa a nova cor.',
      );
  }

  return (
    <HeaderKeyboardView>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <SectionLabel>Prévia</SectionLabel>
        <Preview t={theme} studio={profile.businessName} />

        <SectionLabel>Paletas</SectionLabel>
        {/* Uma paleta por linha: círculo, nome e código bem separados */}
        <View className="overflow-hidden rounded-card border border-line bg-surface">
          {THEME_PRESETS.map((p, i) => {
            const on = selected === p.hex;
            const locked = p.hex !== DEFAULT_THEME_COLOR && !access.hasThemes;
            return (
              <Pressable
                key={p.hex}
                onPress={() => pickPreset(p.hex)}
                className={`flex-row items-center px-4 py-3 active:bg-bg ${i ? 'border-t border-line' : ''}`}
                style={on ? { backgroundColor: deriveTheme(p.hex).primarySoft } : undefined}>
                <View
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: p.hex }}>
                  {locked ? <Ionicons name="lock-closed" size={14} color="#FFFFFF" /> : null}
                </View>
                <View className="ml-3.5 flex-1">
                  <Text className={`text-[15px] ${on ? 'font-semibold text-ink' : 'text-ink'}`}>{p.name}</Text>
                  <Text className="text-[12px] text-muted">{p.hex}</Text>
                </View>
                {on ? (
                  <Ionicons name="checkmark-circle" size={22} color={p.hex} />
                ) : (
                  <Ionicons name="ellipse-outline" size={22} color={colors.line} />
                )}
              </Pressable>
            );
          })}
        </View>
        <View className="h-2" />
        {!access.hasThemes ? (
          <Pressable onPress={() => openUpgrade('themes')} className="mb-2 flex-row items-center active:opacity-70">
            <Ionicons name="lock-closed" size={13} color={colors.primaryDark} />
            <Text className="ml-1.5 text-[12px] text-primary-dark">
              As 6 paletas estão disponíveis a partir do plano Básico.
            </Text>
          </Pressable>
        ) : null}

        <SectionLabel>Cor personalizada</SectionLabel>
        {access.hasCustomTheme ? (
          <>
            <View className="flex-row items-center rounded-2xl border border-line bg-surface pl-4">
              <View
                className="h-6 w-6 rounded-full border border-line"
                style={{ backgroundColor: customHex && !customError ? customHex : colors.bg }}
              />
              <Text className="ml-3 text-[16px] text-muted">#</Text>
              <TextInput
                value={hexInput}
                onChangeText={onHexChange}
                placeholder="9D5C63"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
                className="flex-1 py-3 pr-4 text-[16px] font-medium tracking-widest text-ink"
              />
            </View>
            <Text className={`mt-1.5 text-[12px] leading-4 ${customError ? 'text-[#B2474F]' : 'text-muted'}`}>
              {customError ??
                (customHex
                  ? `Contraste conferido: o texto sobre esta cor fica ${
                      deriveTheme(customHex).onPrimary === '#FFFFFF' ? 'branco' : 'escuro'
                    }.`
                  : 'Digite o código HEX da cor da sua marca (ex: do seu logo).')}
            </Text>
          </>
        ) : (
          <Pressable
            onPress={() => openUpgrade('customTheme')}
            className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-3 active:opacity-70">
            <Ionicons name="color-palette-outline" size={18} color={colors.muted} />
            <View className="ml-3 flex-1">
              <Text className="text-[15px] text-ink">Usar a cor da minha marca</Text>
              <Text className="text-[12px] text-muted">Código HEX livre, a partir do plano Intermediário</Text>
            </View>
            <Ionicons name="lock-closed" size={15} color={colors.primaryDark} />
          </Pressable>
        )}

        <Text className="mt-5 text-[12px] leading-4 text-muted">
          {access.hasPublicLink
            ? 'A cor vale para o app e para o seu link de agendamento online.'
            : 'A cor vale para o app (e para o link de agendamento online, a partir do plano Intermediário).'}{' '}
          Os tons mais claro e mais escuro são calculados automaticamente.
        </Text>
      </ScrollView>

      <View
        className="border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Pressable
          onPress={save}
          disabled={!changed || saving}
          className="flex-row items-center justify-center rounded-2xl py-3.5 active:opacity-80"
          style={{ backgroundColor: theme.primary, opacity: !changed || saving ? 0.45 : 1 }}>
          <Text className="text-[15px] font-semibold" style={{ color: theme.onPrimary }}>
            {saving ? 'Aplicando…' : changed ? 'Aplicar esta cor' : 'Cor atual'}
          </Text>
        </Pressable>
        {changed ? (
          <View className="mt-1">
            <Button title="Voltar à cor atual" variant="secondary" onPress={() => setSelected(primaryColor)} />
          </View>
        ) : null}
      </View>
    </HeaderKeyboardView>
  );
}
