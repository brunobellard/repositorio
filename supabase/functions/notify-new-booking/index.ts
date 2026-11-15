// Supabase Edge Function: avisa a profissional (push) quando uma cliente agenda pelo link online.
//
// Chamada pelo gatilho do banco (Database Webhook) a cada INSERT em appointments.
// Veja o passo a passo em PUSH_SETUP.md.
//
// Segurança:
//   * A função é publicada com --no-verify-jwt (o webhook do banco não envia JWT de usuário),
//     então ela exige o cabeçalho x-webhook-secret igual ao segredo WEBHOOK_SECRET.
//   * Usa a service role só no servidor, para ler o token de push do dono do agendamento.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

interface AppointmentRecord {
  id: string;
  owner_id: string;
  client_id: string;
  starts_at: string;
  status: string;
  source: string;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: AppointmentRecord | null;
}

/** Consulta a API REST do Supabase com a service role (ignora RLS, só no servidor). */
async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }

  const payload = (await req.json()) as WebhookPayload;
  const appt = payload.record;
  // Só novos agendamentos feitos pela cliente no link público
  if (payload.type !== 'INSERT' || payload.table !== 'appointments' || !appt || appt.source !== 'online') {
    return json({ skipped: true });
  }

  try {
    const [profile] = await rest<
      { expo_push_token: string | null; push_notifications_enabled: boolean; timezone: string }[]
    >(`profiles?id=eq.${appt.owner_id}&select=expo_push_token,push_notifications_enabled,timezone`);
    if (!profile?.expo_push_token || !profile.push_notifications_enabled) {
      return json({ skipped: 'push desativado ou aparelho não registrado' });
    }

    const [[client], services] = await Promise.all([
      rest<{ name: string }[]>(`clients?id=eq.${appt.client_id}&select=name`),
      rest<{ name: string }[]>(
        `appointment_services?appointment_id=eq.${appt.id}&select=name&order=position`,
      ),
    ]);

    // Data e hora no fuso do estúdio
    const tz = profile.timezone || 'America/Sao_Paulo';
    const start = new Date(appt.starts_at);
    const date = new Intl.DateTimeFormat('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit' }).format(start);
    const time = new Intl.DateTimeFormat('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(start);
    // 'YYYY-MM-DD' no fuso do estúdio, para o app abrir a Agenda no dia certo
    const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(start);

    const firstName = (client?.name ?? 'Uma cliente').split(' ')[0];
    const serviceNames = services.map((s) => s.name).join(' + ') || 'um horário';
    const pending = appt.status === 'pendente';

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.expo_push_token,
        title: 'Novo Agendamento Online ✨',
        body: `${firstName} agendou ${serviceNames} para ${date} às ${time}${pending ? ' · confirme no app' : ''}`,
        sound: 'default',
        priority: 'high',
        channelId: 'agendamentos',
        data: { type: 'new_booking', appointmentId: appt.id, date: isoDay },
      }),
    });
    const result = await res.json();

    // Aparelho desinstalou o app / token inválido: limpa para não tentar de novo
    const ticket = Array.isArray(result?.data) ? result.data[0] : result?.data;
    if (ticket?.details?.error === 'DeviceNotRegistered') {
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${appt.owner_id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expo_push_token: null }),
      });
    }

    return json({ sent: true, ticket });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
