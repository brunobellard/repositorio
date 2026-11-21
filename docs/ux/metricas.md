# Análise de comportamento: o que medir e como

## Situação hoje
**Não há nenhuma ferramenta de analytics no app** (conferido em `package.json` e em `src/`: nada de PostHog, Amplitude, Firebase, Segment ou Sentry). O que existe são os próprios dados do Supabase (agendamentos, transações, `source = 'online'`, datas de criação), que já respondem algumas perguntas sem instalar nada (seção 4).

## 1. Perguntas que os dados precisam responder
Cada pergunta liga um achado da [avaliação heurística](avaliacao-heuristica.md) a um número que confirma ou derruba a hipótese.

| Achado | Pergunta | Métrica | Sinal de problema |
|---|---|---|---|
| UX-03 | Quem começa um agendamento consegue terminar? | Conclusão do Novo agendamento = salvos ÷ aberturas; toques no "Agendar" desabilitado, por campo faltante | Conclusão < 85% ou > 10% de toques no botão desabilitado |
| UX-01 | Concluir é rápido e acontece no dia? | Tempo entre o fim do atendimento e a conclusão; % concluídos no mesmo dia; % que nunca são concluídos | Mediana > 2 h ou > 20% esquecidos |
| UX-02 | Há cancelamentos por engano? | % de cancelados que voltam a outro status em até 2 min | > 3% |
| UX-07 | Pedidos online são respondidos a tempo? | Tempo entre o pedido online (`source='online'`, pendente) e a confirmação | Mediana > 4 h; pendentes que passam do horário |
| UX-05 | Precisam marcar longe? | Distribuição de dias de antecedência; usos do caminho "agenda → dia → +" para > 21 dias | > 10% acima de 21 dias |
| UX-06 | Dias sem vaga atrapalham? | Trocas de dia na mesma abertura do formulário | Média > 2 trocas |
| UX-09 | O link é divulgado? | % de contas que copiam/compartilham o link em 7 dias; agendamentos online por conta | < 40% em 7 dias |
| UX-10 | A conta "pega"? | Ativação: 1º agendamento em 24 h e 5 agendamentos em 7 dias; uso de dados de exemplo | Ativação < 50% |
| UX-11 | O Financeiro é usado? | Aberturas do Financeiro por semana; troca de filtro; exportações | Pouco uso apesar de receitas lançadas |
| Link público | Onde as clientes desistem? | Funil: abriu → escolheu serviço → escolheu data/hora → abriu "Seus dados" → confirmou; erros no envio | Queda > 40% em uma etapa |
| Geral | O app vira hábito? | Profissionais ativas por semana (WAU), retenção D7/D30, dias com pelo menos 1 agendamento criado | D30 < 30% |

## 2. Eventos propostos
Nome em `snake_case`, sempre com `ts`, `account_id` (id interno, nunca e-mail), `platform` (ios/android/web), `app_version`, `session_id`.
**Nunca** enviar nome, telefone, e-mail, endereço ou observações de clientes nem texto digitado.

| Evento | Propriedades | Onde disparar |
|---|---|---|
| `onboarding_step_completed` | `step` (1–3), `duration_ms`, `specialty`, `service_mode` | `onboarding.tsx` → `next()` |
| `onboarding_completed` | `total_ms` | idem, passo 3 |
| `example_data_loaded` | — | `ajustes.tsx` |
| `appointment_form_opened` | `origin` (fab, slot, empty_state, client_file, edit), `days_ahead` | `agendamento/novo.tsx` (montagem) |
| `appointment_save_blocked` | `missing` (client, service, time, address, package) | toque no "Agendar" desabilitado (exige trocar `disabled` por aviso) |
| `appointment_saved` | `duration_ms`, `origin`, `days_ahead`, `n_services`, `series_count`, `used_package`, `outside_hours`, `day_changes`, `created_client_inline` | `create()` |
| `appointment_form_abandoned` | `duration_ms`, `filled` (client/service/date/time) | saída sem salvar |
| `appointment_status_changed` | `from`, `to`, `minutes_from_start`, `source` (manual/online) | `agendamento/[id].tsx` |
| `appointment_completed` | `method`, `minutes_after_end`, `package` | `finish()` |
| `appointment_status_reverted` | `from`, `to`, `seconds_since_change` | mudança de status logo depois de outra |
| `online_booking_confirmed` | `minutes_since_request` | pendente online → confirmado |
| `booking_link_copied` / `booking_link_shared` | `place` (estudio, agenda, onboarding) | `ajustes/estudio.tsx` |
| `package_sold` | `sessions`, `origin` (finance, client_file) | `pacote/novo.tsx` |
| `finance_viewed` | `period` | `financeiro.tsx` |
| `finance_exported` | `format` | `export-sheets.tsx` |
| `upgrade_prompt_shown` / `plans_viewed` | `feature` | `lib/upgrade.ts`, `ajustes/assinatura.tsx` |
| **Link público** (sem login, id anônimo por visita) `public_link_viewed`, `public_services_selected`, `public_datetime_selected`, `public_details_viewed`, `public_booking_submitted`, `public_booking_failed` | `slug`, `n_services`, `days_ahead`, `error` | `agendar/[slug].tsx` |

