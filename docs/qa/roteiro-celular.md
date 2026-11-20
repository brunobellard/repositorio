# Roteiro de testes manuais no celular

Use o Expo Go (ou a versão instalada) com a **conta de teste**. Marque ✅ / ❌ e, se falhar, registre em [bugs.md](bugs.md) com print (sem dados de clientes reais).
Itens com 🔁 são de **regressão**: repetir a cada versão.

**Última execução (20/11/2026, conta de teste):** todos os itens 🔁 e a seção A2 passaram (16 itens, nenhum bug). Seção G feita na web com conta Free descartável (20/11, tudo ✅; achados BUG-011 e BUG-012). Pendentes: itens sem 🔁 das seções A, B, C, E, F.

## A. Conta
- [x] ✅ (20/11) 🔁 CT-CON-02 Senha errada → "E-mail ou senha incorretos."
- [x] ✅ (20/11) 🔁 CT-CON-04 Criar conta com o e-mail da conta de teste → "Já existe uma conta com este e-mail…"
- [ ] CT-CON-10 Ligar "Entrar com digital", fechar o app (tirar da memória) e abrir → pede a digital; logo depois de entrar com senha não pede.
- [x] ✅ (20/11) 🔁 CT-CON-07 Sair → entrar com outra conta → nada da conta anterior (nome do estúdio, clientes, cor).
- [x] ✅ (20/11) 🔁 CT-CON-08 Ficar mais de 1 hora sem abrir, ligar o modo avião, abrir → abre com os dados salvos (não pede login).

## A2. Acessibilidade (TalkBack/VoiceOver ligado)
- [x] ✅ (20/11) Agenda: botão "+" lido como "Novo agendamento"; dias lidos por extenso; horário vazio lido como "Agendar às 09:00".
- [x] ✅ (20/11) Novo agendamento: dias e horários dizem "selecionado"; horário ocupado diz "indisponível".
- [x] ✅ (20/11) Janelas que sobem de baixo (opções de série, excluir conta): cada botão é lido separadamente.
- [x] ✅ (20/11) Primeiro acesso: aceite dos Termos lido como caixa de seleção marcada/desmarcada.
- [ ] 🔁 Botão de voltar do cabeçalho (ex.: Nova cliente) lido como "Voltar" (BUG-009).

## B. Agenda
- [x] ✅ (20/11) 🔁 CT-AGE-11 Novo agendamento → tocar duas vezes rápido em Salvar → só 1 criado.
- [ ] Série semanal com "até" antes do primeiro dia → salva sessão única, sem travar em "Salvando…".
- [ ] CT-AGE-13 Abrir sessão de série → mudar só as observações → a sessão não fica marcada como exceção.
- [ ] Concluir sessão de série com "este e os próximos" e depois desfazer → a própria sessão também volta.
- [ ] CT-AGE-12 Atendimento 23:00–00:30 → aparece no fim de um dia e no começo do outro.

## C. Pacotes
- [x] ✅ (20/11) 🔁 Vender pacote 4x → agendar sessão com o pacote → concluir → saldo cai para 3.
- [ ] CT-PAC-15 Editar a sessão tirando o serviço do pacote → aviso "Tirar do pacote?" → crédito volta.
- [ ] Excluir pacote com sessão feita → "Pacote em uso".
- [ ] CT-PAC-16 Reenviar comprovante de uma sessão antiga → "Restam" mostra o saldo daquela data.

## D. Clientes
- [x] ✅ (20/11) 🔁 Excluir cliente sem atendimentos → some.
- [x] ✅ (20/11) 🔁 Excluir cliente com atendimentos → "Apagar dados" → aparece como "Cliente removida" na agenda antiga e some da lista, da busca e do "Para chamar de volta".
- [ ] CT-CLI-07 Ficha → cartões com "(12 meses)" → "ver histórico completo" → "Total gasto".

## E. Offline (modo avião)
- [x] ✅ (20/11) 🔁 CT-OFF-01 Modo avião → criar cliente, criar agendamento, concluir outro → avisos "salvo no aparelho".
- [x] ✅ (20/11) 🔁 Desligar o modo avião → "Sincronizado com a nuvem" → agendamento aparece com o serviço (conferir VAL-05 = 0).
- [ ] CT-OFF-02 Wi-Fi ligado mas sem internet (roteador sem cabo) → criar agendamento → vai para a fila.
- [ ] CT-OFF-03 Offline, marcar no mesmo horário de um agendamento feito por outro aparelho → ao sincronizar, aviso de conflito e o item some da tela.

## F. Link público (pelo celular de outra pessoa ou aba anônima)
- [x] ✅ (20/11) 🔁 Escolher 7 serviços → para no 6º com aviso.
- [x] ✅ (20/11) 🔁 Agendar horário livre → aparece na agenda (pendente ou confirmado conforme Ajustes).
- [ ] Notificação push chega no celular da profissional (versão instalada; Expo Go no Android não recebe).
- [ ] CT-LNK-08 Abrir o link, ligar o modo avião, ir para "Data" → nenhum horário livre + "Tentar de novo".
- [ ] Mesmo WhatsApp com 4º agendamento futuro → "Você já tem horários marcados…".

## G. Planos (conta Free separada)
- [x] ✅ (20/11, web) CT-PLA-06 Cadastrar a 11ª cliente → aviso de upgrade.
- [x] ✅ (20/11, web) Apagar dados de uma cliente com histórico → consegue cadastrar outra (removidas não contam).
- [x] ✅ (20/11, web) Conta nova com Dados do estúdio vazios → Carregar dados de exemplo → Dados do estúdio continuam vazios e o link público não mostra endereço (BUG-006); nenhum exemplo no domingo nem fora do expediente (BUG-010).
- [x] ✅ (20/11, web) Carregar dados de exemplo duas vezes → 2ª vez: "Exemplos já carregados" (a confirmação aparece antes do aviso: melhoria).
