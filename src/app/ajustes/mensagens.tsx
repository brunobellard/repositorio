import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Card, Segmented } from '@/components/ui';
import { EMAIL_SENDING_ENABLED } from '@/constants/plans';
import { useStore } from '@/data/store';
import { notify } from '@/lib/confirm';
import { colors } from '@/theme/colors';
import type { MessageChannel, MessageKind, MessageTemplate } from '@/types';

const KIND_LABEL: Record<MessageKind, string> = {
  lembrete: 'Lembrete',
  confirmacao: 'Confirmação',
  recibo: 'Recibo',
  reativacao: 'Chamar de volta',
  aniversario: 'Aniversário',
};

/** Variáveis aceitas por cada tipo de mensagem */
const KIND_VARS: Partial<Record<MessageKind, string>> = {
  reativacao: '{nome} {dias} {ultimo_servico} {estudio} {endereco} {instagram}',
  aniversario: '{nome} {estudio} {endereco} {instagram}',
};

const KIND_ORDER: MessageKind[] = ['confirmacao', 'lembrete', 'recibo', 'reativacao', 'aniversario'];

function TemplateEditor({ template }: { template: MessageTemplate }) {
  const { updateTemplate } = useStore();
  const [subject, setSubject] = useState(template.subject ?? '');
  const [body, setBody] = useState(template.body);
  const dirty = body !== template.body || subject !== (template.subject ?? '');

  return (
    <Card className="mb-3">
      <Text className="text-[15px] font-semibold text-ink">{KIND_LABEL[template.kind]}</Text>
      <Text className="mb-2 text-[11px] text-muted">
        {KIND_VARS[template.kind] ?? '{nome} {servico} {data} {hora} {valor} {estudio} {endereco}'}
      </Text>
      {template.channel === 'email' ? (
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder="Assunto"
          placeholderTextColor={colors.muted}
          className="mb-2 rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] text-ink"
        />
      ) : null}
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        className="min-h-[96px] rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] leading-5 text-ink"
        style={{ textAlignVertical: 'top' }}
      />
      {dirty ? (
        <View className="mt-3">
          <Button
            title="Salvar modelo"
            onPress={async () => {
              const ok = await updateTemplate({
                ...template,
                body,
                subject: template.channel === 'email' ? subject : undefined,
              });
              if (ok) notify('Modelo salvo');
            }}
          />
        </View>
      ) : null}
    </Card>
  );
}

export default function ModelosMensagem() {
  const { templates } = useStore();
  const [channel, setChannel] = useState<MessageChannel>('whatsapp');

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      {/* Modelos de e-mail só quando o envio real estiver ligado */}
      {EMAIL_SENDING_ENABLED ? (
        <Segmented
          value={channel}
          onChange={setChannel}
          options={[
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'email', label: 'E-mail' },
          ]}
        />
      ) : null}
      <Text className="mb-4 mt-3 text-[13px] leading-5 text-muted">
        As palavras entre chaves (variáveis, listadas em cada modelo) são trocadas pelos dados da cliente e do
        agendamento na hora do envio.
      </Text>
      {templates
        .filter((t) => t.channel === channel)
        .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
        .map((t) => (
          <TemplateEditor key={`${t.channel}-${t.kind}`} template={t} />
        ))}
    </ScrollView>
  );
}
