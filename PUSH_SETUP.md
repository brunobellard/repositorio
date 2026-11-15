# Notificações push de agendamentos online

Quando uma cliente agenda pelo link público, o banco chama a Edge Function
`notify-new-booking`, que envia um push para o celular da profissional:

```
cliente agenda no link ──► INSERT em appointments (source = 'online')
                              │  (gatilho / Database Webhook)
                              ▼
                 Edge Function notify-new-booking
                              │  busca profiles.expo_push_token
                              ▼
               Expo Push API ──► celular: "Novo Agendamento Online ✨"
```

Projeto Supabase: `ngdkapueqwvbivghbssl`

---

## 1. Rodar a migração

No **SQL Editor** do Supabase, execute
`supabase/migrations/20261120000000_blindagem_rls_e_push.sql`.

## 2. Publicar a Edge Function

No terminal, na pasta do projeto (PowerShell: use `npx.cmd`):

```bash
npx supabase login
```

Gere um segredo para o webhook (guarde-o, ele é usado no passo 3):

```powershell
[guid]::NewGuid().ToString("N")
```

Salve o segredo na função e publique:

```bash
npx supabase secrets set WEBHOOK_SECRET=COLE_O_SEGREDO_AQUI --project-ref ngdkapueqwvbivghbssl
```

```bash
npx supabase functions deploy notify-new-booking --no-verify-jwt --project-ref ngdkapueqwvbivghbssl
```

`--no-verify-jwt` é necessário porque o webhook do banco não envia login de usuário.
A função se protege exigindo o cabeçalho `x-webhook-secret`. Sem ele, responde `401`.

## 3. Ligar o INSERT de `appointments` à função

**Opção A, por SQL (recomendada, não depende do painel):**
cole no **SQL Editor**, trocando `COLE_O_SEGREDO_AQUI` pelo mesmo segredo do passo 2.

```sql
-- Extensão que permite ao banco fazer chamadas HTTP
create extension if not exists pg_net with schema extensions;

-- Chama a Edge Function com os dados do agendamento recém-criado
create or replace function notify_new_booking()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url     := 'https://ngdkapueqwvbivghbssl.supabase.co/functions/v1/notify-new-booking',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', 'COLE_O_SEGREDO_AQUI'),
    body    := jsonb_build_object(
                 'type', 'INSERT', 'table', 'appointments', 'record', to_jsonb(new))
  );
  return new;
end;
$$;
revoke execute on function notify_new_booking() from public, anon, authenticated;

-- Dispara só para agendamentos feitos pela cliente no link
drop trigger if exists notify_new_booking on public.appointments;
create trigger notify_new_booking
after insert on public.appointments
for each row
when (new.source = 'online')
execute function notify_new_booking();
```

A chamada HTTP é enviada depois que o agendamento é salvo. Se a função falhar,
o agendamento da cliente **não** é afetado.

**Opção B, pelo painel:** no menu principal da esquerda, **Integrations → Database Webhooks**
(nas versões novas o item saiu de "Database") → **Create a new hook**:

| Campo | Valor |
|---|---|
| Table | `appointments` |
| Events | `Insert` |
| Type | `Supabase Edge Functions` → `notify-new-booking` (POST) |
| HTTP Headers | `x-webhook-secret: COLE_O_SEGREDO_AQUI` |

Use **só uma** das opções, A ou B. Com as duas, o push chega duplicado.

Como a Opção B não filtra por origem, a própria função ignora tudo que não for agendamento online.

## 4. Receber o push no celular

- **Android:** desde o SDK 53, o **Expo Go não recebe push remoto**. É preciso uma
  *development build* do app (o "Expo Go" personalizado do seu projeto) e credenciais
  FCM V1 do Firebase cadastradas na Expo (`npx eas-cli credentials`).
- **iPhone:** precisa de conta Apple Developer (paga) e das credenciais APNs, que
  o EAS gera no primeiro `eas build`.
- Em **Ajustes → Notificações**, mantenha "Avisar agendamentos online" ligado.
  O app registra o aparelho sozinho ao entrar. O botão **Enviar notificação de teste**
  confere se o aparelho recebe.

## 5. Testar o fluxo completo

1. Abra o link público (`https://projeto-app-beleza.expo.app/agendar/<seu-link>`) e agende.
2. O push chega em segundos. Tocar nele abre a **Agenda** no dia do agendamento.
3. Se não chegar: Supabase → **Edge Functions → notify-new-booking → Logs**.
   - `401`: o segredo do webhook não confere com o `WEBHOOK_SECRET`.
   - `skipped: push desativado ou aparelho não registrado`: o celular não salvou o token
     (veja o item 4).
