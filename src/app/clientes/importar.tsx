import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, SearchBar } from '@/components/ui';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { notify } from '@/lib/confirm';
import { type ImportCandidate, toImportCandidates } from '@/lib/contacts-import';
import { formatPhone, onlyDigits } from '@/lib/format';
import { requireFeature } from '@/lib/upgrade';
import { colors } from '@/theme/colors';

type Load = { state: 'loading' } | { state: 'denied' } | { state: 'error' } | { state: 'ready'; list: ImportCandidate[] };

/** Importar clientes da agenda do celular: a profissional escolhe quem entra. */
export default function ImportarContatos() {
  const insets = useSafeAreaInsets();
  const { clients, importClients } = useStore();
  const access = usePlanAccess();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    (async () => {
      try {
        // Carregado só no celular: o módulo não existe na web
        const Contacts = await import('expo-contacts');
        const perm = await Contacts.requestPermissionsAsync();
        if (!perm.granted) {
          if (alive) setLoad({ state: 'denied' });
          return;
        }
        const details = await Contacts.Contact.getAllDetails(
          [Contacts.ContactField.FULL_NAME, Contacts.ContactField.GIVEN_NAME, Contacts.ContactField.FAMILY_NAME, Contacts.ContactField.PHONES],
          { sortOrder: Contacts.ContactsSortOrder.GivenName },
        );
        if (alive) setLoad({ state: 'ready', list: toImportCandidates(details, clients) });
      } catch {
        if (alive) setLoad({ state: 'error' });
      }
    })();
    return () => {
      alive = false;
    };
    // Lê os contatos ao abrir (e ao tentar de novo); a lista de clientes do momento basta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (Platform.OS === 'web') {
    return (
      <View className="flex-1 bg-bg px-5 pt-6">
        <EmptyState
          icon="phone-portrait-outline"
          text="Disponível no app do celular"
          subtitle="Abra a Agenda Plena no Android ou iPhone para escolher contatos da agenda e cadastrar como clientes."
        />
      </View>
    );
  }

  if (load.state === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.primary} />
        <Text className="mt-3 text-[14px] text-muted">Lendo seus contatos…</Text>
      </View>
    );
  }

  if (load.state === 'denied' || load.state === 'error') {
    const denied = load.state === 'denied';
    return (
      <View className="flex-1 bg-bg px-5 pt-6">
        <EmptyState
          icon={denied ? 'lock-closed-outline' : 'alert-circle-outline'}
          text={denied ? 'Sem acesso aos contatos' : 'Não deu para ler os contatos'}
          subtitle={
            denied
              ? 'Para importar, permita que a Agenda Plena leia seus contatos nos ajustes do celular. Ela só lê: nada é alterado na sua agenda.'
              : 'Tente de novo em instantes.'
          }
          actionLabel={denied ? 'Abrir ajustes do celular' : 'Tentar de novo'}
          onAction={() => (denied ? Linking.openSettings() : setAttempt((n) => n + 1))}
        />
        {denied ? (
          <Pressable accessibilityRole="button" onPress={() => setAttempt((n) => n + 1)} className="mt-2 items-center py-2">
            <Text className="text-[14px] font-semibold text-primary-dark">Já permiti, tentar de novo</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const all = load.list;
  const q = query.trim().toLowerCase();
  const qDigits = onlyDigits(query);
  const visible = q
    ? all.filter((c) => c.name.toLowerCase().includes(q) || (qDigits.length >= 3 && c.whatsapp.includes(qDigits)))
    : all;
  const selectable = visible.filter((c) => !c.existing);
  const allVisibleOn = selectable.length > 0 && selectable.every((c) => selected.has(c.id));
  const count = selected.size;
  const currentCount = clients.filter((c) => !c.removed).length;
  const room = access.limits.clients === null ? null : Math.max(0, access.limits.clients - currentCount);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      for (const c of selectable) {
        if (allVisibleOn) n.delete(c.id);
        else n.add(c.id);
      }
      return n;
    });

  async function save() {
    if (!count) return;
    if (!access.canAddClient(currentCount, count)) {
      notify(
        'Limite de clientes do plano',
        room ? `Seu plano permite cadastrar mais ${room} ${room === 1 ? 'cliente' : 'clientes'}. Desmarque alguns contatos ou mude de plano.` : 'Seu plano já chegou ao limite de clientes.',
        'info',
      );
      requireFeature(false, 'unlimitedClients');
      return;
    }
    setSaving(true);
    const chosen = all.filter((c) => selected.has(c.id)).map((c) => ({ name: c.name, whatsapp: c.whatsapp || undefined }));
    const n = await importClients(chosen);
    setSaving(false);
    if (n === null) return;
    notify('Contatos importados', `${n} ${n === 1 ? 'cliente cadastrada' : 'clientes cadastradas'}.`, 'success');
    router.back();
  }

  return (
    <View className="flex-1 bg-bg pt-3">
      <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar contato por nome ou número" />
      <View className="mx-5 mb-2 flex-row items-center justify-between">
        <Text className="flex-1 text-[13px] text-muted">
          {all.length} {all.length === 1 ? 'contato' : 'contatos'}
          {room !== null ? ` · seu plano permite mais ${room}` : ''}
        </Text>
        {selectable.length ? (
          <Pressable accessibilityRole="button" onPress={toggleAll} hitSlop={8}>
            <Text className="text-[13px] font-semibold text-primary-dark">
              {allVisibleOn ? 'Desmarcar todos' : q ? 'Marcar os encontrados' : 'Marcar todos'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={30}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            text={q ? 'Nenhum contato encontrado' : 'Nenhum contato na agenda'}
            subtitle={q ? `Nada com "${query.trim()}".` : undefined}
          />
        }
        renderItem={({ item: c, index }) => {
          const on = selected.has(c.id);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: c.existing }}
              accessibilityLabel={`${c.name}${c.whatsapp ? `, ${formatPhone(c.whatsapp)}` : ''}${c.existing ? ', já é cliente' : ''}`}
              disabled={c.existing}
              onPress={() => toggle(c.id)}
              className={`flex-row items-center bg-surface px-4 py-3 active:bg-bg ${
                index === 0 ? 'rounded-t-card' : 'border-t border-line'
              } ${index === visible.length - 1 ? 'rounded-b-card' : ''}`}>
              <Ionicons
                name={c.existing ? 'checkmark-circle' : on ? 'checkbox' : 'square-outline'}
                size={22}
                color={c.existing ? colors.line : on ? colors.primary : colors.muted}
              />
              <View className={`ml-3 flex-1 ${c.existing ? 'opacity-50' : ''}`}>
                <Text numberOfLines={1} className="text-[15px] font-semibold text-ink">
                  {c.name}
                </Text>
                <Text className="text-xs text-muted">
                  {c.existing ? 'Já é sua cliente' : c.whatsapp ? formatPhone(c.whatsapp) : 'Sem celular com DDD'}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
      <View style={{ paddingBottom: insets.bottom + 12 }} className="border-t border-line bg-surface px-5 pt-3">
        <Button
          title={count ? `Importar ${count} ${count === 1 ? 'contato' : 'contatos'}` : 'Escolha quem importar'}
          icon="person-add-outline"
          disabled={!count}
          loading={saving}
          onPress={save}
        />
      </View>
    </View>
  );
}
