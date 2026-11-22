# Relatório de UX — Agenda Beleza

**Data:** 21/11/2026 · **Base:** [avaliação heurística](avaliacao-heuristica.md) (Nielsen + ABNT NBR ISO 9241-11 + NBR 17060), achados de QA (`docs/qa/`) e percurso em produção com a conta de teste. **Ainda sem sessões com usuárias**: as severidades são hipóteses a confirmar com o [plano de teste](plano-teste-usabilidade.md); depois, medir com os [eventos propostos](metricas.md).

## Resumo executivo
- O app é **sólido na prevenção de erros** (conflitos, folgas, séries, offline) e fala a língua da profissional. Nenhum problema impede o uso (sem severidade 4).
- Os problemas mais sérios estão nas **duas tarefas que ela faz várias vezes por dia**: marcar um horário (o botão "Agendar" fica apagado sem dizer o que falta) e **concluir + receber** (a ação não tem destaque e "Cancelado" fica ao lado, sem confirmação).
- **Contraste baixo** em botões e textos de apoio (3:1 no botão principal) prejudica a leitura no estúdio iluminado e deixa botões ativos com cara de desabilitados.
- Para o negócio: **pedidos do link online não têm lugar próprio** na agenda, e o **link de agendamento está escondido** em Ajustes. São os dois pontos que mais afetam o valor percebido dos planos pagos.

## Priorização
Prioridade = severidade × esforço. **P1** = fazer já (sev. 3 ou sev. 2 barato) · **P2** = próximo ciclo · **P3** = quando der.

| # | ID | Problema | Sev. | Esforço | Prior. |
|---|---|---|---|---|---|
| 1 | UX-01 | Concluir/receber sem destaque no detalhe do agendamento | 3 | M | **P1** |
| 2 | UX-02 | Cancelar sem confirmação nem desfazer | 3 | P | **P1** |
| 3 | UX-03 | "Agendar" desabilitado sem dizer o que falta | 3 | P | **P1** |
| 4 | UX-04 | Contraste abaixo do AA (botão principal 3,0:1; textos 3,6:1; ocupado 1,13:1) | 3 | M | **P1** |
| 5 | UX-07 | Pedidos online pendentes sem destaque na agenda | 3 | M | **P1** |
| 6 | UX-13 | Nova cliente dentro do agendamento aceita WhatsApp incompleto | 2 | P | **P1** |
| 7 | UX-08 | Status só pela cor em cartões curtos | 2 | P | **P1** |
| 8 | UX-17 | Agenda volta para hoje depois de salvar em outro dia | 2 | P | **P1** |
| 9 | UX-09 | Link de agendamento escondido; sem "Compartilhar" | 2 | P | **P2** |
| 10 | UX-05 | Datas só até 21 dias no novo agendamento | 2 | M | **P2** |
| 11 | UX-06 | Dia sem vaga não sugere o próximo horário livre | 2 | M | **P2** |
| 12 | UX-11 | Financeiro: sem nome da cliente, filtros e cartões desalinhados, sem meses anteriores, "−" ambíguo | 2 | M | **P2** |
| 13 | UX-10 | Agenda vazia depois do primeiro acesso, sem próximos passos | 2 | M | **P2** |
| 14 | UX-15 | Detalhe abre em branco 1–2 s na web | 1 | P | P3 |
| 15 | UX-14 | Linha "Envio automático · Em breve" tocável | 1 | P | P3 |
| 16 | UX-12 | Nome do estúdio pedido duas vezes | 1 | P | P3 |
| 17 | UX-16 | "Vender pacote" com rótulos diferentes em dois lugares | 1 | P | P3 |
| 18 | — | Filtros de Clientes cortados na borda | 1 | P | P3 |

Esforço: P = pequeno (horas), M = médio (1–3 dias), G = grande.

## Problemas e recomendações por equipe

