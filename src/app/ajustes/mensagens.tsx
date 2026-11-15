import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Card, Segmented } from '@/components/ui';
import { useStore } from '@/data/store';
import { notify } from '@/lib/confirm';
import { colors } from '@/theme/colors';
import type { MessageChannel, MessageKind, MessageTemplate } from '@/types';

const KIND_LABEL: Record<MessageKind, string> = {
  lembrete: 'Lembrete',
  confirmacao: 'Confirmação',
  recibo: 'Recibo',
};

function TemplateEditor({ template }: { template: MessageTemplate }) {
  const { updateTemplate } = useStore();
  const [subject, setSubject] = useState(template.subject ?? '');
  const [body, setBody] = useState(template.body);
  const dirty = body !== template.body || subject !== (template.subject ?? '');

  return (
    <Card className="mb-3">
      <Text className="mb-2 text-[15px] font-semibold text-ink">{KIND_LABEL[template.kind]}</Text>
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
      <Segmented
        value={channel}
        onChange={setChannel}
        options={[
          { value: 'whatsapp', label: 'WhatsApp' },
          { value: 'email', label: 'E-mail' },
        ]}
      />
      <Text className="mb-4 mt-3 text-[13px] leading-5 text-muted">
        Use as variáveis {'{nome}'}, {'{servico}'}, {'{data}'}, {'{hora}'}, {'{valor}'}, {'{estudio}'} e {'{endereco}'}. Elas são
        trocadas pelos dados do agendamento na hora do envio.
      </Text>
      {templates
        .filter((t) => t.channel === channel)
        .map((t) => (
          <TemplateEditor key={`${t.channel}-${t.kind}`} template={t} />
        ))}
    </ScrollView>
  );
}
