import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, EmptyState, Field, SectionLabel, Toggle } from '@/components/ui';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { openUpgrade, requireFeature } from '@/lib/upgrade';
import { describeDays } from '@/lib/areas';
import { confirmAction } from '@/lib/confirm';
import { WEEKDAYS_SHORT } from '@/lib/dates';
import { formatBRL, maskBRL } from '@/lib/format';
import { colors } from '@/theme/colors';
import type { ServiceArea } from '@/types';

/** 0 = sem deslocamento (nada é reservado depois do atendimento) */
const BUFFERS = [0, 15, 20, 30, 45, 60];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

type Draft = Omit<ServiceArea, 'id'> & { id?: string };
const emptyDraft = (): Draft => ({ name: '', travelFee: 0, allowedDays: [1, 2, 3, 4, 5, 6], isActive: true });

/** Ajustes › Regiões e taxas de deslocamento (atendimento a domicílio). */
export default function Regioes() {
  const { profile, updateProfile, serviceAreas, saveServiceArea, deleteServiceArea } = useStore();
  const insets = useSafeAreaInsets();
  const { hasHomeService, hasPublicLink } = usePlanAccess();
  const [draft, setDraft] = useState<Draft | null>(null);
  /** Abre o formulário só com o plano (sem ele, mostra o aviso de upgrade) */
  const edit = (d: Draft) => requireFeature(hasHomeService, 'homeService') && setDraft(d);
  const [saving, setSaving] = useState(false);

  const canSave = !!draft && draft.name.trim().length >= 2 && draft.allowedDays.length > 0 && !saving;

  async function save() {
    if (!draft || !canSave) return;
    setSaving(true);
    const ok = await saveServiceArea(draft);
    setSaving(false);
    if (ok) setDraft(null);
  }

  function remove() {
    if (!draft?.id) return;
    const id = draft.id;
    confirmAction('Excluir bairro?', `"${draft.name}" deixa de aparecer no agendamento online.`, async () => {
      if (await deleteServiceArea(id)) setDraft(null);
    }, 'Excluir');
  }

  const toggleDay = (d: number) =>
    draft &&
    setDraft({
      ...draft,
      allowedDays: draft.allowedDays.includes(d) ? draft.allowedDays.filter((x) => x !== d) : [...draft.allowedDays, d],
    });

  return (
    <View className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {!hasHomeService ? (
          <Pressable accessibilityRole="button"
            onPress={() => openUpgrade('homeService')}
            className="mb-2 flex-row items-center rounded-2xl bg-primary-soft p-3 active:opacity-80">
            <Ionicons name="lock-closed" size={16} color={colors.primaryDark} />
            <Text className="ml-2 flex-1 text-[13px] leading-5 text-primary-dark">
              Bairros, taxas e tempo de deslocamento estão disponíveis a partir do plano Básico, por apenas R$ 9,90/mês.
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
          </Pressable>
        ) : profile.serviceMode === 'fixed' ? (
          <View className="mb-2 rounded-2xl bg-[#FBF3E4] p-3">
            <Text className="text-[13px] leading-5 text-[#8A6420]">
              Seu modelo de atendimento está como Espaço fixo. Para usar os bairros, mude para A domicílio ou Híbrido
              em Dados do estúdio.
            </Text>
          </View>
        ) : null}

        <SectionLabel>Tempo de deslocamento</SectionLabel>
        <Text className="mb-2 text-[13px] leading-5 text-muted">
          Depois de cada atendimento em domicílio, a agenda reserva esse tempo para você chegar ao próximo.
        </Text>
        <View className="flex-row flex-wrap">
          {BUFFERS.map((m) => (
            <Chip
              key={m}
              label={m ? `${m} min` : 'Sem deslocamento'}
              selected={profile.travelBufferMinutes === m}
              onPress={() =>
                requireFeature(hasHomeService, 'homeService') && updateProfile({ travelBufferMinutes: m })
              }
            />
          ))}
        </View>

        <SectionLabel>Bairros atendidos</SectionLabel>
        {serviceAreas.length ? (
          <View className="overflow-hidden rounded-card border border-line bg-surface">
            {serviceAreas.map((a, i) => (
              <Pressable accessibilityRole="button"
                key={a.id}
                onPress={() => edit({ ...a })}
                className={`flex-row items-center px-4 py-3 active:bg-bg ${i ? 'border-t border-line' : ''}`}>
                <View className="flex-1">
                  <Text className={`text-[15px] font-medium ${a.isActive ? 'text-ink' : 'text-muted line-through'}`}>
                    {a.name}
                  </Text>
                  <Text className="text-[12px] text-muted">
                    {a.travelFee ? `Taxa ${formatBRL(a.travelFee)}` : 'Sem taxa'} · {describeDays(a.allowedDays)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState icon="map-outline" text="Nenhum bairro cadastrado ainda" />
        )}
        <View className="mt-3">
          <Button title="Adicionar bairro" icon="add" variant="secondary" onPress={() => edit(emptyDraft())} />
        </View>
        <Text className="mt-3 text-[12px] leading-4 text-muted">
          {hasPublicLink
            ? 'No link de agendamento, a cliente escolhe o bairro e só vê os dias da semana em que você atende lá. '
            : 'Ao agendar, o app avisa se o bairro não costuma ser atendido naquele dia. '}
          A taxa de deslocamento é somada ao valor do atendimento.
        </Text>
      </ScrollView>

      {/* Formulário do bairro */}
      <Modal visible={!!draft} transparent animationType="fade" onRequestClose={() => setDraft(null)}>
        {/* "padding" também no Android: com o app edge-to-edge, "height" deixava o formulário embaixo do teclado */}
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <Pressable accessible={false} onPress={() => setDraft(null)} className="flex-1 justify-end bg-black/30">
            <Pressable accessible={false}
              onPress={() => {}}
              className="rounded-t-3xl bg-surface px-5 pt-3"
              style={{ paddingBottom: Math.max(insets.bottom, 16) + 4 }}>
              <View className="mb-3 h-1 w-10 self-center rounded-full bg-line" />
              <Text className="mb-4 text-[17px] font-semibold text-ink">
                {draft?.id ? 'Editar bairro' : 'Novo bairro'}
              </Text>
              {draft ? (
                <>
                  <Field
                    label="Nome do bairro ou região"
                    value={draft.name}
                    onChangeText={(name) => setDraft({ ...draft, name })}
                    placeholder="Ex: Moema"
                    autoCapitalize="words"
                    autoFocus={!draft.id}
                  />
                  <Text className="mb-1.5 text-[13px] font-medium text-muted">Taxa de deslocamento</Text>
                  <TextInput
                    value={formatBRL(draft.travelFee)}
                    onChangeText={(t) => setDraft({ ...draft, travelFee: maskBRL(t).value })}
                    keyboardType="number-pad"
                    className="mb-3 rounded-2xl border border-line bg-bg px-4 py-3 text-[17px] font-semibold text-ink"
                  />
                  <Text className="mb-1.5 text-[13px] font-medium text-muted">Dias em que atende este bairro</Text>
                  <View className="mb-3 flex-row gap-1.5">
                    {ALL_DAYS.map((d) => {
                      const on = draft.allowedDays.includes(d);
                      return (
                        <Pressable accessibilityRole="button" accessibilityState={{ selected: !!(on) }}
                          key={d}
                          onPress={() => toggleDay(d)}
                          className={`flex-1 items-center rounded-xl border py-2.5 ${
                            on ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
                          }`}>
                          <Text className={`text-[13px] font-semibold ${on ? 'text-primary-dark' : 'text-muted'}`}>
                            {WEEKDAYS_SHORT[d]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {draft.id ? (
                    <View className="mb-3 flex-row items-center rounded-2xl border border-line px-4 py-3">
                      <View className="flex-1 pr-3">
                        <Text className="text-[15px] text-ink">Ativo</Text>
                        <Text className="text-[12px] text-muted">Desativado, some do agendamento online</Text>
                      </View>
                      <Toggle label="Região ativa" value={draft.isActive} onChange={(isActive) => setDraft({ ...draft, isActive })} />
                    </View>
                  ) : null}
                  <Button title={saving ? 'Salvando…' : 'Salvar bairro'} loading={saving} disabled={!canSave} onPress={save} />
                  {draft.id ? (
                    <Pressable accessibilityRole="button" onPress={remove} className="mt-1 items-center py-3">
                      <Text className="text-[15px] font-medium text-[#B2474F]">Excluir bairro</Text>
                    </Pressable>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={() => setDraft(null)} className="mt-1 items-center py-3">
                      <Text className="text-[15px] font-medium text-muted">Cancelar</Text>
                    </Pressable>
                  )}
                </>
              ) : null}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