### UX-01 · Concluir e receber sem destaque (sev. 3)
**Evidência:** [agendamento-01-detalhe.jpg](evidencias/agendamento-01-detalhe.jpg) — atendimento de hoje às 09:00, confirmado: o botão mais forte é "Enviar lembrete no WhatsApp"; "Concluído" é um chip igual a "Cancelado". Código: `src/app/agendamento/[id].tsx`, bloco "Status" e `askPayment`.
**Viola:** H8 (estética e design minimalista: hierarquia), H6; ISO 9241-11 eficiência.
- **UX/UI:** quando o atendimento é de hoje ou já passou e não está concluído, mostrar um **botão principal fixo no rodapé "Concluir e receber R$ 35,00"** que abre as 4 formas de pagamento. Os chips de status viram controle secundário ("Mudar status"). Para atendimento futuro, o botão principal é "Enviar lembrete". Depois de concluir, o principal vira "Enviar comprovante".
- **Produto:** definir a "ação do momento" por estado (futuro → lembrar/confirmar; hoje/passado → concluir; concluído → comprovante/agradecer). Medir tempo entre fim do atendimento e conclusão.
- **Dev:** componente de rodapé com a ação por estado; manter `onStatus`/`finish` como estão (as confirmações já existentes continuam valendo). Evento `appointment_completed` com `minutes_after_end`.

### UX-02 · Cancelar sem confirmação nem desfazer (sev. 3)
**Evidência:** `[id].tsx` → `changeStatus('cancelado')` chama `setAppointmentStatus` direto quando não é série; o chip "Cancelado" fica colado em "Concluído".
**Viola:** H5 (prevenção de erros), H3 (controle e liberdade).
- **UX/UI:** depois de cancelar, **aviso com "Desfazer"** por ~5 s (preferível a mais uma pergunta); ou confirmação "Cancelar o horário de Larissa, hoje às 09:00?". Separar visualmente "Cancelar atendimento" (texto vermelho, no fim da tela) dos status positivos.
- **Produto:** pedir um **motivo opcional** (cliente desmarcou / não compareceu / eu desmarquei). "Não compareceu" é dado valioso para a profissional (e para lembretes futuros).
- **Dev:** `toast` com ação de desfazer chamando `setAppointmentStatus(id, statusAnterior)`; campo opcional de motivo exige coluna nova (sessão principal decide). Evento `appointment_status_reverted`.

### UX-03 · "Agendar" desabilitado sem explicação (sev. 3)
**Evidência:** [novo-01-cliente-servicos.jpg](evidencias/novo-01-cliente-servicos.jpg); `novo.tsx` `canSave` e `<Button disabled={!canSave}>`. Mesmo padrão em "Continuar" do link público e "Cadastrar cliente".
**Viola:** H9 (ajudar a reconhecer e corrigir erros), H1.
- **UX/UI:** manter o botão **tocável**; ao tocar com algo faltando, rolar até a primeira seção pendente e destacá-la ("Escolha um horário"). No rodapé, trocar "0 serviços" por um resumo do que falta ("Falta: horário").
- **Produto:** padrão único para todos os formulários do app e do link público.
- **Dev:** função `missingFields()` em `novo.tsx` reaproveitando as condições de `canSave`; `scrollTo` pela posição da seção (`onLayout`). Evento `appointment_save_blocked` com `missing`.

