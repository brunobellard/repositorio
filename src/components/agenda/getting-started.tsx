// UX-10: cartão "Primeiros passos" na Agenda, para a conta nova não ficar diante de uma tela vazia.
// Os passos de cliente e horário se marcam sozinhos; link e preços ficam guardados no aparelho.
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { shareBookingLink, useBookingLink } from '@/components/share-link-button';
import { Card } from '@/components/ui';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { confirmAction } from '@/lib/confirm';
import { requireFeature } from '@/lib/upgrade';
import { colors } from '@/theme/colors';

interface Flags {
  shared?: boolean;
  prices?: boolean;
  dismissed?: boolean;
}

const keyFor = (owner: string) => `getting-started:${owner}`;

export function GettingStarted() {
  const { profile, clients, appointments, loadExampleData } = useStore();
  const access = usePlanAccess();
  const link = useBookingLink();
  const [flags, setFlags] = useState<Flags | null>(null);
  const [loadingExample, setLoadingExample] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(keyFor(profile.id))
      .then((v) => alive && setFlags(v ? (JSON.parse(v) as Flags) : {}))
      .catch(() => alive && setFlags({}));
    return () => {
      alive = false;
    };
  }, [profile.id]);

  function save(patch: Flags) {
    const next = { ...(flags ?? {}), ...patch };
    setFlags(next);
    AsyncStorage.setItem(keyFor(profile.id), JSON.stringify(next)).catch(() => {});
  }

  // Só o que a profissional fez: exemplos não contam como passo feito
  const exampleIds = new Set(clients.filter((c) => c.isExample).map((c) => c.id));
  const realAppointments = appointments.filter((a) => !exampleIds.has(a.clientId));
  const hasClient = clients.some((c) => !c.removed && !c.isExample);
  const hasAppointment = realAppointments.length > 0;
  // Conta que já usa o app de verdade (5+ atendimentos próprios) não precisa do cartão
  const established = realAppointments.length >= 5;
  const steps = [
    {
      done: hasClient,
      label: 'Cadastrar uma cliente',
      onPress: () => router.push('/clientes/nova'),
    },
    {
      done: hasAppointment,
      label: 'Marcar o primeiro horário',
      onPress: () => router.push('/agendamento/novo'),
    },
    ...(link
      ? [
          {
            done: !!flags?.shared,
            label: 'Compartilhar seu link de agendamento',
            onPress: () => {
              if (!requireFeature(access.hasPublicLink, 'publicLink')) return;
              save({ shared: true });
              shareBookingLink(link, profile.businessName);
            },
          },
        ]
      : []),
    {
      done: !!flags?.prices,
      label: 'Conferir serviços e preços',
      onPress: () => {
        save({ prices: true });
        router.push('/ajustes/servicos');
      },
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  // Ainda lendo o aparelho, dispensado ou tudo feito: não mostra
  if (!flags || flags.dismissed || established || doneCount === steps.length) return null;

  function tryExamples() {
    confirmAction(
      'Ver o app com dados de exemplo?',
      'Entram clientes, agendamentos, despesas e folgas de exemplo. Para tirar tudo depois, use Ajustes > Remover dados de exemplo.',
      async () => {
        setLoadingExample(true);
        await loadExampleData();
        setLoadingExample(false);
      },
      'Carregar',
    );
  }

  return (
    <Card className="mx-4 mt-3">
      <View className="flex-row items-start">
        <View className="flex-1">
          <Text className="text-[16px] font-semibold text-ink">Primeiros passos</Text>
          <Text className="text-[13px] text-muted">
            {doneCount} de {steps.length} feitos
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dispensar primeiros passos"
          hitSlop={10}
          onPress={() => save({ dismissed: true })}
          className="p-1 active:opacity-60">
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>
      <View className="mt-2">
        {steps.map((s, i) => (
          <Pressable
            key={s.label}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}. ${s.label}${s.done ? ', feito' : ''}`}
            accessibilityState={{ checked: s.done }}
            onPress={s.onPress}
            className="flex-row items-center py-2.5 active:opacity-60">
            <Ionicons
              name={s.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={s.done ? statusDone : colors.muted}
            />
            <Text className={`ml-2.5 flex-1 text-[15px] ${s.done ? 'text-muted line-through' : 'text-ink'}`}>{s.label}</Text>
            {!s.done ? <Ionicons name="chevron-forward" size={16} color={colors.muted} /> : null}
          </Pressable>
        ))}
      </View>
      {!hasClient && !hasAppointment && !exampleIds.size ? (
        <Pressable
          accessibilityRole="button"
          onPress={loadingExample ? undefined : tryExamples}
          className="mt-1 self-start py-1 active:opacity-60">
          <Text className="text-[13px] font-medium text-primary-dark underline">
            {loadingExample ? 'Carregando exemplos…' : 'Ver o app com dados de exemplo'}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const statusDone = '#4A7356';
