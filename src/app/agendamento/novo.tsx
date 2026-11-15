import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Chip, Field, SectionLabel } from '@/components/ui';
import { useStore } from '@/data/store';
import { closeModal } from '@/lib/confirm';
import {
  addDays,
  atMinutes,
  formatDuration,
  formatTime,
  hmToMinutes,
  isSameDay,
  minutesOfDay,
  startOfDay,
  WEEKDAYS_SHORT,
} from '@/lib/dates';
import { formatBRL, formatPhone, normalize } from '@/lib/format';
import { colors } from '@/theme/colors';

export default function NovoAgendamento() {
  const params = useLocalSearchParams<{ date?: string; clientId?: string }>();
  const insets = useSafeAreaInsets();
  const { clients, services, appointments, blocks, profile, addAppointment, addClient } = useStore();

  const initial = params.date ? new Date(params.date) : new Date();
  const initialHasTime = !!params.date && minutesOfDay(initial) !== 0;

  const [clientId, setClientId] = useState<string | undefined>(params.clientId);
  const [query, setQuery] = useState('');
  const [newClient, setNewClient] = useState<{ name: string; whatsapp: string } | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [day, setDay] = useState(startOfDay(initial));
  const [time, setTime] = useState<number | null>(initialHasTime ? minutesOfDay(initial) : null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const client = clients.find((c) => c.id === clientId);
  const selectedServices = serviceIds.map((id) => services.find((s) => s.id === id)!);
  const duration = selectedServices.reduce((t, s) => t + s.durationMin, 0);
  const total = selectedServices.reduce((t, s) => t + s.price, 0);

  const q = normalize(query);
  const qDigits = query.replace(/\D/g, '');
  const matches = clients
    .filter((c) => !q || normalize(c.name).includes(q) || (qDigits && c.whatsapp?.includes(qDigits)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, q ? 20 : 8);

  const categories = [...new Set(services.map((s) => s.category))];

  // Horários livres no dia escolhido
  const slot = profile.slotMinutes;
  const workStart = hmToMinutes(profile.workStart);
  const workEnd = hmToMinutes(profile.workEnd);
  const busy = [
    ...appointments
      .filter((a) => a.status !== 'cancelado' && isSameDay(new Date(a.startsAt), day))
      .map((a) => [minutesOfDay(new Date(a.startsAt)), minutesOfDay(new Date(a.endsAt))]),
    ...blocks
      .filter((b) => {
        const s = day.getTime();
        return new Date(b.startsAt).getTime() < s + 86_400_000 && new Date(b.endsAt).getTime() > s;
      })
      .map((b) => (b.allDay ? [0, 24 * 60] : [minutesOfDay(new Date(b.startsAt)), minutesOfDay(new Date(b.endsAt))])),
  ];
  const need = Math.max(duration, slot);
  const now = new Date();
  const slots: { min: number; free: boolean }[] = [];
  for (let m = workStart; m + slot <= workEnd; m += slot) {
    const past = isSameDay(day, now) && m < minutesOfDay(now);
    const conflict = busy.some(([s, e]) => m < e && m + need > s);
    slots.push({ min: m, free: !past && !conflict && m + need <= workEnd });
  }
  // Horário vindo do toque na agenda ainda é válido?
  const timeValid = time !== null && slots.some((s) => s.min === time && s.free);

  const days = Array.from({ length: 21 }, (_, i) => addDays(startOfDay(new Date()), i));

  function toggleService(id: string) {
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function saveNewClient() {
    if (!newClient?.name.trim() || saving) return;
    setSaving(true);
    const c = await addClient({
      name: newClient.name.trim(),
      whatsapp: newClient.whatsapp.replace(/\D/g, '') || undefined,
    });
    setSaving(false);
    if (!c) return;
    setClientId(c.id);
    setNewClient(null);
    setQuery('');
  }

  const canSave = !!client && selectedServices.length > 0 && timeValid && !saving;

  async function save() {
    if (!canSave || time === null) return;
    setSaving(true);
    const ok = await addAppointment({
      clientId: client!.id,
      startsAt: atMinutes(day, time).toISOString(),
      serviceIds,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
    if (ok) closeModal();
  }

  return (
    <View className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        {/* 1. Cliente */}
        <SectionLabel>Cliente</SectionLabel>
        {client ? (
          <Pressable
            onPress={() => setClientId(undefined)}
            className="flex-row items-center rounded-card border border-primary bg-primary-soft p-3">
            <Avatar name={client.name} />
            <View className="ml-3 flex-1">
              <Text className="text-[15px] font-semibold text-ink">{client.name}</Text>
              <Text className="text-xs text-muted">{formatPhone(client.whatsapp)}</Text>
            </View>
            <Text className="text-[13px] font-medium text-primary-dark">Trocar</Text>
          </Pressable>
        ) : newClient ? (
          <View className="rounded-card border border-line bg-surface p-4">
            <Field
              label="Nome"
              value={newClient.name}
              onChangeText={(name) => setNewClient({ ...newClient, name })}
              placeholder="Nome da cliente"
              autoFocus
            />
            <Field
              label="WhatsApp"
              value={newClient.whatsapp}
              onChangeText={(whatsapp) => setNewClient({ ...newClient, whatsapp })}
              placeholder="(11) 90000-0000"
              keyboardType="phone-pad"
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button title="Cancelar" variant="secondary" onPress={() => setNewClient(null)} />
              </View>
              <View className="flex-1">
                <Button title="Salvar" onPress={saveNewClient} disabled={!newClient.name.trim()} />
              </View>
            </View>
          </View>
        ) : (
          <View>
            <View className="mb-2 flex-row items-center rounded-2xl border border-line bg-surface px-3">
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar por nome ou telefone"
                placeholderTextColor={colors.muted}
                className="flex-1 px-2 py-3 text-[15px] text-ink"
              />
            </View>
            <View className="overflow-hidden rounded-card border border-line bg-surface">
              {matches.map((c, i) => (
                <Pressable
                  key={c.id}
                  onPress={() => setClientId(c.id)}
                  className={`flex-row items-center px-3 py-2.5 active:bg-bg ${i ? 'border-t border-line' : ''}`}>
                  <Avatar name={c.name} size={32} />
                  <Text className="ml-3 flex-1 text-[15px] text-ink">{c.name}</Text>
                  <Text className="text-xs text-muted">{formatPhone(c.whatsapp)}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setNewClient({ name: query, whatsapp: '' })}
                className="flex-row items-center border-t border-line px-3 py-3 active:bg-bg">
                <Ionicons name="person-add-outline" size={18} color={colors.primaryDark} />
                <Text className="ml-2 text-[15px] font-medium text-primary-dark">Nova cliente</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* 2. Serviços */}
        <SectionLabel>Serviços</SectionLabel>
        {categories.map((cat) => (
          <View key={cat} className="mb-1">
            <Text className="mb-1.5 text-[13px] font-medium text-ink">{cat}</Text>
            <View className="flex-row flex-wrap">
              {services
                .filter((s) => s.category === cat)
                .map((s) => (
                  <Chip
                    key={s.id}
                    label={s.name}
                    sublabel={`${formatBRL(s.price)} · ${formatDuration(s.durationMin)}`}
                    selected={serviceIds.includes(s.id)}
                    onPress={() => toggleService(s.id)}
                  />
                ))}
            </View>
          </View>
        ))}

        {/* 3. Data */}
        <SectionLabel>Data</SectionLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 px-5">
          {days.map((d) => {
            const sel = isSameDay(d, day);
            return (
              <Pressable
                key={d.toDateString()}
                onPress={() => {
                  setDay(d);
                  setTime(null);
                }}
                className={`mr-2 w-14 items-center rounded-2xl border py-2 ${
                  sel ? 'border-primary bg-primary' : 'border-line bg-surface'
                }`}>
                <Text className={`text-[11px] ${sel ? 'text-white' : 'text-muted'}`}>{WEEKDAYS_SHORT[d.getDay()]}</Text>
                <Text className={`text-lg font-semibold ${sel ? 'text-white' : 'text-ink'}`}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
          <View className="w-8" />
        </ScrollView>

        {/* 4. Horário */}
        <SectionLabel>
          Horário {duration ? `· duração ${formatDuration(duration)}` : ''}
        </SectionLabel>
        {slots.some((s) => s.free) ? (
          <View className="flex-row flex-wrap">
            {slots.map((s) => {
              const sel = time === s.min && s.free;
              return (
                <Pressable
                  key={s.min}
                  disabled={!s.free}
                  onPress={() => setTime(s.min)}
                  className={`mb-2 mr-2 w-[72px] items-center rounded-xl border py-2 ${
                    sel ? 'border-primary bg-primary' : s.free ? 'border-line bg-surface' : 'border-transparent bg-transparent'
                  }`}>
                  <Text
                    className={`text-[14px] font-medium ${
                      sel ? 'text-white' : s.free ? 'text-ink' : 'text-line line-through'
                    }`}>
                    {formatTime(atMinutes(day, s.min))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text className="text-sm text-muted">Nenhum horário livre neste dia.</Text>
        )}

        {/* 5. Observações */}
        <SectionLabel>Observações</SectionLabel>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Ex: trazer referência da nail art"
          placeholderTextColor={colors.muted}
          multiline
          className="min-h-[80px] rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink"
          style={{ textAlignVertical: 'top' }}
        />
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="mb-2 flex-row justify-between">
          <Text className="text-[13px] text-muted">
            {selectedServices.length} {selectedServices.length === 1 ? 'serviço' : 'serviços'}
            {duration ? ` · ${formatDuration(duration)}` : ''}
          </Text>
          <Text className="text-[15px] font-semibold text-ink">{formatBRL(total)}</Text>
        </View>
        <Button title={saving ? 'Salvando…' : 'Agendar'} onPress={save} disabled={!canSave} />
      </View>
    </View>
  );
}