### UX-04 · Contraste abaixo do mínimo (sev. 3)
**Evidência:** cálculo WCAG com `src/theme/colors.ts` e o tema padrão `#C08497`: branco/primária **3,00:1**; `muted` sobre fundo **3,64:1** e sobre branco 3,86:1; selo "Pendente" 2,92:1; horário ocupado `line`/fundo **1,13:1**; WhatsApp branco/verde 3,23:1. Na ficha, "Agendar" parece desabilitado ([cliente-01-ficha.jpg](evidencias/cliente-01-ficha.jpg)).
**Viola:** NBR 17060 / WCAG 1.4.3 (4,5:1 texto normal) e 1.4.11 (3:1 componentes).
- **UX/UI:** escurecer o texto secundário (ex.: `muted` ≈ `#6F6569`, ~5,5:1); nos botões principais usar `primaryDark` como fundo ou texto escuro quando a cor não atingir 4,5:1; horários ocupados com texto legível + ícone/"ocupado" em vez de quase invisível; verde do WhatsApp mais escuro (`#1E8A55` ou similar).
- **Produto:** a escolha de cor do estúdio (Aparência) deve **garantir contraste** automaticamente.
- **Dev:** em `deriveTheme` (`src/theme/palette.ts`), calcular `onPrimary` e, se o contraste com branco/preto for < 4,5, escurecer a cor do botão até atingir (teste unitário com os 6 temas). Ajustar `muted`, `line` de texto e cores de status em `colors.ts` e `tailwind.config.js`.

### UX-07 · Pedidos online sem lugar próprio (sev. 3)
**Evidência:** `(tabs)/index.tsx` não diferencia `source = 'online'` nem conta pendentes; push só no plano Intermediário e no app instalado (Ajustes na web: "Ativo, aguardando registro do aparelho").
**Viola:** H1 (visibilidade do estado do sistema).
- **UX/UI:** faixa no topo da Agenda: **"2 pedidos pelo link aguardando você"** → lista com "Confirmar" / "Recusar" em um toque; selo "Online" no cartão. No detalhe, botão principal "Confirmar agendamento" em vez do chip.
- **Produto:** decidir se pedido não respondido em X horas gera lembrete; considerar aviso por e-mail quando não houver push. Medir tempo até confirmar.
- **Dev:** filtro `appointments.filter(a => a.source === 'online' && a.status === 'pendente' && futuro)`; contador também no ícone da aba (badge do `Tabs`).

### UX-13 · Nova cliente dentro do agendamento sem validação (sev. 2)
**Evidência:** `novo.tsx` `saveNewClient` e botão "Salvar" (`disabled={!newClient.name.trim()}`) aceitam WhatsApp "119"; `clientes/nova.tsx` exige 10–11 dígitos e nome ≥ 2 (BUG-008).
- **UX/UI:** mesma mensagem de `clientes/nova.tsx` ("WhatsApp — confira o número (DDD + número)") e máscara de telefone.
- **Dev:** extrair a regra (`phoneOk`) para `src/lib/format.ts` e usar nos dois lugares (e no link público, que já valida).

### UX-08 · Status só pela cor em cartões curtos (sev. 2)
**Evidência:** [agenda-01-dia.jpg](evidencias/agenda-01-dia.jpg) (Larissa, 09:00, 45 min); `day-timeline.tsx`.
- **UX/UI:** ícone pequeno de status (✓ confirmado, ⏳ pendente, ✔✔ concluído) ao lado do nome, que cabe em 45 min.
- **Dev:** `day-timeline.tsx`, versão compacta do cartão; `accessibilityLabel` com o status.

### UX-17 · Agenda volta para hoje depois de salvar (sev. 2)
- **UX/UI/Dev:** ao fechar o Novo agendamento, abrir a agenda no dia salvo (passar `?date=` como a notificação já faz em `index.tsx`) e destacar o cartão novo por 2 s.

### UX-09 · Link de agendamento escondido (sev. 2)
**Evidência:** único acesso em Ajustes > Dados do estúdio > "Copiar link" (`ajustes/estudio.tsx`).
- **UX/UI:** botão **"Compartilhar meu link"** (folha de compartilhamento do sistema) no fim do primeiro acesso, no estado vazio da Agenda e como linha própria em Ajustes ("Link de agendamento"). Texto pronto: "Agende seu horário comigo: <link>".
- **Produto:** é a principal alavanca de ativação e de valor dos planos pagos; meta: 40% das contas compartilham em 7 dias.
- **Dev:** `Share.share` do React Native (já vem no RN; no web, `navigator.share` com fallback para copiar). Sem dependência nova.

