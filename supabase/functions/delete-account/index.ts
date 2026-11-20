// Supabase Edge Function: exclui permanentemente a conta de quem está logado
// (exigência da App Store e do Google Play).
//
// Publicar (com verificação de JWT, que é o padrão):
//   npx supabase functions deploy delete-account
//
// Segurança:
//   * Só aceita o JWT da própria usuária (cabeçalho Authorization enviado pelo app).
//     A conta apagada é sempre a dona do token; nada vem do corpo da requisição.
//   * A service role fica só no servidor (variável SUPABASE_SERVICE_ROLE_KEY,
//     já disponível nas Edge Functions). Nunca vai para o app.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// A versão web do app chama a função de outro domínio
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Não autenticado' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Confere o JWT e descobre quem é a usuária
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: 'Sessão inválida. Entre de novo e tente outra vez.' }, 401);

  try {
    // 1. Arquivos do Storage (logo do estúdio): pasta <user.id>/ do bucket logos
    const { data: files } = await admin.storage.from('logos').list(user.id, { limit: 1000 });
    if (files?.length) {
      await admin.storage.from('logos').remove(files.map((f) => `${user.id}/${f.name}`));
    }

    // 2. Dados do estúdio e o login numa única operação do banco (tudo ou nada; ver
    //    delete_account na migração). Antes eram duas etapas: se a segunda falhasse,
    //    a conta ficava vazia mas continuava existindo.
    const { error: deleteError } = await admin.rpc('delete_account', { p_owner: user.id });
    if (deleteError) throw deleteError;

    return json({ ok: true });
  } catch (e) {
    console.error('delete-account', user.id, e);
    return json({ error: 'Não foi possível excluir a conta agora. Tente de novo em instantes.' }, 500);
  }
});
