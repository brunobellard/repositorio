import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar, Card, Screen, ScreenTitle, SectionLabel, Toggle } from '@/components/ui';
import { useStore } from '@/data/store';
import { useState } from 'react';

import { useAuth } from '@/data/auth';
import { useBiometricLock } from '@/data/biometric-lock';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { requireFeature } from '@/lib/upgrade';
import { confirmAction, notify } from '@/lib/confirm';
import { formatPhone } from '@/lib/format';
import { LEGAL_PATHS, webUrl } from '@/lib/web';
import { pushUnsupportedHere, registerForPushAsync, sendTestNotificationAsync } from '@/services/notifications';
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
  const { profile, services, clients, businessHours, loadExampleData, updateProfile } = useStore();
  const openDays = businessHours.filter((h) => h.isOpen).length;
  const { session, signOut } = useAuth();
  const biometric = useBiometricLock();
  const access = usePlanAccess();
  const [loadingExample, setLoadingExample] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  /** Liga: registra o aparelho e salva o token. Desliga: apaga o token (para de receber). */
  async function togglePush(on: boolean) {
    if (!on) {
      setPushStatus(null);
      await updateProfile({ pushNotificationsEnabled: false, expoPushToken: undefined });
      return;
    }
    const r = await registerForPushAsync();
    await updateProfile({ pushNotificationsEnabled: true, ...(r.ok ? { expoPushToken: r.token } : {}) });
    setPushStatus(r.ok ? null : r.message);
  }

  async function testPush() {
    setTesting(true);
    try {
      // Garante um token atualizado antes do teste
      const r = await registerForPushAsync();
      if (r.ok && r.token !== profile.expoPushToken) await updateProfile({ expoPushToken: r.token });
      if (!r.ok && r.reason !== 'expo-go-android') {
        notify('Não foi possível testar', r.message);
        return;
      }
      const via = await sendTestNotificationAsync(r.ok ? r.token : undefined);
      notify(
        'Notificação enviada',
        via === 'push'
          ? 'Enviada pelo serviço de push da Expo. Ela deve aparecer em alguns segundos.'
          : 'Notificação local exibida. No Expo Go (Android) o push remoto não funciona; use a versão de desenvolvimento do app.',
      );
    } catch (e) {
      notify('Falha no envio', e instanceof Error ? e.message : undefined);
    } finally {
      setTesting(false);
    }
  }

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
          {profile.logoUrl ? (
            <Image source={{ uri: profile.logoUrl }} style={{ width: 52, height: 52, borderRadius: 16 }} contentFit="cover" />
          ) : (
            <Avatar name={profile.businessName} size={52} />
          )}
          <View className="ml-3 flex-1">
            <Text className="text-[16px] font-semibold text-ink">{profile.businessName}</Text>
            <Text className="text-[13px] text-muted">{[profile.ownerName, formatPhone(profile.phone), profile.instagram ? `@${profile.instagram}` : ''].filter(Boolean).join(' · ')}</Text>
          </View>
        </Card>

        {/* Plano atual */}
        <Pressable
          onPress={() => router.push('/ajustes/assinatura')}
          className="mt-3 flex-row items-center rounded-card border border-primary/40 bg-primary-soft px-4 py-3 active:opacity-80">
          <Ionicons name="sparkles" size={18} color={colors.primaryDark} />
          <View className="ml-3 flex-1">
            <Text className="text-[14px] font-semibold text-primary-dark">
              {access.isTrialActive
                ? `Período de teste ${access.plan.name}`
                : access.trialExpired
                  ? 'Teste encerrado · Plano Free'
                  : `Plano ${access.plan.name}`}
            </Text>
            <Text className="text-[12px] text-primary-dark">
              {access.isTrialActive
                ? `${access.daysLeftInTrial} ${access.daysLeftInTrial === 1 ? 'dia restante' : 'dias restantes'}`
                : access.currentPlan === 'free'
                  ? 'Até 10 clientes e 20 agendamentos por mês'
                  : 'Assinatura ativa'}
            </Text>
          </View>
          <View className="rounded-full bg-primary px-3 py-1.5">
            <Text className="text-[12px] font-semibold text-white">Ver planos</Text>
          </View>
        </Pressable>

        <SectionLabel>Estúdio</SectionLabel>
        <Card className="py-1">
          <Row icon="storefront-outline" label="Dados do estúdio" href="/ajustes/estudio" />
          <Row
            icon="sparkles-outline"
            label="Serviços e preços"
            detail={`${services.filter((s) => s.active).length} ativos`}
            href="/ajustes/servicos"
          />
          <Row
            icon="time-outline"
            label="Horário de funcionamento"
            detail={`${openDays} dias/semana`}
            href="/ajustes/horarios"
          />
        </Card>

        <SectionLabel>Financeiro</SectionLabel>
        <Card className="py-1">
          <Row
            icon="card-outline"
            label="Taxas de pagamento"
            detail={
              profile.paymentFees.credit || profile.paymentFees.debit
                ? `Créd. ${String(profile.paymentFees.credit).replace('.', ',')}%`
                : 'Não definidas'
            }
            onPress={() => requireFeature(access.hasCardFees, 'cardFees') && router.push('/ajustes/taxas')}
          />
        </Card>

        <SectionLabel>Notificações</SectionLabel>
        <Card className="py-1">
          <View className="flex-row items-center py-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-soft">
              <Ionicons name="notifications-outline" size={16} color={colors.primaryDark} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[15px] text-ink">Avisar agendamentos online</Text>
              <Text className="text-[12px] text-muted">
                {!access.hasPush
                  ? 'Disponível a partir do plano Intermediário'
                  : pushStatus ??
                  (pushUnsupportedHere
                    ? 'Indisponível no Expo Go (Android): use a versão de desenvolvimento'
                    : profile.pushNotificationsEnabled
                    ? profile.expoPushToken
                      ? 'Ativo neste aparelho'
                      : 'Ativo, aguardando registro do aparelho'
                    : 'Desligado')}
              </Text>
            </View>
            <Toggle
              value={access.hasPush && profile.pushNotificationsEnabled}
              onChange={(on) => requireFeature(access.hasPush, 'push') && togglePush(on)}
            />
          </View>
          {access.hasPush && profile.pushNotificationsEnabled ? (
            <Pressable onPress={testPush} disabled={testing} className="border-t border-line py-3 active:opacity-60">
              <Text className="text-[14px] font-medium text-primary-dark">
                {testing ? 'Enviando…' : 'Enviar notificação de teste'}
              </Text>
            </Pressable>
          ) : null}
        </Card>

        <SectionLabel>Comunicação</SectionLabel>
        <Card className="py-1">
          <Row icon="chatbubbles-outline" label="Modelos de mensagem" href="/ajustes/mensagens" />
          <Row
            icon="refresh-circle-outline"
            label="Retorno de clientes"
            detail={`${profile.recallDays} dias`}
            onPress={() => requireFeature(access.hasRetentionCRM, 'retentionCRM') && router.push('/ajustes/retorno')}
          />
          <Row icon="flash-outline" label="Envio automático (WhatsApp)" detail="Em breve" />
        </Card>

        <SectionLabel>Conta</SectionLabel>
        <Card className="py-1">
          {biometric.support.available ? (
            <View className="flex-row items-center py-3">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-soft">
                <Ionicons name={biometric.support.icon} size={16} color={colors.primaryDark} />
              </View>
              <Text className="ml-3 flex-1 text-[15px] text-ink">Entrar com {biometric.support.label}</Text>
              <Toggle
                value={biometric.enabled}
                onChange={(on) => {
                  if (on) biometric.enable();
                  else biometric.disable();
                }}
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
            icon="document-text-outline"
            label="Termos de Uso"
            onPress={() => Linking.openURL(webUrl(LEGAL_PATHS.terms))}
          />
          <Row
            icon="shield-checkmark-outline"
            label="Política de Privacidade"
            onPress={() => Linking.openURL(webUrl(LEGAL_PATHS.privacy))}
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
