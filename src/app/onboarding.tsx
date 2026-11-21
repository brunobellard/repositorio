import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardView } from '@/components/keyboard-view';
import { ServiceModePicker } from '@/components/service-mode-picker';
import { ShareLinkButton } from '@/components/share-link-button';
import { TermsStep } from '@/components/terms-step';
import { Button, Chip, Field, Toggle } from '@/components/ui';
import { effectivePlan, PLANS } from '@/constants/plans';
import { SPECIALTIES } from '@/constants/specialties';
import { notify } from '@/lib/confirm';
import { track } from '@/lib/analytics';
import { useAuth } from '@/data/auth';
import { useStore } from '@/data/store';
import { bookingUrl, isValidSlug, sanitizeSlugInput, slugify } from '@/lib/booking';
import { formatDuration } from '@/lib/dates';
import { formatBRL, maskBRL, onlyDigits } from '@/lib/format';
import { colors } from '@/theme/colors';
import type { BusinessHours } from '@/types';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const OPEN_TIMES = ['07:00', '08:00', '09:00', '10:00'];
const CLOSE_TIMES = ['17:00', '18:00', '19:00', '20:00', '21:00'];
const STEPS = ['Seu estúdio', 'Especialidade', 'Horários'];

const hourLabel = (t: string) => `${Number(t.slice(0, 2))}h`;

/** Serviço digitado na opção "Outra especialidade". */
interface CustomService {
  name: string;
  price: number;
  durationMin: number;
}
const EMPTY_SERVICE: CustomService = { name: '', price: 0, durationMin: 60 };
const MAX_CUSTOM_SERVICES = 6;
const isCustomValid = (c: CustomService) => !!c.name.trim() && c.price > 0 && c.durationMin > 0;

/**
 * Primeiro acesso de uma conta nova (profiles.onboarding_completed = false).
 * Antes de tudo, o aceite dos Termos de Uso e da Política de Privacidade (o único lugar do app onde ele aparece).
 * Depois: 1. nome do estúdio e link público · 2. especialidade (pré-cadastra 4 serviços) · 3. horário de trabalho.
 */
export default function Onboarding() {
  const { termsAccepted } = useAuth();
  if (!termsAccepted) return <TermsStep />;
  return <OnboardingSteps />;
}

