import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useRef, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { requireFeature } from '@/lib/upgrade';
import { notify } from '@/lib/confirm';
import { formatTime } from '@/lib/dates';
import { formatBRL, formatPhone, initials, maskDocument } from '@/lib/format';
import { formatAddress } from '@/lib/hours';
import { whatsappProvider } from '@/services/messaging';
import { colors, paymentLabels } from '@/theme/colors';

const fullDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/** Linha "rótulo ........ valor" do recibo */
function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="mb-1.5 flex-row items-start justify-between">
      <Text className={`mr-3 flex-1 text-[14px] ${strong ? 'font-semibold text-ink' : 'text-ink'}`}>{label}</Text>
      <Text className={`text-[14px] ${strong ? 'font-bold text-ink' : 'text-muted'}`}>{value}</Text>
    </View>
  );
}

export default function Comprovante() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { appointments, clients, profile, transactions, packages } = useStore();
  const access = usePlanAccess();
  const card = useRef<ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState(false);

  const appt = appointments.find((a) => a.id === id);
  const client = clients.find((c) => c.id === appt?.clientId);
  if (!appt || !client) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Agendamento não encontrado.</Text>
      </View>
    );
  }

  const start = new Date(appt.startsAt);
  const income = transactions.find((t) => t.appointmentId === appt.id);
  const pkg = packages.find((p) => p.id === appt.clientPackageId);
  const remaining = pkg ? pkg.totalSessions - pkg.usedSessions : 0;
  const method = income?.paymentMethod;
  const address = formatAddress(profile);
  const contact = [formatPhone(profile.phone), profile.instagram ? `@${profile.instagram}` : '']
    .filter(Boolean)
    .join(' · ');
  const code = appt.id.slice(0, 8).toUpperCase();

  /** Recibo em texto, formatado para o WhatsApp (*negrito*, emojis discretos) */
  function receiptText() {
    const lines = [
      `🧾 *Comprovante — ${profile.businessName}*`,
      '',
      `👤 ${client!.name}`,
      `📅 ${fullDate(start)} às ${formatTime(start)}`,
      '',
      ...appt!.services.map((s) => (pkg ? `✨ ${s.name}` : `✨ ${s.name} — ${formatBRL(s.price)}`)),
      '',
      pkg
        ? `🎟️ *Descontado do pacote* "${pkg.name}"\nRestam ${remaining} de ${pkg.totalSessions} sessões`
        : `💳 *Total pago: ${formatBRL(appt!.totalPrice)}*${method ? ` (${paymentLabels[method]})` : ''}`,
      '',
      address ? `📍 ${address}` : '',
      profile.instagram ? `📷 @${profile.instagram}` : '',
      '',
      'Obrigada pela preferência! 💕',
      `_Comprovante nº ${code}_`,
    ];
    // Remove linhas vazias repetidas
    return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n').trim();
  }

  async function sendText() {
    if (!client!.whatsapp) return notify('Cliente sem WhatsApp', 'Cadastre o número na ficha da cliente.');
    try {
      await whatsappProvider.send(client!.whatsapp, receiptText());
    } catch {
      notify('Não foi possível abrir o WhatsApp');
    }
  }

  async function shareImage() {
    if (!requireFeature(access.hasReceiptImage, 'receiptImage')) return;
    setSharing(true);
    try {
      if (Platform.OS === 'web') {
        // No navegador não dá para compartilhar arquivo local: baixa a imagem
        const uri = await captureRef(card, { format: 'png', quality: 1, result: 'data-uri' });
        const a = document.createElement('a');
        a.href = uri;
        a.download = `comprovante-${code}.png`;
        a.click();
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        notify('Compartilhamento indisponível neste aparelho');
        return;
      }
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: 'Compartilhar comprovante',
      });
    } catch (e) {
      notify('Não foi possível gerar a imagem', e instanceof Error ? e.message : undefined);
    } finally {
      setSharing(false);
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 170 }}>
        {/* O card abaixo é o que vira imagem (fundo branco próprio, sem depender da tela) */}
        <View ref={card} collapsable={false} className="rounded-3xl bg-white px-6 pb-6 pt-7" style={{ borderWidth: 1, borderColor: colors.line }}>
          <View className="items-center">
            {profile.logoUrl ? (
              <Image
                source={{ uri: profile.logoUrl }}
                style={{ width: 64, height: 64, borderRadius: 18 }}
                contentFit="cover"
              />
            ) : (
              <View className="h-16 w-16 items-center justify-center rounded-[18px] bg-primary-soft">
                <Text className="text-xl font-bold text-primary-dark">{initials(profile.businessName)}</Text>
              </View>
            )}
            <Text className="mt-3 text-center text-[18px] font-bold text-ink">{profile.businessName}</Text>
            {profile.tradeName ? <Text className="text-center text-[12px] text-muted">{profile.tradeName}</Text> : null}
            {profile.document ? (
              <Text className="text-center text-[12px] text-muted">
                {profile.document.length > 11 ? 'CNPJ' : 'CPF'} {maskDocument(profile.document)}
              </Text>
            ) : null}
          </View>

          <View className="my-5 flex-row items-center">
            <View className="h-px flex-1 bg-line" />
            <Text className="mx-3 text-[11px] font-semibold uppercase tracking-[2px] text-muted">Comprovante</Text>
            <View className="h-px flex-1 bg-line" />
          </View>

          <Line label="Cliente" value={client.name} />
          <Line label="Data" value={`${fullDate(start)} · ${formatTime(start)}`} />

          <View className="my-3 h-px bg-line" />

          {appt.services.map((s) => (
            <Line key={s.serviceId} label={s.name} value={pkg ? 'pacote' : formatBRL(s.price)} />
          ))}

          <View className="my-3 h-px bg-line" />

          {pkg ? (
            <View className="rounded-2xl bg-status-confirmado-bg px-4 py-3">
              <Text className="text-[14px] font-semibold text-status-confirmado">Descontado do pacote</Text>
              <Text className="text-[13px] text-status-confirmado">
                {pkg.name} · Restam {remaining} de {pkg.totalSessions} sessões
              </Text>
            </View>
          ) : (
            <>
              <Line label="Total pago" value={formatBRL(appt.totalPrice)} strong />
              <Line label="Forma de pagamento" value={method ? paymentLabels[method] : '—'} />
            </>
          )}

          <View className="mt-5 items-center">
            {address ? <Text className="text-center text-[11px] leading-4 text-muted">{address}</Text> : null}
            {contact ? <Text className="text-center text-[11px] text-muted">{contact}</Text> : null}
            <Text className="mt-3 text-[13px] font-medium text-primary-dark">Obrigada pela preferência!</Text>
            <Text className="mt-1 text-[10px] tracking-wider text-muted">Nº {code}</Text>
          </View>
        </View>

        {appt.status !== 'concluido' ? (
          <View className="mt-3 flex-row items-center rounded-2xl bg-[#FBF3E4] px-3 py-2.5">
            <Ionicons name="alert-circle-outline" size={16} color="#8A6420" />
            <Text className="ml-2 flex-1 text-[12px] text-[#8A6420]">
              Este atendimento ainda não foi marcado como concluído.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 gap-2 border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Button title="Enviar texto no WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={sendText} />
        <Button
          title={sharing ? 'Gerando imagem…' : Platform.OS === 'web' ? 'Baixar imagem' : 'Compartilhar imagem'}
          icon="share-outline"
          variant="secondary"
          onPress={shareImage}
          disabled={sharing}
        />
      </View>
    </View>
  );
}
