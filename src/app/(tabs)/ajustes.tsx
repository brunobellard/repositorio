import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Avatar, Card, Screen, ScreenTitle, SectionLabel } from '@/components/ui';
import { useStore } from '@/data/store';
import { useState } from 'react';

import { useAuth } from '@/data/auth';
import { useBiometricLock } from '@/data/biometric-lock';
import { confirmAction, notify } from '@/lib/confirm';
import { formatPhone } from '@/lib/format';
import { colors } from '@/theme/colors';
import type { IconName } from '@/components/ui';

function Row({
  icon,
  label,
  detail,
  href,
  onPress,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  href?: Href;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={() =>
        onPress
          ? onPress()
          : href
            ? router.push(href)
            : notify('Em breve', 'Esta tela será criada na próxima etapa.')
      }
      className="flex-row items-center py-3 active:opacity-60">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-soft">
        <Ionicons name={icon} size={16} color={colors.primaryDark} />
      </View>
      <Text className="ml-3 flex-1 text-[15px] text-ink">{label}</Text>
      {detail ? <Text className="mr-2 text-[13px] text-muted">{detail}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

export default function AjustesScreen() {
  const { profile, services, clients, loadExampleData } = useStore();
  const { session, signOut } = useAuth();
  const biometric = useBiometricLock();
  const [loadingExample, setLoadingExample] = useState(false);

  function askExampleData() {
    confirmAction(
      'Carregar dados de exemplo?',
      'Serão criadas 12 clientes, agendamentos desta semana e algumas despesas, para você testar o app.',
      async () => {
        setLoadingExample(true);
        await loadExampleData();
        setLoadingExample(false);
        notify('Pronto!', 'Os dados de exemplo foram adicionados.');
      },
      'Carregar',
    );
  }
  return (
    <Screen>
      <ScreenTitle title="Ajustes" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Card className="flex-row items-center">
          <Avatar name={profile.ownerName} size={52} />
          <View className="ml-3 flex-1">
            <Text className="text-[16px] font-semibold text-ink">{profile.businessName}</Text>
            <Text className="text-[13px] text-muted">{profile.ownerName} · {formatPhone(profile.phone)}</Text>
          </View>
        </Card>

        <SectionLabel>Atendimento</SectionLabel>
        <Card className="py-1">
          <Row icon="sparkles-outline" label="Serviços e preços" detail={`${services.length}`} />
          <Row icon="time-outline" label="Horário de funcionamento" detail={`${profile.workStart}–${profile.workEnd}`} />
        </Card>

        <SectionLabel>Comunicação</SectionLabel>
        <Card className="py-1">
          <Row icon="chatbubbles-outline" label="Modelos de mensagem" href="/ajustes/mensagens" />
          <Row icon="flash-outline" label="Envio automático (WhatsApp)" detail="Em breve" />
        </Card>

        <SectionLabel>Conta</SectionLabel>
        <Card className="py-1">
          <Row icon="person-outline" label="Dados do estúdio" />
          {biometric.support.available ? (
            <View className="flex-row items-center py-3">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-soft">
                <Ionicons name={biometric.support.icon} size={16} color={colors.primaryDark} />
              </View>
              <Text className="ml-3 flex-1 text-[15px] text-ink">Entrar com {biometric.support.label}</Text>
              <Switch
                value={biometric.enabled}
                onValueChange={(on) => {
                  if (on) biometric.enable();
                  else biometric.disable();
                }}
                trackColor={{ true: colors.primary, false: colors.line }}
                thumbColor="#fff"
              />
            </View>
          ) : null}
          <Row
            icon="flask-outline"
            label={loadingExample ? 'Carregando exemplos…' : 'Carregar dados de exemplo'}
            detail={clients.length ? undefined : 'Recomendado'}
            onPress={loadingExample ? () => {} : askExampleData}
          />
          <Row
            icon="log-out-outline"
            label="Sair"
            detail={session?.user.email}
            onPress={() => confirmAction('Sair da conta?', 'Você precisará entrar de novo com e-mail e senha.', signOut, 'Sair')}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