### UX-05 · Datas só até 21 dias (sev. 2)
- **UX/UI:** no fim da faixa de dias, um botão **"Outra data"** que abre um calendário mensal (o app já tem `range-calendar.tsx` e o calendário do link público).
- **Dev:** reaproveitar o componente; `daysAhead` passa a seguir a data escolhida.

### UX-06 · Dia sem vaga não sugere alternativa (sev. 2)
**Evidência:** [novo-02-sem-horario.jpg](evidencias/novo-02-sem-horario.jpg).
- **UX/UI:** "Nenhum horário livre neste dia. **Próximo livre: seg, 23/11 às 09:00** [Usar]".
- **Dev:** procurar nos próximos 30 dias com a mesma lógica de `slots`/`slotConflict`; marcar na faixa de datas os dias sem vaga (como o link público já faz).

### UX-11 · Financeiro (sev. 2)
**Evidência:** [financeiro-01.jpg](evidencias/financeiro-01.jpg).
- **UX/UI:** (a) linha da transação com **nome da cliente** ("Manicure · Larissa O."); (b) cartões acompanham o período escolhido (ou o filtro fica acima dos cartões e vale para tudo); (c) seletor de mês "‹ Novembro ›"; (d) botão de despesa com rótulo ("+ Despesa") em vez de "−", e espaço no fim da lista para não cobrir valores.
- **Produto:** confirmar com as usuárias (tarefa T9) o que elas conferem no fim do dia/mês.
- **Dev:** `transactions` já têm `appointmentId` → cruzar com `appointments`/`clients` na tela; `paddingBottom` da lista maior que o botão.

### UX-10 · Primeira experiência vazia (sev. 2)
- **UX/UI:** depois do primeiro acesso, cartão **"Primeiros passos"** na Agenda: ① cadastrar uma cliente ② marcar o primeiro horário ③ compartilhar o link ④ conferir preços. Oferecer "Ver com dados de exemplo" ali, e **"Remover dados de exemplo"** em Ajustes (já pedido no BUG-006).
- **Produto:** definir a métrica de ativação (1º agendamento em 24 h).
- **Dev:** estado salvo no perfil ou no aparelho; remoção dos exemplos exige marcar o que foi criado como exemplo (avaliar na sessão principal).

### Severidade 1 (P3)
- **UX-15:** skeleton/indicador ao abrir o detalhe na web.
- **UX-14:** "Envio automático (WhatsApp)" sem seta e não tocável, com selo "Em breve".
- **UX-12:** no cadastro pedir só e-mail e senha (nome do estúdio fica no passo 1) — ou mostrar o passo 1 como "Confirme o nome".
- **UX-16:** usar o mesmo rótulo "Vender pacote" nos dois lugares.
- Filtros de Clientes: deixar o último filtro parcialmente visível com sombra/gradiente, ou quebrar em duas linhas.

## Plano sugerido
1. **Agora (P1, ~1 semana de dev):** UX-01, 02, 03, 04, 07, 13, 08, 17.
2. **Teste com 3–4 profissionais** (pode ser em paralelo ao P1, com a versão atual, para ter a linha de base).
3. **Instrumentar** com a opção A de [metricas.md](metricas.md) antes do lançamento público.
4. **P2** priorizado pelo que o teste confirmar.

