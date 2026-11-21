# Roteiro de testes manuais no celular

Use o Expo Go (ou a versão instalada) com a **conta de teste**. Marque ✅ / ❌ e, se falhar, registre em [bugs.md](bugs.md) com print (sem dados de clientes reais).
Itens com 🔁 são de **regressão**: repetir a cada versão.

**Última execução (20/11/2026, conta de teste):** todos os itens 🔁 e a seção A2 passaram (16 itens, nenhum bug). Seção G feita na web com conta Free descartável (20/11, tudo ✅; achados BUG-011 e BUG-012). Pendentes: itens sem 🔁 das seções A, B, C, E, F.
**21/11/2026 (celular Android):** CT-CON-10, BUG-009 e BUG-014 no leitor de tela, CT-AGE-13 e concluir/desfazer série ✅; CT-AGE-12 ✅ depois das correções dos BUG-015 e BUG-016. Bloco de pacotes, clientes e link (CT-PAC-15, "Pacote em uso", CT-PAC-16, CT-CLI-07, limite de 3 pelo mesmo WhatsApp) ✅; CT-LNK-08 ✅ na web com falha simulada. Os 3 agendamentos do link (QA Teste, 26/11) foram cancelados.

## A. Conta
- [x] ✅ (20/11) 🔁 CT-CON-02 Senha errada → "E-mail ou senha incorretos."
- [x] ✅ (20/11) 🔁 CT-CON-04 Criar conta com o e-mail da conta de teste → "Já existe uma conta com este e-mail…"
- [x] ✅ (21/11, Android) CT-CON-10 Ligar "Entrar com digital", fechar o app (tirar da memória) e abrir → pede a digital; logo depois de entrar com senha não pede.
- [x] ✅ (20/11) 🔁 CT-CON-07 Sair → entrar com outra conta → nada da conta anterior (nome do estúdio, clientes, cor).
- [x] ✅ (20/11) 🔁 CT-CON-08 Ficar mais de 1 hora sem abrir, ligar o modo avião, abrir → abre com os dados salvos (não pede login).

## A2. Acessibilidade (TalkBack/VoiceOver ligado)
- [x] ✅ (20/11) Agenda: botão "+" lido como "Novo agendamento"; dias lidos por extenso; horário vazio lido como "Agendar às 09:00".
- [x] ✅ (20/11) Novo agendamento: dias e horários dizem "selecionado"; horário ocupado diz "indisponível".
- [x] ✅ (20/11) Janelas que sobem de baixo (opções de série, excluir conta): cada botão é lido separadamente.
- [x] ✅ (20/11) Primeiro acesso: aceite dos Termos lido como caixa de seleção marcada/desmarcada.
- [x] ✅ (21/11) 🔁 Botão de voltar do cabeçalho (ex.: Nova cliente) lido como "Voltar" (BUG-009).
- [x] ✅ (21/11) 🔁 Interruptores lidos com o nome da opção (ex.: Ajustes > Horário de funcionamento: "Segunda aberto, ligado") (BUG-014).

## B. Agenda
- [x] ✅ (20/11) 🔁 CT-AGE-11 Novo agendamento → tocar duas vezes rápido em Salvar → só 1 criado.
- [ ] Série semanal com "até" antes do primeiro dia → salva sessão única, sem travar em "Salvando…". (21/11: feitas séries longas com "até" em vez disso, sem bug: sábados de 21/11 até 10/02 → 11 sessões, a última em 06/02 porque 10/02 é quarta; faltou só 02/01, que cai nas "Férias" dos dados de exemplo (pulada na janela de conflito). Mesma coisa na série de segundas até 07/01: faltou 28/12. "Até uma data" substitui o "Nº de sessões". O caso deste item continua pendente.)
- [x] ✅ (21/11, Android) CT-AGE-13 Abrir sessão de série → mudar só as observações → a sessão não fica marcada como exceção.
- [x] ✅ (21/11, Android) Concluir sessão de série com "este e os próximos" e depois desfazer → a própria sessão também volta.
- [x] ✅ (21/11, web, depois dos BUG-015 e BUG-016) CT-AGE-12 Atendimento 23:00–00:30 → aparece no fim de um dia e no começo do outro. Não dá para marcar depois das 22:00 (BUG-015). Reteste na web depois da correção: marca 23:00 e bloqueia o começo do dia seguinte, mas a agenda do dia seguinte não mostra o atendimento (BUG-016).

