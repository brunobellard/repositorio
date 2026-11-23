# Avaliação heurística — Esmero

**Data:** 21/11/2026 · **Avaliador:** sessão de UX (1 avaliador; recomenda-se repetir com mais 2 pessoas para cobrir ~75% dos problemas, segundo Nielsen)
**Versão avaliada:** produção (https://projeto-app-beleza.expo.app), commit `8577ac6`, conta de teste com dados de exemplo, tela de celular 375×812 no navegador embutido + leitura do código em `src/app/` e `src/components/`.
**Referências:**
- 10 heurísticas de Nielsen (H1–H10).
- ABNT NBR ISO 9241-11:2021 — usabilidade = **eficácia** (completar a tarefa corretamente), **eficiência** (recursos gastos: toques, tempo, esforço) e **satisfação**, num contexto de uso definido.
- ABNT NBR 17060:2022 (acessibilidade em aplicativos móveis) e WCAG 2.2 AA (contraste 4,5:1 para texto normal, 3:1 para texto grande e componentes).
- Achados de QA já registrados em `docs/qa/bugs.md` (BUG-001 a BUG-016, todos fechados) — não repetidos aqui, salvo quando ainda afetam a usabilidade.

## Contexto de uso (ISO 9241-11, item 5)
| Elemento | Hipótese de trabalho (ainda não há usuárias; validar no teste) |
|---|---|
| Usuárias | Profissionais autônomas de beleza (manicure, lash, sobrancelha), 20–50 anos, uso intenso de WhatsApp e Instagram, pouca paciência para "sistema". |
| Tarefas | Marcar/remarcar horário enquanto conversa no WhatsApp; concluir o atendimento e registrar o pagamento logo após; consultar o dia; olhar quanto ganhou. |
| Ambiente | Celular, muitas vezes com uma mão, entre um atendimento e outro, luvas/unhas recém-feitas, estúdio bem iluminado (reflexo), interrupções frequentes. |
| Equipamento | Android intermediário (maioria) e iPhone; também web. |

## Escala de severidade (Nielsen)
0 não é problema · 1 cosmético · 2 menor (corrigir com baixa prioridade) · 3 maior (prioridade alta) · 4 catástrofe (corrigir antes de lançar).
Severidade = frequência × impacto × persistência.

## Pontos fortes (manter)
- **Prevenção de erro no agendamento** (H5): conflito de horário, folga, fora do expediente, série com datas em conflito ("pular datas com conflito"), confirmação ao concluir antes do horário, toque duplo bloqueado.
- **Linguagem do domínio** (H2): "Para chamar de volta", "Pago com pacote", "Faturamento do dia", "Lucro líquido real… já sem taxas".
- **Link público** enxuto: 3 etapas com indicador de progresso, dias com horário livre em destaque, resumo antes de confirmar e aviso de privacidade ([link-01](evidencias/link-01-servicos.jpg), [link-02](evidencias/link-02-data.jpg), [link-03](evidencias/link-03-dados.jpg)).
- **Visibilidade do estado offline** (H1): fila, "salvo no aparelho", "Sincronizado com a nuvem".
- **Acessibilidade para leitor de tela** já tratada pelo QA (BUG-003, 009, 013, 014).
- **Primeiro acesso** em 3 passos, com serviços pré-preenchidos por especialidade.

## Achados por fluxo

### 1. Cadastro e primeiro acesso
| ID | Achado | Heurística / ISO | Sev. |
|---|---|---|---|
| UX-10 | Ao concluir o primeiro acesso a agenda abre **vazia**, sem próximos passos. "Carregar dados de exemplo" fica no fim de Ajustes e não há "Remover dados de exemplo". O link de agendamento criado no passo 1 não volta a aparecer. | H10, H6 · satisfação, eficácia na 1ª semana | 2 |
| UX-12 | "Criar conta" pede *Nome do estúdio* e *Seu nome*; o passo 1 pede o nome do estúdio de novo (vem preenchido, mas parece repetição). | H8 · eficiência | 1 |

### 2. Agenda (aba inicial)
| ID | Achado | Heurística / ISO | Sev. |
|---|---|---|---|
| UX-07 | **Pedidos do link online não têm lugar próprio.** Um agendamento "Pendente" feito pela cliente aparece só como mais um cartão (cor da barra). O aviso por push exige o plano Intermediário e o app instalado (na web aparece "Ativo, aguardando registro do aparelho"). Não há contador "X pedidos para confirmar". Risco: cliente sem resposta, horário perdido. | H1 · eficácia | 3 |
| UX-08 | Cartões de até 45 min mostram só nome e serviço: o status fica apenas na **cor** da barra lateral (Larissa 09:00 em [agenda-01](evidencias/agenda-01-dia.jpg)). Informação só por cor fere WCAG 1.4.1 e a pessoa precisa abrir o cartão para saber se está confirmado. | H1, H6 · eficiência; NBR 17060 | 2 |
| UX-17 | Depois de salvar um agendamento em outro dia, a agenda volta para **hoje** (anotado pelo QA). A profissional não vê o que acabou de criar e tende a conferir de novo. | H1, H3 · eficiência | 2 |

### 3. Novo agendamento
| ID | Achado | Heurística / ISO | Sev. |
|---|---|---|---|
| UX-03 | **Botão "Agendar" desabilitado sem dizer o que falta** (cliente, serviço, horário, endereço ou saldo do pacote). O formulário é uma rolagem longa; o horário fica abaixo da dobra ([novo-01](evidencias/novo-01-cliente-servicos.jpg)). O mesmo padrão aparece em "Continuar" no link público e em "Cadastrar cliente" com nome de 1 letra. | H9, H1 · eficácia | 3 |
| UX-05 | A faixa de datas vai só até **21 dias** à frente (`novo.tsx`, `daysAhead`), sem calendário. Para marcar daqui a 5 semanas é preciso navegar a agenda até o dia e tocar no "+" — caminho não óbvio. Comum em manutenção de alongamento/cílios e em pacotes. | H7, H6 · eficiência | 2 |
| UX-06 | Dia sem vaga mostra só "Nenhum horário livre neste dia." ([novo-02](evidencias/novo-02-sem-horario.jpg)). Não sugere o próximo horário livre; a pessoa testa dia por dia. | H9, H7 · eficiência | 2 |
| UX-13 | **"Nova cliente" dentro do agendamento não valida o WhatsApp** (`saveNewClient` aceita "119") nem o nome mínimo, ao contrário de Clientes > Nova cliente (BUG-008). Inconsistência que reabre o problema do BUG-008 pelo caminho mais usado. | H4, H5 · eficácia | 2 |

### 4. Detalhe do agendamento, concluir e pagamento
| ID | Achado | Heurística / ISO | Sev. |
|---|---|---|---|
| UX-01 | **A ação principal do dia, "concluir e receber", não tem destaque.** "Concluído" é um dos 4 chips de status com o mesmo peso de "Cancelado"; o elemento mais forte da tela é o botão verde "Enviar lembrete no WhatsApp", mesmo para um atendimento que já passou ([agendamento-01](evidencias/agendamento-01-detalhe.jpg)). A forma de pagamento só aparece depois do toque, e um toque já lança a receita. | H8, H6 · eficiência (tarefa mais frequente) | 3 |
| UX-02 | **Cancelar não pede confirmação nem oferece desfazer** (atendimento avulso: `changeStatus` → `setAppointmentStatus` direto). O chip "Cancelado" fica ao lado de "Concluído", alvo fácil para toque errado. Também não registra o motivo (falta/desmarcou), dado útil para o produto. | H5, H3 · eficácia | 3 |
| UX-15 | Na web, o detalhe abre **em branco por ~1–2 s** antes de mostrar o conteúdo (observado em produção). Sem skeleton/indicador. | H1 · satisfação | 1 |

### 5. Clientes e ficha
| ID | Achado | Heurística / ISO | Sev. |
|---|---|---|---|
| UX-04b | Na ficha, **"Agendar" parece desabilitado**: branco sobre rosa claro (3,0:1) ao lado do WhatsApp verde forte ([cliente-01](evidencias/cliente-01-ficha.jpg)). Ver UX-04. | H8 · NBR 17060 | (em UX-04) |
| — | Filtros "Todas / Para chamar de volta / Aniversariantes" cortados na borda ([clientes-01](evidencias/clientes-01-lista.jpg)); a rolagem horizontal não é evidente. | H6 | 1 |

### 6. Pacotes
| ID | Achado | Heurística / ISO | Sev. |
|---|---|---|---|
| UX-16 | "Vender pacote" fica em dois lugares com rótulos diferentes ("Pacote" no topo do Financeiro e "+ Vender pacote" na ficha). No Financeiro, a pessoa precisa escolher a cliente depois; na ficha, não. Consistência e descoberta a validar no teste (tarefa T5). | H4 · eficiência | 1 |

### 7. Financeiro
| ID | Achado | Heurística / ISO | Sev. |
|---|---|---|---|
| UX-11 | (a) Transações mostram o **serviço mas não a cliente** ("Manicure · 21/11 07:41 · Serviço · Pix"): impossível conferir quem pagou ([financeiro-01](evidencias/financeiro-01.jpg)). (b) Os 4 cartões são sempre "dia/mês" enquanto o filtro Hoje/Semana/Mês muda só a lista — os números não batem com o filtro escolhido. (c) Não há como ver meses anteriores (só exportando). (d) O botão flutuante de despesa é um **"−"**, que lembra "remover", e cobre o valor da última linha. | H2, H4, H6, H7 · eficácia (conferência do caixa) | 2 |

### 8. Ajustes
| ID | Achado | Heurística / ISO | Sev. |
|---|---|---|---|
| UX-09 | **O link de agendamento — principal recurso de crescimento — está escondido** em Ajustes > Dados do estúdio > "Copiar link". Não há "Compartilhar" (WhatsApp/Instagram) nem atalho na agenda. | H6, H7 · eficácia do objetivo de negócio | 2 |
| UX-14 | "Envio automático (WhatsApp) · Em breve" é uma linha tocável que só abre "Em breve". | H8 | 1 |

### 9. Transversal: contraste e legibilidade
| ID | Achado | Heurística / ISO | Sev. |
|---|---|---|---|
| UX-04 | Contraste abaixo do mínimo AA (calculado com as cores de `src/theme/colors.ts` e o tema padrão Rosé Antigo `#C08497`): **texto branco nos botões principais 3,0:1** (precisa 4,5:1 para 15 px); texto secundário `muted` 3,6–3,9:1 (usado em quase toda informação de apoio, 11–13 px); selo "Pendente" 2,9:1; horário ocupado (`line` sobre fundo) **1,13:1**. Em estúdio claro e com reflexo, isso derruba a leitura. Outros temas pré-definidos também precisam ser conferidos. | NBR 17060, WCAG 1.4.3 · eficácia | 3 |

## Resumo
| Severidade | Qtde | IDs |
|---|---|---|
| 4 | 0 | — |
| 3 | 5 | UX-01, UX-02, UX-03, UX-04, UX-07 |
| 2 | 8 | UX-05, UX-06, UX-08, UX-09, UX-10, UX-11, UX-13, UX-17 |
| 1 | 5 | UX-12, UX-14, UX-15, UX-16, filtros cortados |

Nenhum problema impede o uso (sev. 4). Os de severidade 3 se concentram nas **duas tarefas mais frequentes** (marcar e concluir/receber) e na **leitura da tela**. Recomendações em [relatorio.md](relatorio.md).

## Limitações
- Um avaliador só; avaliação na web com tela de celular (gestos, teclado e desempenho do Android não foram vistos aqui).
- Sem dados de uso real: severidade de frequência é estimada. O teste com usuárias ([plano-teste-usabilidade.md](plano-teste-usabilidade.md)) confirma ou derruba cada hipótese.