## 3. Como implementar (recomendação; nada foi instalado)
**Opção A — recomendada para começar: tabela própria no Supabase.**
- Uma tabela `app_events (id, account_id, name, props jsonb, platform, app_version, session_id, created_at)`, só `insert` para o próprio usuário (RLS), sem leitura pelo app; e uma função `log_public_event` para o link público (sem login, com limite de taxa e sem dados pessoais).
- Um módulo `src/lib/analytics.ts` com `track(name, props)` que junta os eventos e envia em lote; sem internet, guarda no AsyncStorage (já instalado) como a fila offline.
- **Sem dependência nova**, os dados ficam no mesmo controlador já descrito na Política de Privacidade, e a análise é feita em SQL (exemplos na seção 4).
- Custo: o espaço no banco (pequeno; dá para apagar eventos com mais de 13 meses).

**Opção B — ferramenta pronta (ex.: PostHog, que tem SDK para React Native/Expo).** Dá funis, retenção e gravação de sessão prontos, mas é um terceiro recebendo dados (atualizar a Política de Privacidade, avaliar transferência internacional, e no link público pedir consentimento para cookies). Vale quando houver volume de usuárias.

**Firebase Analytics** exige configuração nativa e build próprio; não recomendo neste momento.

**LGPD:** a medição do uso pela própria profissional pode usar legítimo interesse (art. 7º, IX), desde que a Política de Privacidade diga o que é coletado e para quê, e que não entrem dados das clientes dela. No link público, eventos anônimos sem cookie de rastreamento.

## 4. Já dá para medir hoje, só com SQL (somente leitura)
Exemplos para rodar no SQL Editor quando houver usuárias reais (o nome das colunas deve ser conferido no esquema; ajuste se preciso):

```sql
-- Tempo até confirmar pedidos do link online (UX-07)
-- (precisa de um registro de quando mudou o status; hoje só há created_at/updated_at)
select percentile_cont(0.5) within group (order by extract(epoch from (updated_at - created_at))/3600) as horas_mediana
from appointments
where source = 'online' and status in ('confirmado','concluido');

-- Atendimentos que já passaram e nunca foram concluídos nem cancelados (UX-01)
select count(*) filter (where status in ('pendente','confirmado')) * 100.0 / count(*) as pct_esquecidos
from appointments
where ends_at < now() - interval '1 day';

-- Antecedência dos agendamentos (UX-05)
select width_bucket(extract(day from starts_at - created_at), 0, 60, 6) as faixa, count(*)
from appointments group by 1 order by 1;
```

## 5. Como cruzar com o qualitativo
1. **Antes do lançamento:** o teste com 3–4 profissionais dá o "porquê" (falas, onde travou) e números pequenos (tempo, toques, SEQ, SUS).
2. **Depois de liberar com os eventos:** os números dizem "com que frequência" e "para quantas pessoas". Para cada UX-xx, comparar o sinal da tabela 1 com o que se viu nas sessões:
   - aparece nos dois → manter/subir a severidade;
   - só na sessão → pode ser efeito do ambiente de teste; acompanhar;
   - só nos dados → chamar 1–2 usuárias para uma conversa curta e entender.
3. Depois de cada correção, comparar a métrica antes × depois (ex.: conclusão do Novo agendamento, tempo até concluir).
