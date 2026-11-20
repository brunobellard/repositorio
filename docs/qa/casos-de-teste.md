# Casos de teste

**Tipo:** U = unitário automatizado · API = automatizado no Supabase · E2E = Maestro · M = manual (roteiro) · SQL = validação de dados
**Prioridade:** P1 = bloqueia versão · P2 = importante · P3 = desejável
**Status (20/11/2026):** ✅ passou · ✅ (CI) passou no GitHub Actions com a conta de teste · ⏭️ automatizado, aguardando conta de teste · ⬜ não executado · ❌ falhou (ver bugs.md)

## 1. Conta e acesso
| ID | Cenário | Passos | Resultado esperado | Pri | Tipo | Status |
|---|---|---|---|---|---|---|
| CT-CON-01 | Entrar com dados corretos | Login > e-mail e senha da conta de teste > Entrar | Abre a Agenda | P1 | E2E | ⬜ |
| CT-CON-02 | Senha errada | Senha incorreta > Entrar | "E-mail ou senha incorretos." | P1 | E2E | ✅ (celular, 20/11) |
| CT-CON-03 | Botão desabilitado com dados incompletos | Sem "@" no e-mail ou senha < 6 | "Entrar" desabilitado | P2 | M (web) | ✅ |
| CT-CON-11 | E-mail com formato inválido | `ana@` ou `ana@exemplo` | Entrar/Enviar link desabilitados (BUG-004) | P2 | U (CT-FMT-06) + M (web) | ✅ |
| CT-CON-12 | Leitor de tela no login | Ativar TalkBack/VoiceOver | Anuncia "E-mail", "Senha", "Entrar, botão" (BUG-003) | P3 | M | ✅ (web e celular) |
| CT-CON-04 | Cadastro com e-mail já existente | Criar conta com e-mail da conta de teste | "Já existe uma conta com este e-mail…" (não "Conta criada!") | P1 | M | ✅ (celular, 20/11) |
| CT-CON-05 | Esqueci a senha sem e-mail | Abrir "Esqueci minha senha" com campo vazio | "Enviar link" desabilitado | P3 | M (web) | ✅ |
| CT-CON-06 | Link de nova senha inválido | Abrir /redefinir-senha sem token | "Link inválido ou expirado" | P2 | M (web) | ✅ |
| CT-CON-07 | Sair da conta apaga o cache | Sair > entrar com outra conta | Nada da conta anterior aparece | P1 | M | ✅ (celular, 20/11) |
| CT-CON-08 | Abrir sem internet com login vencido | Ficar > 1 h sem abrir; modo avião; abrir | Abre com os dados salvos (não cai no login) | P1 | M | ✅ (celular, 20/11) |
| CT-CON-09 | Excluir conta | Ajustes > Excluir conta (conta descartável) | Sai do app; login e dados somem (VAL-17/18 = 0) | P1 | M + SQL | ✅ (web, 20/11) |
| CT-CON-10 | Digital escolhida no login | Ligar "Entrar com digital" > fechar e abrir | Pede a digital só na próxima abertura | P2 | M | ⬜ |

## 2. Agenda e conflitos
| ID | Cenário | Resultado esperado | Pri | Tipo | Status |
|---|---|---|---|---|---|
| CT-AGE-01 | Horário livre no expediente | Aceito | P1 | U | ✅ |
| CT-AGE-02 | Data passada | "Data já passou" | P1 | U | ✅ |
| CT-AGE-03 | Domingo, almoço, fim do expediente | "Estúdio fechado" / "Fora do expediente" | P1 | U | ✅ |
| CT-AGE-04 | Atender fora do expediente | Ignora o horário, mas não outro atendimento | P2 | U | ✅ |
| CT-AGE-05 | Folga de dia inteiro | Mostra o motivo da folga | P2 | U | ✅ |
| CT-AGE-06 | Encostado × sobreposto | Encostado aceito; sobreposto "Horário ocupado" | P1 | U | ✅ |
| CT-AGE-07 | Cancelado não ocupa | Aceito | P2 | U | ✅ |
| CT-AGE-08 | Editar o próprio horário | Não conflita com ele mesmo | P2 | U | ✅ |
| CT-AGE-09 | Domicílio: deslocamento gravado | Usa o busy_until do banco, não o atual | P1 | U | ✅ |
| CT-AGE-10 | Domicílio novo reserva deslocamento | "Horário ocupado" se o seguinte começa no deslocamento | P2 | U | ✅ |
| CT-API-02 | Banco calcula total e "ocupado até" | total = preço; busy_until ≥ fim | P1 | API | ✅ (CI) |
| CT-API-03 | Banco recusa sobreposição | Erro 23P01 | P1 | API | ✅ (CI) |
| CT-AGE-11 | Toque duplo em "Salvar" | Só um agendamento criado | P1 | M | ✅ (celular, 20/11) |
| CT-AGE-12 | Atendimento que atravessa a meia-noite | Barra aparece nos dois dias, sem "voltar" ao início | P3 | M | ⬜ |
| CT-AGE-13 | Editar só as observações de sessão de série | Sessão não vira exceção da série | P2 | M | ⬜ |