## C. Pacotes
- [x] ✅ (20/11) 🔁 Vender pacote 4x → agendar sessão com o pacote → concluir → saldo cai para 3.
- [x] ✅ (21/11, Android) CT-PAC-15 Editar a sessão tirando o serviço do pacote → aviso "Tirar do pacote?" → crédito volta.
- [x] ✅ (21/11, Android) Excluir pacote com sessão feita (ficha da cliente > pacote > Excluir pacote) → "Pacote em uso".
- [x] ✅ (21/11, Android) CT-PAC-16 Reenviar comprovante de uma sessão antiga → "Restam" mostra o saldo daquela data.

## D. Clientes
- [x] ✅ (20/11) 🔁 Excluir cliente sem atendimentos → some.
- [x] ✅ (20/11) 🔁 Excluir cliente com atendimentos → "Apagar dados" → aparece como "Cliente removida" na agenda antiga e some da lista, da busca e do "Para chamar de volta".
- [x] ✅ (21/11, Android) CT-CLI-07 Ficha → cartões com "(12 meses)" → "ver histórico completo" → "Total gasto".

## E. Offline (modo avião)
- [x] ✅ (20/11) 🔁 CT-OFF-01 Modo avião → criar cliente, criar agendamento, concluir outro → avisos "salvo no aparelho".
- [x] ✅ (20/11) 🔁 Desligar o modo avião → "Sincronizado com a nuvem" → agendamento aparece com o serviço (conferir VAL-05 = 0).
- [ ] CT-OFF-02 Wi-Fi ligado mas sem internet (roteador sem cabo) → criar agendamento → vai para a fila.
- [ ] CT-OFF-03 Offline, marcar no mesmo horário de um agendamento feito por outro aparelho → ao sincronizar, aviso de conflito e o item some da tela.

## F. Link público (pelo celular de outra pessoa ou aba anônima)
- [x] ✅ (20/11) 🔁 Escolher 7 serviços → para no 6º com aviso.
- [x] ✅ (20/11) 🔁 Agendar horário livre → aparece na agenda (pendente ou confirmado conforme Ajustes).
- [ ] Notificação push chega no celular da profissional (versão instalada; Expo Go no Android não recebe).
- [ ] CT-LNK-08 Abrir o link, ligar o modo avião, ir para "Data" → nenhum horário livre + "Tentar de novo". (21/11, Android: datas e horários continuam aparecendo e "Confirmar agendamento" avisa que está sem internet. Não é bug: os horários ocupados são lidos uma vez, ao abrir o link, e no envio o banco confere de novo. O "Tentar de novo" só aparece se essa leitura falhar ao abrir; o passo do roteiro estava errado. Abrindo o link já no modo avião, o próprio navegador mostra que está sem internet e o app nem carrega: também não é bug. O caso "abre a página, mas a leitura dos horários falha" não dá para reproduzir à mão no celular. Conferido na web (21/11, conta de teste, navegador embutido): a leitura `get_public_busy_slots` foi forçada a falhar pelo console e o link aberto por dentro do app. Resultado: aviso "Não foi possível carregar os horários livres…", todos os dias desabilitados e "Tentar de novo". Com a leitura liberada, "Tentar de novo" sumiu com o aviso e mostrou os dias livres. ✅)
- [x] ✅ (21/11, Android) Mesmo WhatsApp com 4º agendamento futuro → "Você já tem horários marcados…".

## G. Planos (conta Free separada)
- [x] ✅ (20/11, web) CT-PLA-06 Cadastrar a 11ª cliente → aviso de upgrade.
- [x] ✅ (20/11, web) Apagar dados de uma cliente com histórico → consegue cadastrar outra (removidas não contam).
- [x] ✅ (20/11, web) Conta nova com Dados do estúdio vazios → Carregar dados de exemplo → Dados do estúdio continuam vazios e o link público não mostra endereço (BUG-006); nenhum exemplo no domingo nem fora do expediente (BUG-010).
- [x] ✅ (20/11, web) Carregar dados de exemplo duas vezes → 2ª vez: "Exemplos já carregados" (a confirmação aparece antes do aviso: melhoria).