## Encaminhado à sessão principal
Aprovado pelo responsável em 21/11/2026: os 8 itens P1, depois os 5 P2, os 5 P3 e a instrumentação de eventos (tudo marcado).
- [x] UX-01 Botão principal "Concluir e receber" no detalhe do agendamento
- [x] UX-02 Desfazer (ou confirmar) ao cancelar; motivo opcional
- [x] UX-03 Dizer o que falta ao tocar em "Agendar" (e nos outros formulários)
- [x] UX-04 Ajustar contraste (texto secundário, botão principal, ocupados, status)
- [x] UX-07 Faixa de pedidos online pendentes na Agenda
- [x] UX-13 Validar WhatsApp da nova cliente criada no agendamento
- [x] UX-08 Ícone de status nos cartões curtos
- [x] UX-17 Voltar para o dia do agendamento salvo
- [x] UX-09 "Compartilhar meu link"
- [x] UX-05 "Outra data" com calendário
- [x] UX-06 Sugerir próximo horário livre
- [x] UX-11 Melhorias do Financeiro
- [x] UX-10 Primeiros passos + remover exemplos
- [x] Severidade 1 (UX-12, 14, 15, 16, filtros)
- [x] Instrumentação de eventos (metricas.md, opção A)

## Reteste dos itens P1 em produção (21/11/2026, commit 2c0257d)
Conta de teste, tela 375×812 no navegador embutido. Agendamento de teste criado (QA Teste, ter 24/11 17:00) e cancelado no fim; nenhuma forma de pagamento escolhida.

| ID | Resultado | Evidência |
|---|---|---|
| UX-01 | ✅ **Corrigido no commit 653c3af (BUG-017) e conferido em produção:** Pix, Crédito, Débito e Dinheiro aparecem limpos e "Mudar status" fica logo abaixo, sempre visível ([reteste-ux01-corrigido.jpg](evidencias/reteste-ux01-corrigido.jpg)). No 1º reteste estava quebrado: "Concluir e receber R$ 35,00" aparece certo, mas ao tocar nele cada botão Pix/Crédito/Débito/Dinheiro vem coberto por "MUDAR STATUS · Pendente · Confirmado · Concluído": o bloco de status foi colado dentro do botão de pagamento (`[id].tsx`, l. 369–391, dentro do `METHODS.map`). Fora do pagamento, "Mudar status" não aparece: não dá para confirmar manualmente um agendamento feito no app nem desfazer uma conclusão pelos chips. Mesmo problema do BUG-017 do QA. | [reteste-ux01-pagamento-quebrado.jpg](evidencias/reteste-ux01-pagamento-quebrado.jpg) |
| UX-02 | ✅ "Cancelar atendimento" em vermelho no fim da tela; aviso "Atendimento cancelado · Desfazer"; Desfazer voltou para Pendente. Motivo opcional não feito (precisa de coluna nova). | (sem print: a tela mostra o telefone da cliente de teste) |
| UX-03 | ✅ "Agendar" tocável; aviso e rodapé "Falta: cliente, serviço". | [reteste-ux03-falta.jpg](evidencias/reteste-ux03-falta.jpg) |
| UX-04 | ✅ no que foi visto: textos secundários mais escuros, botão principal em tom mais fechado. Faltou medir os outros 5 temas na tela (há testes unitários). | — |
| UX-07 | ✅ Faixa "1 pedido pelo link aguardando você", lista com Confirmar/Recusar e número no ícone da Agenda. | [reteste-agenda-faixa-pedidos.jpg](evidencias/reteste-agenda-faixa-pedidos.jpg), [reteste-lista-pedidos.jpg](evidencias/reteste-lista-pedidos.jpg) |
| UX-08 | ✅ Ícones de status nos cartões curtos; leitor de tela diz "Larissa Oliveira, 09:00, Manicure, Confirmado". | idem |
| UX-13 | ✅ Nome "Q" e WhatsApp "119" recusados: "Confira os dados da cliente", rótulo "confira o número". | [reteste-ux13-nova-cliente.jpg](evidencias/reteste-ux13-nova-cliente.jpg) |
| UX-17 | ✅ Agendamento salvo para ter 24/11 a partir da agenda de hoje → Agenda abriu em 24/11 com "Agendamento salvo". Destaque de 2 s não feito. | — |