## 3. Recorrência
| ID | Cenário | Resultado esperado | Pri | Tipo | Status |
|---|---|---|---|---|---|
| CT-REC-01 | Semanal 4 sessões | 4 datas, mesmo dia e hora | P1 | U | ✅ |
| CT-REC-02 | Quinzenal / 3 semanas | Intervalos de 14 e 21 dias | P2 | U | ✅ |
| CT-REC-03 | Mensal no dia 31 | Cai no último dia dos meses curtos | P2 | U | ✅ |
| CT-REC-04 | 1ª e última sexta do mês | Datas corretas | P2 | U | ✅ |
| CT-REC-05 | "Até" inclui o dia final | 3 sessões | P2 | U | ✅ |
| CT-REC-06 | "Até" antes do 1º dia | Sessão única (não trava em "Salvando") | P1 | U | ✅ |
| CT-REC-07 | Limite de 52 sessões | Corta em 52 | P2 | U | ✅ |
| CT-REC-08 | Personalizado a cada 10 dias | Datas corretas | P3 | U | ✅ |
| CT-REC-09 | Regra iCalendar | `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;COUNT=6` | P3 | U | ✅ |
| CT-REC-10 | "Este e os próximos" | Ignora concluídas e canceladas | P1 | U | ✅ |
| CT-REC-11 | "Só este" | Só a sessão aberta | P1 | U | ✅ |
| CT-REC-12 | "Sessão 4 de 4" | Texto correto | P3 | U | ✅ |

## 4. Pacotes e financeiro
| ID | Cenário | Resultado esperado | Pri | Tipo | Status |
|---|---|---|---|---|---|
| CT-PAC-01 | Taxa em reais | Arredonda centavos | P1 | U | ✅ |
| CT-PAC-02/03 | Plano sem taxas / teste vencido | Taxa zero | P2 | U | ✅ |
| CT-PAC-04/05 | Validade | Vale até 23:59 do dia; sem validade nunca vence | P1 | U | ✅ |
| CT-PAC-06..08 | Saldo de créditos | Desconta usadas e agendadas; nunca negativo | P1 | U | ✅ |
| CT-PAC-09/10 | Pacote utilizável | Só mesma cliente/serviço, ativo, válido, com crédito | P1 | U | ✅ |
| CT-PAC-11..14 | Valor a receber | Pacote cobre 1 sessão; extras e deslocamento cobrados | P1 | U | ✅ |
| CT-API-04 | Concluir lança receita única | 1 receita, valor do serviço | P1 | API | ✅ (CI) |
| CT-API-05 | Excluir pacote em uso / livre | Em uso: recusa; livre: sai com a receita | P1 | API | ✅ (CI) |
| CT-PAC-15 | Tirar serviço do pacote ao editar sessão | Pergunta "Tirar do pacote?"; crédito volta | P2 | M | ⬜ |
| CT-PAC-16 | Comprovante reenviado depois | "Restam" = saldo na data do atendimento | P3 | M | ⬜ |
| CT-FIN-01 | Exportar planilha | Despesas com líquido negativo; soma = lucro | P2 | M | ⬜ |
| SQL VAL-02..04, 09..13 | Consistência de pacotes e receitas | 0 problemas | P1 | SQL | ✅ (VAL-01, 20/11) |

## 5. Clientes
| ID | Cenário | Resultado esperado | Pri | Tipo | Status |
|---|---|---|---|---|---|
| CT-CLI-01 | Passou do prazo, sem horário | Entra em "Para chamar de volta" | P1 | U | ✅ |
| CT-CLI-02 | Tem horário futuro | Não entra | P1 | U | ✅ |
| CT-CLI-03 | Cliente removida | Não entra | P2 | U | ✅ |
| CT-CLI-04 | Sumida há mais de 12 meses | Entra (resumo do banco) | P1 | U | ✅ |
| CT-CLI-05 | Atendimento recente vence o resumo | Não entra | P2 | U | ✅ |
| CT-CLI-06 | Mensagem com variáveis | Troca {nome}, {dias}; mantém desconhecidas | P2 | U | ✅ |
| CT-API-08 | Apagar dados (LGPD) | "Cliente removida", sem contato, histórico mantido | P1 | API | ✅ (CI) |
| CT-API-09 | Excluir cliente com histórico direto | Banco recusa (23503); app oferece "Apagar dados" | P1 | API | ✅ (CI) |
| CT-CLI-07 | Ficha com histórico parcial | Cartões "(12 meses)"; "ver histórico completo" volta a "Total gasto" | P2 | M | ⬜ |
| CT-CLI-08 | Busca sem acento | "acento cao" encontra "QA Acento Ção" | P3 | U + M | ✅ (U) |