function OnboardingSteps() {
  const { profile, services, updateProfile, saveService, saveBusinessHours } = useStore();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Passo 1
  const initialName = profile.businessName === 'Meu estúdio' ? '' : profile.businessName;
  const [businessName, setBusinessName] = useState(initialName);
  const [slug, setSlug] = useState(profile.slug ?? slugify(initialName));
  const [slugTouched, setSlugTouched] = useState(!!profile.slug);
  const [serviceMode, setServiceMode] = useState(profile.serviceMode);
  // Passo 2
  const [specialtyId, setSpecialtyId] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customServices, setCustomServices] = useState<CustomService[]>([EMPTY_SERVICE]);
  // Passo 3
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [lunch, setLunch] = useState(true);

  const specialty = SPECIALTIES.find((s) => s.id === specialtyId);
  // Limite de serviços ativos do plano (3 no Free; null = sem limite)
  const serviceLimit = PLANS[effectivePlan(profile)].limits.activeServices;
  const isOther = specialtyId === 'other';
  const validCustom = customServices.filter(isCustomValid);
  const otherReady = isOther && !!customName.trim() && validCustom.length > 0;
  const link = isValidSlug(slug) ? bookingUrl(slug) : null;

  const canNext =
    !busy &&
    (step === 0
      ? !!businessName.trim() && isValidSlug(slug)
      : step === 1
        ? !!specialty || otherReady
        : days.length > 0 && openTime < closeTime);

  async function next() {
    if (!canNext) return;
    setBusy(true);
    try {
      if (step === 0) {
        // Grava já: se o link estiver em uso por outro estúdio, o aviso aparece aqui
        const ok = await updateProfile({ businessName: businessName.trim(), slug, serviceMode });
        if (ok) {
          track('onboarding_step_completed', { step: 1, service_mode: serviceMode });
          setStep(1);
        }
      } else if (step === 1) {
        // Só pré-cadastra se a conta ainda não tem serviços (evita duplicar ao voltar)
        const toCreate = specialty
          ? specialty.services
          : otherReady
            ? validCustom.map((c) => ({ ...c, name: c.name.trim(), category: customName.trim() }))
            : [];
        if (toCreate.length && services.length === 0) {
          // No Free cabem só alguns serviços ativos: cria os que cabem e avisa (antes travava no 4º; BUG-012)
          const fits = serviceLimit === null ? toCreate : toCreate.slice(0, serviceLimit);
          for (const s of fits) {
            const ok = await saveService({ ...s, active: true });
            if (!ok) return;
          }
          if (fits.length < toCreate.length) {
            notify(
              `${fits.length} serviços cadastrados`,
              `O plano ${PLANS[effectivePlan(profile)].name} permite ${serviceLimit} serviços ativos. Você pode trocar ou ajustar em Ajustes > Serviços e preços.`,
              'info',
            );
          }
        }
        track('onboarding_step_completed', {
          step: 2,
          specialty: specialtyId ?? 'skipped',
          service_count: toCreate.length,
        });
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
        if (ok && (await updateProfile({ onboardingCompleted: true }))) {
          track('onboarding_step_completed', { step: 3, working_days: days.length, lunch_break: lunchOk });
          track('onboarding_completed', { service_mode: serviceMode, working_days: days.length });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  function updateCustom(i: number, patch: Partial<CustomService>) {
    setCustomServices(customServices.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  function skipSpecialty() {
    setSpecialtyId(null);
    setStep(2);
  }

  return (
    <KeyboardView>
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled">
        {/* Progresso */}
        <View className="mb-6 flex-row items-center">
          {step > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => setStep(step - 1)} disabled={busy} className="mr-3 py-1 active:opacity-60">
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
              label={initialName ? 'Confirme o nome do estúdio' : 'Nome do estúdio'}
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

            <Text className="mb-2 mt-5 text-[13px] font-medium text-muted">Como você atende?</Text>
            <ServiceModePicker value={serviceMode} onChange={setServiceMode} />
            {serviceMode !== 'fixed' ? (
              <Text className="mt-2 text-[12px] leading-4 text-muted">
                Depois você cadastra os bairros atendidos e as taxas em Ajustes › Regiões e deslocamento.
              </Text>
            ) : null}
          </>
        ) : step === 1 ? (
          <>
            <Text className="text-[24px] font-bold tracking-tight text-ink">Qual é a sua especialidade?</Text>
            <Text className="mb-5 mt-1 text-[14px] leading-5 text-muted">
              Escolha uma e já deixamos {serviceLimit === null || serviceLimit >= 4 ? 4 : serviceLimit} serviços cadastrados com preço e duração. Não achou a sua? Use “Outra
              especialidade”. Você ajusta tudo depois em Ajustes.
            </Text>
            {SPECIALTIES.map((s) => {
              const selected = s.id === specialtyId;
              return (
                <Pressable accessibilityRole="button" accessibilityState={{ selected: !!(selected) }}
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
            {/* Outra especialidade: a pessoa escreve o nome e os próprios serviços */}
            <Pressable accessibilityRole="button" accessibilityState={{ selected: !!(isOther) }}
              onPress={() => setSpecialtyId('other')}
              className={`mb-2.5 rounded-card border px-4 py-3.5 active:opacity-80 ${
                isOther ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
              }`}>
              <View className="flex-row items-center">
                <Ionicons name="add-circle-outline" size={20} color={isOther ? colors.primaryDark : colors.muted} />
                <Text className="ml-3 flex-1 text-[15px] font-semibold text-ink">Outra especialidade</Text>
                <Ionicons
                  name={isOther ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={isOther ? colors.primary : colors.line}
                />
              </View>
              {!isOther ? (
                <Text className="ml-8 mt-0.5 text-[12px] text-muted">Escreva a sua e cadastre seus serviços</Text>
              ) : null}
            </Pressable>
            {isOther ? (
              <View className="mb-2.5">
                <Field
                  label="Nome da especialidade"
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="Ex: Massoterapia"
                  autoFocus
                />
                <Text className="mb-1.5 text-[13px] font-medium text-muted">Seus serviços</Text>
                {customServices.map((c, i) => (
                  <View key={i} className="mb-2 rounded-2xl border border-line bg-surface p-3">
                    <View className="flex-row items-center">
                      <TextInput
                        value={c.name}
                        onChangeText={(t) => updateCustom(i, { name: t })}
                        placeholder={`Serviço ${i + 1} (ex: Massagem relaxante)`}
                        placeholderTextColor={colors.muted}
                        className="flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-[15px] text-ink"
                      />
                      {customServices.length > 1 ? (
                        <Pressable accessibilityRole="button" accessibilityLabel="Remover serviço"
                          onPress={() => setCustomServices(customServices.filter((_, j) => j !== i))}
                          hitSlop={8}
                          className="ml-2 p-1 active:opacity-60">
                          <Ionicons name="close-circle" size={22} color={colors.muted} />
                        </Pressable>
                      ) : null}
                    </View>
                    <View className="mt-2 flex-row gap-2">
                      <View className="flex-1">
                        <Text className="mb-1 text-[12px] text-muted">Preço</Text>
                        <TextInput
                          value={formatBRL(c.price)}
                          onChangeText={(t) => updateCustom(i, { price: maskBRL(t).value })}
                          keyboardType="number-pad"
                          className="rounded-xl border border-line bg-bg px-3 py-2.5 text-[15px] text-ink"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="mb-1 text-[12px] text-muted">Duração (minutos)</Text>
                        <TextInput
                          value={c.durationMin ? String(c.durationMin) : ''}
                          onChangeText={(t) => updateCustom(i, { durationMin: Number(onlyDigits(t).slice(0, 3)) })}
                          keyboardType="number-pad"
                          placeholder="60"
                          placeholderTextColor={colors.muted}
                          className="rounded-xl border border-line bg-bg px-3 py-2.5 text-[15px] text-ink"
                        />
                      </View>
                    </View>
                  </View>
                ))}
                {customServices.length < MAX_CUSTOM_SERVICES ? (
                  <Pressable accessibilityRole="button"
                    onPress={() => setCustomServices([...customServices, EMPTY_SERVICE])}
                    className="flex-row items-center justify-center rounded-2xl border border-dashed border-primary py-3 active:opacity-70">
                    <Ionicons name="add" size={18} color={colors.primaryDark} />
                    <Text className="ml-1.5 text-[14px] font-semibold text-primary-dark">Adicionar serviço</Text>
                  </Pressable>
                ) : null}
                {!otherReady ? (
                  <Text className="mt-2 text-[12px] leading-4 text-muted">
                    Preencha o nome da especialidade e pelo menos um serviço com nome, preço e duração.
                  </Text>
                ) : null}
              </View>
            ) : null}
            {services.length > 0 ? (
              <Text className="mt-1 text-[12px] leading-4 text-muted">
                Você já tem serviços cadastrados, então nenhum serviço novo será criado.
              </Text>
            ) : null}
            <Pressable accessibilityRole="button" onPress={skipSpecialty} disabled={busy} className="mt-2 items-center py-2 active:opacity-60">
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
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: !!(on) }}
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
              <Toggle label="Pausa para almoço" value={lunch} onChange={setLunch} />
            </View>

            {/* Último passo: o link já existe (passo 1); dá para divulgar antes de entrar na agenda (UX-09) */}
            <View className="mt-6">
              <Text className="mb-2 text-[13px] text-muted">Seu link de agendamento já está pronto. Mande para as clientes:</Text>
              <ShareLinkButton place="onboarding" />
            </View>
          </>
        )}
      </ScrollView>

      <View
        className="border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Button
          title={busy ? 'Salvando…' : step === STEPS.length - 1 ? 'Concluir e abrir a agenda' : 'Continuar'}
          icon={step === STEPS.length - 1 ? 'checkmark' : 'arrow-forward'}
          loading={busy}
          onPress={next}
          disabled={!canNext}
        />
      </View>
    </KeyboardView>
  );
}