**Novos achados menores (sev. 1–2), encaminhados à sessão principal em 21/11/2026 a pedido do responsável:**
- UX-18 (2): atendimento **cancelado** continua mostrando "Enviar lembrete no WhatsApp" como botão principal e "Enviar confirmação" (depois do BUG-017, "Mudar status" voltou e permite reativar).
- UX-19 (1): a linha da hora atual na Agenda passa por cima do nome no cartão em andamento e parece texto riscado ("Larissa Oliveira" às 09:00).
- UX-20 (1): campo Observações do Novo agendamento é lido pelo exemplo ("Ex: trazer referência…"), não pelo rótulo.

## Reteste dos itens P2, P3 e UX-18 a 20 em produção (21/11/2026, commit 414d88b)
Conta de teste, tela 375×812 no navegador embutido. Nada foi salvo nem apagado; "Remover dados de exemplo" não foi executado.

| ID | Resultado |
|---|---|
| UX-09 | ✅ "Compartilhar meu link" no dia vazio da Agenda e "Compartilhar link de agendamento" em Ajustes. O fim do primeiro acesso não foi visto (precisa de conta nova); conferido no código. |
| UX-06 | ✅ Domingo (dia fechado), Manicure: "Próximo livre: Seg, 23 de novembro às 13:00" → "Usar" preenche dia e horário ("Das 13:00 às 13:45"). |
| UX-05 | ✅ "Outra data" → dezembro → 18/12: o dia fica selecionado. ⚠️ A faixa de dias rola até o fim (22–25/12) e o dia escolhido fica fora da vista. |
| UX-11 | ✅ Seletor "‹ Novembro 2026 ›"; cartões seguem o período ("Faturamento no mês", "Atendimentos pagos 19"); nome da cliente na transação ("Manicure · QA T."); "+ Despesa". ❌ **Regressão:** o título quebrou em "Financei / ro" e o subtítulo em "Novembro de / 2026", porque os botões "Exportar" e "Vender pacote" ocupam a largura ([reteste2-financeiro-titulo-quebrado.jpg](evidencias/reteste2-financeiro-titulo-quebrado.jpg)). |
| UX-10 | ✅ "Primeiros passos" não aparece na conta de teste (tem atendimentos próprios), como esperado. A confirmação de remover exemplos avisa que saem todos os atendimentos e receitas das clientes de exemplo (código). O item só aparece com exemplos marcados; os exemplos antigos da conta de teste não têm a marca. |
| UX-15 | ❌ **Não resolvido:** abrindo o detalhe direto pela URL, a tela fica em branco (só o cabeçalho) e não aparece "Carregando agendamento…". O branco não vem do `loading` do store. |
| UX-14 | ✅ "Envio automático (WhatsApp), em breve" não é mais botão. |
| UX-16 | ✅ "Vender pacote" no Financeiro (mas ver a regressão do título em UX-11). |
| Filtros | ✅ Filtros de Clientes em duas linhas. |
| UX-12 | Não visto (precisa de conta nova); conferido no código ("Confirme o nome do estúdio"). |
| UX-18 | ✅ Cancelado: "Atendimento cancelado: lembretes e confirmação não se aplicam." e "Mudar status" disponível. |
| UX-19 | ✅ A linha da hora atual passa por trás do cartão; o nome não parece mais riscado. |
| UX-20 | ✅ Campo lido como "Observações (opcional)" (código e árvore de acessibilidade). |