## 6. Link público
| ID | Cenário | Resultado esperado | Pri | Tipo | Status |
|---|---|---|---|---|---|
| CT-LNK-01 | Estúdio inexistente | Sem dados; tela "Link não encontrado" | P1 | API + M | ✅ |
| CT-LNK-02 | Horários de estúdio inexistente | Lista vazia | P2 | API | ✅ |
| CT-LNK-03 | Reserva em estúdio inexistente | "Estúdio não encontrado" | P2 | API | ✅ |
| CT-LNK-04 | Estúdio real informa link liberado | `booking_enabled` booleano | P2 | API | ✅ (CI) |
| CT-LNK-05 | Período enorme de horários | Sem erro; limitado a ~95 dias | P1 | API | ✅ (CI) |
| CT-LNK-06 | Nome curto | Recusado antes de gravar | P2 | API | ✅ (CI) |
| CT-LNK-07 | 7 serviços | Recusado; tela para no 6º | P2 | API + M | ✅ (CI e celular) |
| CT-LNK-08 | Falha ao buscar horários | Nenhum horário livre + "Tentar de novo" | P1 | M | ⬜ |
| CT-LNK-09 | Mensagens para a cliente | Português, sem código técnico | P2 | M | ⬜ |
| CT-LNK-10 | Layout no celular (375 px) | Sem rolagem lateral | P2 | M (web) | ✅ |
| CT-FUS-01..04 | Fuso do estúdio | Instantes corretos (SP, Manaus); fuso inválido não quebra | P1 | U | ✅ |

## 7. Planos
| ID | Cenário | Resultado esperado | Pri | Tipo | Status |
|---|---|---|---|---|---|
| CT-PLA-01..03 | Plano em vigor | Ativo = contratado; teste vencido/cancelado = Free | P1 | U | ✅ |
| CT-PLA-04 | Recursos por plano | Free sem pacotes | P1 | U | ✅ |
| CT-PLA-05 | Limites do banco mapeados | Todo PLAN_LIMIT abre o aviso de upgrade | P2 | U | ✅ |
| CT-PLA-06 | 11ª cliente no Free | Aviso de upgrade; removidas não contam | P1 | M + SQL VAL-19 | ✅ (web, 20/11) |

## 8. Offline
| ID | Cenário | Resultado esperado | Pri | Tipo | Status |
|---|---|---|---|---|---|
| CT-OFF-01 | Criar agendamento em modo avião | "Salvo no aparelho"; sincroniza ao voltar | P1 | M | ✅ (celular, 20/11) |
| CT-OFF-02 | Wi-Fi sem internet | Vai para a fila em vez de perder | P1 | M | ⬜ |
| CT-API-06 | Fila envia agendamento + serviços juntos, sem duplicar | 1 agendamento com serviço | P1 | API | ✅ (CI) |
| CT-API-07 | Fila sem serviço | Recusado | P2 | API | ✅ (CI) |
| CT-OFF-03 | Item recusado na sincronização | Aviso e some da tela | P2 | M | ⬜ |

## 9. Segurança e permissões
| ID | Cenário | Resultado esperado | Pri | Tipo | Status |
|---|---|---|---|---|---|
| CT-SEG-01 | Sem login lê tabelas do app | Nada (10 tabelas) | P1 | API | ✅ |
| CT-SEG-02 | Sem login grava cliente | Recusado | P1 | API | ✅ |
| CT-SEG-03 | Registro de IPs do link | Inacessível | P1 | API | ✅ |
| CT-SEG-04/05 | Excluir conta / limpar dados sem login | Recusado | P1 | API | ✅ |
| CT-SEG-06..09 | Resumo, pacote, anonimizar, fila offline sem login | Nada visível / recusado | P1 | API | ✅ |
| CT-API-01 | Logado só vê os próprios dados | Todas as linhas com owner_id próprio | P1 | API | ✅ (CI) |
| SQL VAL-01 | Resumo das 19 regras de dados (VAL-02..20) | 0 problemas em todas | P1 | SQL | ✅ (20/11) |
| SQL VAL-20, 22 | RLS ligada; funções de servidor fechadas | 0 tabelas sem RLS; false nas três funções | P1 | SQL | ✅ (20/11) |
| SQL VAL-21 | Funções executáveis sem login | Só as 3 do link público; nenhuma "PROBLEMA" | P1 | SQL | ✅ (20/11, após BUG-005) |
| CT-SEG-11 | Funções do app logado sem login | "permission denied for function" (resumo, excluir pacote, fila offline, anonimizar, plan_rank) | P1 | API | ✅ (20/11, após BUG-005) |
| CT-SEG-10 | Rota inexistente no site | Página própria, sem expor o mapa de rotas | P2 | M (web) | ✅ corrigido (local) |
