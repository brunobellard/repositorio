import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Field, Toggle } from '@/components/ui';
import { SPECIALTIES } from '@/constants/specialties';
import { useStore } from '@/data/store';
import { bookingUrl, isValidSlug, sanitizeSlugInput, slugify } from '@/lib/booking';
import { formatDuration } from '@/lib/dates';
import { formatBRL } from '@/lib/format';
import { colors } from '@/theme/colors';
import type { BusinessHours } from '@/types';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const OPEN_TIMES = ['07:00', '08:00', '09:00', '10:00'];
const CLOSE_TIMES = ['17:00', '18:00', '19:00', '20:00', '21:00'];
const STEPS = ['Seu estúdio', 'Especialidade', 'Horários'];

const hourLabel = (t: string) => `${Number(t.slice(0, 2))}h`;

/**
 * Primeiro acesso de uma conta nova (profiles.onboarding_completed = false):
 * 1. nome do estúdio e link público · 2. especialidade (pré-cadastra 4 serviços) · 3. horário de trabalho.
 */
export default function Onboarding() {
  const { profile, services, updateProfile, saveService, saveBusinessHours } = useStore();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Passo 1
  const initialName = profile.businessName === 'Meu estúdio' ? '' : profile.businessName;
  const [businessName, setBusinessName] = useState(initialName);
  const [slug, setSlug] = useState(profile.slug ?? slugify(initialName));
  const [slugTouched, setSlugTouched] = useState(!!profile.slug);
  // Passo 2
  const [specialtyId, setSpecialtyId] = useState<string | null>(null);
  // Passo 3
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [lunch, setLunch] = useState(true);

  const specialty = SPECIALTIES.find((s) => s.id === specialtyId);
  const link = isValidSlug(slug) ? bookingUrl(slug) : null;

  const canNext =
    !busy &&
    (step === 0
      ? !!businessName.trim() && isValidSlug(slug)
      : step === 1
        ? !!specialty
        : days.length > 0 && openTime < closeTime);

  async function next() {
    if (!canNext) return;
    setBusy(true);
    try {
      if (step === 0) {
        // Grava já: se o link estiver em uso por outro estúdio, o aviso aparece aqui
        const ok = await updateProfile({ businessName: businessName.trim(), slug });
        if (ok) setStep(1);
      } else if (step === 1) {
        // Só pré-cadastra se a conta ainda não tem serviços (evita duplicar ao voltar)
        if (specialty && services.length === 0) {
          for (const s of specialty.services) {
            const ok = await saveService({ ...s, active: true });
            if (!ok) return;
          }
        }
        setStep(2);
      } else {
        const lunchOk = lunch && openTime < '12:00' && closeTime > '13:00';
        const hours: BusinessHours[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
          dayOfWeek: d,
          isOpen: days.includes(d),
          openTime,
          closeTime,
          breakStart: lunchOk ? '12:00' : undefined,
          breakEnd: lunchOk ? '13:00' : undefined,
        }));
        const ok = await saveBusinessHours(hours);
        // Ao concluir, o app troca sozinho para a agenda
        if (ok) await updateProfile({ onboardingCompleted: true });
      }
    } finally {
      setBusy(false);
    }
  }

  function skipSpecialty() {
    setSpecialtyId(null);
    setStep(2);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled">
        {/* Progresso */}
        <View className="mb-6 flex-row items-center">
          {step > 0 ? (
            <Pressable onPress={() => setStep(step - 1)} disabled={busy} className="mr-3 py-1 active:opacity-60">
              <Ionicons name="chevron-back" size={22} color={colors.ink} />
            </Pressable>
          ) : null}
          <View className="flex-1 flex-row gap-1.5">
            {STEPS.map((s, i) => (
              <View key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-line'}`} />
            ))}
          </View>
          <Text className="ml-3 text-[12px] font-medium text-muted">
            {step + 1} de {STEPS.length}
          </Text>
        </View>

        {step === 0 ? (
          <>
            <Text className="text-[24px] font-bold tracking-tight text-ink">Boas-vindas! 💅</Text>
            <Text className="mb-6 mt-1 text-[14px] leading-5 text-muted">
              Em 3 passos rápidos seu estúdio fica pronto para receber agendamentos.
            </Text>
            <Field
              label="Nome do estúdio"
              value={businessName}
              onChangeText={(t) => {
                setBusinessName(t);
                if (!slugTouched) setSlug(slugify(t).slice(0, 40));
              }}
              placeholder="Ex: Studio Ana Lima"
              autoFocus={!initialName}
            />
            <Text className="mb-1.5 text-[13px] font-medium text-muted">Link do agendamento online</Text>
            <View className="mb-1 flex-row items-center rounded-2xl border border-line bg-surface pl-4">
              <Text className="text-[15px] text-muted">/agendar/</Text>
              <TextInput
                value={slug}
                onChangeText={(t) => {
                  setSlugTouched(true);
                  setSlug(sanitizeSlugInput(t));
                }}
                placeholder="seu-estudio"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 py-3 pr-4 text-[15px] text-ink"
              />
            </View>
            <Text className={`text-[12px] leading-4 ${!slug || isValidSlug(slug) ? 'text-muted' : 'text-[#B2474F]'}`}>
              {!slug || isValidSlug(slug)
                ? link
                  ? `Suas clientes vão marcar horário em ${link}`
                  : 'Use letras minúsculas, números e hífen.'
                : 'De 3 a 40 caracteres: letras minúsculas, números e hífen.'}
            </Text>
          </>
        ) : step === 1 ? (
          <>
            <Text className="text-[24px] font-bold tracking-tight text-ink">Qual é a sua especialidade?</Text>
            <Text className="mb-5 mt-1 text-[14px] leading-5 text-muted">
              Já deixamos 4 serviços cadastrados com preço e duração. Você ajusta tudo depois em Ajustes.
            </Text>
            {SPECIALTIES.map((s) => {
              const selected = s.id === specialtyId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSpecialtyId(s.id)}
                  className={`mb-2.5 rounded-card border px-4 py-3.5 active:opacity-80 ${
                    selected ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
                  }`}>
                  <View className="flex-row items-center">
                    <Ionicons name={s.icon} size={20} color={selected ? colors.primaryDark : colors.muted} />
                    <Text className="ml-3 flex-1 text-[15px] font-semibold text-ink">{s.label}</Text>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={selected ? colors.primary : colors.line}
                    />
                  </View>
                  {selected ? (
                    <View className="mt-2.5 border-t border-line pt-2">
                      {s.services.map((sv) => (
                        <View key={sv.name} className="flex-row justify-between py-1">
                          <Text className="flex-1 text-[13px] text-ink">{sv.name}</Text>
                          <Text className="text-[13px] text-muted">
                            {formatDuration(sv.durationMin)} · {formatBRL(sv.price)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
            {services.length > 0 ? (
              <Text className="mt-1 text-[12px] leading-4 text-muted">
                Você já tem serviços cadastrados, então nenhum serviço novo será criado.
              </Text>
            ) : null}
            <Pressable onPress={skipSpecialty} disabled={busy} className="mt-2 items-center py-2 active:opacity-60">
              <Text className="text-[14px] text-muted">Prefiro cadastrar meus serviços depois</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text className="text-[24px] font-bold tracking-tight text-ink">Quando você atende?</Text>
            <Text className="mb-5 mt-1 text-[14px] leading-5 text-muted">
              Esse é o horário padrão da agenda e do link online. Dá para mudar cada dia depois.
            </Text>

            <Text className="mb-2 text-[13px] font-medium text-muted">Dias de trabalho</Text>
            <View className="mb-4 flex-row gap-1.5">
              {WEEKDAYS.map((label, d) => {
                const on = days.includes(d);
                return (
                  <Pressable
                    key={label}
                    onPress={() => setDays(on ? days.filter((x) => x !== d) : [...days, d].sort())}
                    className={`flex-1 items-center rounded-xl border py-2.5 ${
                      on ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
                    }`}>
                    <Text className={`text-[13px] font-semibold ${on ? 'text-primary-dark' : 'text-muted'}`}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="mb-2 text-[13px] font-medium text-muted">Começa às</Text>
            <View className="flex-row flex-wrap">
              {OPEN_TIMES.map((t) => (
                <Chip key={t} label={hourLabel(t)} selected={openTime === t} onPress={() => setOpenTime(t)} />
              ))}
            </View>
            <Text className="mb-2 mt-2 text-[13px] font-medium text-muted">Termina às</Text>
            <View className="flex-row flex-wrap">
              {CLOSE_TIMES.map((t) => (
                <Chip key={t} label={hourLabel(t)} selected={closeTime === t} onPress={() => setCloseTime(t)} />
              ))}
            </View>

            <View className="mt-3 flex-row items-center rounded-2xl border border-line bg-surface px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="text-[15px] text-ink">Pausa para almoço</Text>
                <Text className="text-[12px] text-muted">Das 12h às 13h, sem agendamentos</Text>
              </View>
              <Toggle value={lunch} onChange={setLunch} />
            </View>
          </>
        )}
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Button
          title={busy ? 'Salvando…' : step === STEPS.length - 1 ? 'Concluir e abrir a agenda' : 'Continuar'}
          icon={step === STEPS.length - 1 ? 'checkmark' : 'arrow-forward'}
          loading={busy}
          onPress={next}
          disabled={!canNext}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