## Reteste das correções finais e da medição (21/11/2026, commit faab3b2)
| Item | Resultado |
|---|---|
| Financeiro em 375 px | ✅ Título "Financeiro" em uma linha; "Exportar" e "Vender pacote" numa linha abaixo ([reteste3-financeiro-titulo-ok.jpg](evidencias/reteste3-financeiro-titulo-ok.jpg)). |
| BUG-018 | ✅ Ajustes mostra "Aparência e cores · Rosé Antigo"; na tela de Aparência, "Rosé Antigo" aparece marcada. |
| UX-05 (faixa de dias) | ❌ Continua: depois de escolher 18/12 em "Outra data", o dia fica selecionado, mas a faixa termina no fim (scrollLeft 2009 de 2009, mostrando 22–25/12). Causa provável: ao fechar o calendário, o navegador devolve o foco ao botão "Outra data", que fica no fim da faixa, e rola até ele. |
| UX-15 (tela em branco) | ⚠️ Medido: tocando no cartão, o cabeçalho "Agendamento" aparece na hora e o conteúdo ~0,3 s depois; abrindo direto pela URL, ~0,7 s depois de a página carregar (~1,2 s no total). Causa: o código da tela (`[id]-….js`) só é baixado no primeiro toque (divisão do código por rota na web). Medição com o painel do navegador oculto; no celular nativo não acontece. |
| Medição de uso | ✅ Eventos chegando: depois de abrir o Novo agendamento, tocar em "Agendar" vazio e voltar, o app enviou o lote para `app_events` com resposta 201 e a fila do aparelho ficou vazia. Consultas de análise em [consultas-eventos.sql](consultas-eventos.sql). |

## Reteste UX-05 e UX-15 (21/11/2026, commit da0c7ff)
| Item | Resultado |
|---|---|
| UX-05 | ✅ "Outra data" fica ao lado do rótulo "Data". Escolhendo 18/12, o dia aparece selecionado e visível na faixa (scrollLeft 1600 de 1937) ([reteste4-outra-data-ok.jpg](evidencias/reteste4-outra-data-ok.jpg)). |
| UX-15 | ✅ Saindo da Agenda: os arquivos do detalhe e do Novo agendamento são baixados ~2,5 s depois que a Agenda abre; tocando no cartão, o conteúdo aparece em ~50 ms (antes, ~300 ms com a tela em branco). Abrindo o detalhe direto pela URL, o intervalo continua (aceito: caso raro e só na web). |

**Situação:** todos os itens do relatório (P1, P2, P3, UX-18 a 20, BUG-018) e a medição de uso estão em produção e conferidos. Próximo passo: teste com as profissionais ([plano-teste-usabilidade.md](plano-teste-usabilidade.md)) e as consultas de [consultas-eventos.sql](consultas-eventos.sql) quando houver uso real.

## Medição de uso: privacidade e exclusão de conta (22/11/2026)
Com os eventos indo também ao PostHog e os erros ao Sentry (commits eab8b92, 8636033 e ee6a7de), foi conferido que a promessa da Política de Privacidade vale na prática.

| Verificação | Resultado |
|---|---|
| Política no ar (`/privacidade`) | ✅ "Última atualização: 21 de novembro de 2026". A seção 6 traz a retenção de cada lugar: banco até 13 meses; PostHog até 12 meses (+ limpeza mensal); Sentry até 90 dias. |
| Segredos da função `delete-account` | ✅ `POSTHOG_PERSONAL_API_KEY` e `POSTHOG_PROJECT_ID` cadastrados (21/11, 14:20 UTC). A primeira chave dava 401 (BUG-021); trocada por uma com escrita em pessoas, só no projeto padrão. |
| Função publicada | ✅ `delete-account` versão 5, publicada 21/11 às 14:20:54 UTC, depois do código novo. |
| Exclusão apaga no PostHog (CT-TEL-04, QA) | ✅ Conta descartável: eventos enviados, pessoa encontrada em Persons, exclusão com resposta 200, pessoa removida de Persons. Os eventos são apagados pelo PostHog em segundo plano. |
| Nada sobra no banco | ✅ VAL-17 (dados sem perfil) = 0 e VAL-18 (perfil sem login) = 0, rodadas em produção em transação somente leitura. |

Detalhes do teste em `docs/qa/bugs.md` (BUG-021) e no caso CT-TEL-04.
