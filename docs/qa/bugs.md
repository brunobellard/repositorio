# Bugs encontrados

Formato: ID · severidade · onde · passos · esperado × obtido · evidência · status.
Evidências em `docs/qa/evidencias/` (sem dados de clientes reais).

---

## BUG-001 · Alta · Termos de Uso e Política de Privacidade com dados fictícios
**Onde:** `/termos` e `/privacidade` (web e app) — `src/constants/legal.ts`
**Passos:**
1. Abrir https://projeto-app-beleza.expo.app/termos
2. Ler o primeiro parágrafo; abrir `/privacidade` e procurar o e-mail de contato.

**Esperado:** razão social, CPF/CNPJ e e-mail de contato reais (exigência da LGPD e das lojas Apple/Google para o canal do titular dos dados).
**Obtido:** "Agenda Beleza Tecnologia Ltda. (CPF/CNPJ **00.000.000/0001-00**)" e contato **contato@agendabeleza.example** (domínio que não recebe e-mail).
**Evidência:** [bug-001-termos-cnpj.png](evidencias/bug-001-termos-cnpj.png)
**Correção sugerida:** preencher `LEGAL_INFO` com os dados reais (ou deixar `document` vazio para não exibir) e um e-mail que funcione.
**Correção (20/11/2026):** CNPJ real (68.947.841/0001-44) e e-mail de contato provisório em `LEGAL_INFO`; data de atualização dos textos: 20 de novembro de 2026. Conferido localmente em /termos e /privacidade.
**Razão social:** DataCore Intelligence (informada pelo responsável). Conferido localmente: Termos e Privacidade mostram "DataCore Intelligence (CPF/CNPJ 68.947.841/0001-44)".
**Antes de publicar nas lojas:** trocar o e-mail provisório pelo de contato definitivo.
**Reteste em produção (20/11/2026):** /termos e /privacidade mostram "DataCore Intelligence (CPF/CNPJ 68.947.841/0001-44)", o e-mail de contato provisório e "Última atualização: 20 de novembro de 2026"; nenhum dado fictício restante.
**Status:** corrigido parcialmente · falta só o e-mail definitivo.

---

## BUG-002 · Média · Endereço inexistente mostra página técnica em inglês com mapa de rotas
**Onde:** site web (Expo Router, falta `src/app/+not-found.tsx`)
**Passos:**
1. Abrir https://projeto-app-beleza.expo.app/rota-que-nao-existe

**Esperado:** página em português ("Página não encontrada") com botão para voltar ao início.
**Obtido:** tela preta "Unmatched Route — Page could not be found." com link **Sitemap**, que lista todas as telas do app para qualquer visitante.
**Evidência:** [bug-002-rota-inexistente.jpg](evidencias/bug-002-rota-inexistente.jpg)
**Correção:** `src/app/+not-found.tsx` (página em português com "Ir para o início") e `src/app/_sitemap.tsx` (o mapa de telas deixa de existir e responde como página inexistente).
**Reteste (local, 20/11/2026):** `/rota-que-nao-existe` e `/_sitemap` mostram "Página não encontrada" — [bug-002-corrigido.jpg](evidencias/bug-002-corrigido.jpg).
**Reteste em produção (20/11/2026):** `/rota-que-nao-existe` e `/_sitemap` mostram "Página não encontrada"; "Ir para o início" leva ao login.
**Observação:** o endereço do login fica com `?not-found=rota-que-nao-existe` (comportamento do Expo Router, sem efeito para a pessoa).
**Status:** corrigido e conferido em produção.

---

## BUG-003 · Baixa · Botões e links sem papel de "botão" para leitores de tela
**Onde:** login (Entrar, Criar conta, Esqueci minha senha) e demais telas — `Pressable` sem `accessibilityRole`
**Passos:**
1. Abrir `/login` com leitor de tela (TalkBack/VoiceOver) ou inspecionar a árvore de acessibilidade.

**Esperado:** "Entrar, botão"; campos anunciados pelo rótulo ("E-mail", "Senha").
**Obtido:** botões aparecem como elementos genéricos; campos são anunciados pelo exemplo ("voce@email.com", "Mínimo 6 caracteres"), não pelo rótulo.
**Evidência:** árvore de acessibilidade da página de login: `textbox "voce@email.com"`, botões como `generic`.
**Correção:** papéis e nomes em `Button`, `Chip`, `Segmented` (abas), `Fab` ("Novo agendamento", "Nova cliente", "Nova despesa"), `EmptyState`, `Field` e `SearchBar`; links do login e da tela "Esqueci minha senha"; aviso de erro do login anunciado ao aparecer.
**Reteste (local):** árvore do login agora mostra `tab "Entrar"`, `textbox "E-mail"`, `textbox "Senha"`, `button "Esqueci minha senha"`, `button "Entrar"`, `button "Ainda não tem conta? Criar conta"`.
**Correção (2ª parte):** os 97 botões restantes, em 28 arquivos, ganharam papel e nome: agenda (dias, horários, atendimentos, horários livres "Agendar às 09:00"), novo agendamento, ficha da cliente, ajustes, pacotes, primeiro acesso e link público (serviços, bairro, dias com data por extenso, horários, "Mês anterior/Próximo mês", "Voltar"). Itens escolhidos informam "selecionado"; o aceite dos Termos é uma caixa de seleção.
**Achado durante a correção:** o fundo escuro das janelas de baixo (Sheet, "Esqueci minha senha", excluir conta, bairro) era um único botão que engolia todo o conteúdo para o leitor de tela; agora o fundo e o painel não são agrupados e cada campo/botão é lido separadamente.
**Reteste em produção (20/11/2026):** mesma árvore de acessibilidade no login publicado.
**Reteste em produção (20/11/2026, 2ª parte):** janela "Esqueci minha senha" lida item a item (`textbox "E-mail"`, `button "Enviar link"`, botão "Cancelar"), sem o fundo agrupando o conteúdo; nenhum erro no console. Telas com login: conferir no celular com TalkBack/VoiceOver (roteiro-celular.md).
**Reteste no celular (20/11/2026, roteiro A2 com leitor de tela):** agenda ("Novo agendamento", dias por extenso, "Agendar às 09:00"), novo agendamento ("selecionado"/"indisponível"), janelas de baixo lidas item a item e aceite dos Termos como caixa de seleção: tudo ✅.
**Status:** fechado · conferido na web e no celular.

---

## BUG-004 · Baixa · Validação de e-mail só confere "@"
**Onde:** login e cadastro — `src/app/login.tsx` (`email.includes('@')`)
**Passos:** digitar `ana@` e uma senha de 6 caracteres.
**Esperado:** botão desabilitado até o e-mail ter formato válido (`nome@dominio.com`).
**Obtido:** botão habilitado; o erro só aparece depois de enviar ao servidor.
**Correção:** `isValidEmail` em `src/lib/format.ts`, usado no login, no cadastro e em "Esqueci minha senha".
**Reteste:** teste automático CT-FMT-06; na tela, "Enviar link" fica desabilitado com `ana@exemplo` e habilita com `ana@exemplo.com`.
**Status:** corrigido · publicado.

---

## BUG-005 · Média · Quatro funções internas podem ser executadas sem login
**Onde:** Supabase — migrações `20261203000000_historico_antigo_e_fila_offline.sql` (`client_history_summary`, `delete_package`, `create_offline_appointment`) e `20261121000000_planos_assinatura.sql` (`plan_rank`)
**Passos:**
1. SQL Editor: rodar a VAL-21 de `docs/qa/validacao-sql.sql`.
2. Ou, sem login (chave pública), chamar `rpc('create_offline_appointment', { p_appointment: {}, p_services: [] })`.

**Esperado:** recusa por permissão antes de rodar ("permission denied for function"), como já acontece com `anonymize_client`, `delete_account` e `purge_account_data`.
**Obtido:** a VAL-21 lista as quatro com veredito "PROBLEMA" (7 linhas no total: 3 do link público ok + 4 problemas). Sem login, as funções começam a rodar: `create_offline_appointment` devolve a validação interna "Escolha pelo menos um serviço."; `client_history_summary` e `delete_package` só param em "permission denied for table appointments / client_packages"; `plan_rank` responde normalmente (só converte o nome do plano em número, sem ler dados).
**Impacto hoje:** nenhum dado exposto nem alterado. `plan_rank` não lê tabelas; as outras três são `security invoker` e quem não está logado não tem acesso às tabelas (e o RLS ainda filtra por dono). Falta uma das camadas de proteção: se um dia uma tabela voltar a ser liberada ou uma função virar `security definer`, ficam abertas.
**Causa:** a migração 20261203 dá `grant execute ... to authenticated`, mas não faz `revoke ... from anon, public` (o padrão do Postgres libera para todos). `plan_rank` nunca teve revoke. As demais migrações fazem o revoke em cada função.
**Evidência:** resultado da VAL-21 em 20/11/2026 (só nomes de funções, sem dados de clientes) e o teste automático CT-SEG-11 (`npm run test:api -- -t CT-SEG-11`): 4 falhando, `anonymize_client` passando.
**Correção sugerida (sessão principal, nova migração):**
```sql
revoke execute on function public.client_history_summary() from public, anon;
revoke execute on function public.delete_package(uuid) from public, anon;
revoke execute on function public.create_offline_appointment(jsonb, jsonb) from public, anon;
revoke execute on function public.plan_rank(text) from public, anon;  -- usada só dentro de funções security definer e gatilhos
```
**Observação:** a VAL-21 também listava ~100 funções `gbt_*` e `*_dist` da extensão `btree_gist` (usada para impedir horários sobrepostos). Elas são internas do Postgres e foram retiradas da consulta. A primeira lista veio cortada pelo limite de 100 linhas do SQL Editor; a VAL-21 corrigida (20/11/2026) mostrou a lista completa: 7 linhas.
**Correção (20/11/2026):** migração `supabase/migrations/20261205000000_fechar_funcoes_sem_login.sql` com os 4 revokes (e grant para quem está logado). O app só chama as três funções com login (`src/data/store.tsx`); `plan_rank` é usada só dentro de funções security definer e por `payment_fee` (logado).
**Reteste:** depois da migração, CT-SEG-11 deve passar nas 5 funções e a VAL-21 não deve mostrar nenhuma linha "PROBLEMA".
**Reteste em produção (20/11/2026):** migração aplicada no SQL Editor. CT-SEG-11 passou nas 5 funções ("permission denied for function"); `npm run test:api` com 26 passando e nenhuma falha. VAL-21: 3 linhas, só as funções do link público ("ok"), nenhuma "PROBLEMA".
**Status:** fechado · corrigido e conferido em produção.

---

## BUG-006 · Alta · "Carregar dados de exemplo" põe CNPJ, razão social e endereço fictícios no link público e no comprovante
**Onde:** Ajustes > Carregar dados de exemplo — `src/data/store.tsx` (`loadExampleData`, usa `exampleStudio` de `src/data/mock.ts`)
**Passos:**
1. Conta com "Dados do estúdio" sem razão social, CPF/CNPJ, endereço e Instagram.
2. Ajustes > Carregar dados de exemplo > confirmar.
3. Abrir Ajustes > Dados do estúdio; abrir o link público `/agendar/<slug>`; enviar um comprovante.

**Esperado:** os exemplos criam só clientes, agendamentos e despesas, como diz a confirmação ("Serão criadas 12 clientes, agendamentos desta semana e algumas despesas…"). Dados do estúdio continuam vazios.
**Obtido:** os campos vazios recebem "Ana Lima Beleza e Estética LTDA", CNPJ 12.345.678/0001-90, "Rua Haddock Lobo, 595 – Cerqueira César – São Paulo/SP" e "@studioanalima". O link público mostra esse endereço e Instagram para as clientes, e o comprovante (`recibo.tsx`) mostra a razão social e o CNPJ fictícios. A confirmação não avisa, e não há como remover os exemplos depois.
**Impacto:** uma profissional que testou com exemplos e começou a usar de verdade sem preencher esses campos manda clientes reais para um endereço inexistente e emite comprovantes com CNPJ de outra empresa.
**Evidência:** conta de teste em 20/11/2026 — link público `/agendar/qa-estudio` exibindo o endereço e o Instagram de exemplo; Dados do estúdio com o CNPJ de exemplo. (Sem prints: a tela de Ajustes mostra o e-mail da conta.)
**Correção sugerida:** não preencher dados do estúdio nos exemplos (ou só nome/telefone de demonstração, nunca CNPJ e endereço); citar na confirmação tudo o que será criado; oferecer "Remover dados de exemplo".
**Correção (commit dbebce4):** `loadExampleData` não grava mais dados do estúdio (`exampleStudio` removido); a confirmação cita folgas e taxas e diz que os dados do estúdio não são alterados. Não implementado: "Remover dados de exemplo" (melhoria futura). Dados já gravados na conta de teste limpos pelo responsável com SQL.
**Reteste em produção (20/11/2026):** confirmação publicada com o texto novo; Dados do estúdio da conta de teste vazios; link público `/agendar/qa-estudio` sem endereço nem Instagram de exemplo. A carga ponta a ponta numa conta nova fica junto com o BUG-010.
**Reteste ponta a ponta (20/11/2026, conta nova no Free, Dados do estúdio vazios):** depois de "Carregar dados de exemplo", Dados do estúdio continuam vazios (razão social, CPF/CNPJ, endereço, Instagram).
**Status:** fechado · conferido em produção.

---

## BUG-007 · Média · Atendimento futuro pode ser marcado como concluído, e a receita entra com a data de hoje
**Onde:** detalhe do agendamento — `src/app/agendamento/[id].tsx` (`onStatus`) e `complete_appointment` no banco
**Passos:**
1. Criar agendamento para daqui a 3 dias (ex.: QA Ana, 23/11 13:00, Alongamento em gel R$ 160).
2. Abrir o agendamento > Status > Concluído > Pix.
3. Abrir Financeiro.

**Esperado:** aviso ("Este atendimento é só em 23/11. Concluir mesmo assim?") ou bloqueio até o horário do atendimento.
**Obtido:** conclui sem aviso; a receita "Alongamento em gel 20/11 13:27 · Pix + R$ 160,00" entra hoje e soma no "Faturamento do dia" (R$ 470 → R$ 630) de um serviço não feito. O mesmo aconteceu no teste R5 do roteiro: sessão de pacote de 21/11 concluída em 20/11. A cliente também fica sem "última visita" na lista, porque o concluído está no futuro.
**Observação:** desfazer a conclusão funciona e tira a receita (conferido).
**Correção sugerida:** confirmar antes de concluir um atendimento que ainda não começou (app) e, se fizer sentido, recusar no banco com mensagem clara.
**Correção (commit dbebce4):** concluir antes do horário pede confirmação ("Concluir mesmo assim"); o banco continua aceitando (fila offline e conclusão antecipada intencional).
**Reteste em produção (20/11/2026):** atendimento de 23/11 13:00 → Concluído mostra "Concluir antes do horário? Este atendimento está marcado para seg, 23 de novembro às 13:00. Ao concluir agora, a receita entra no Financeiro com a data de hoje." Respondendo não: nada muda. Respondendo sim: abre a forma de pagamento (nada lançado antes da escolha). Agendamento de teste cancelado em seguida.
**Status:** fechado · conferido em produção.

---

## BUG-008 · Média · Cadastro de cliente aceita WhatsApp incompleto
**Onde:** Clientes > Nova cliente — `src/app/clientes/nova.tsx` (`canSave` não confere o telefone)
**Passos:** Nome "QA Telefone Curto", WhatsApp `119` > Cadastrar cliente.
**Esperado:** "Cadastrar" desabilitado ou aviso "confira o WhatsApp" até ter 10 ou 11 dígitos (o link público já exige isso).
**Obtido:** cadastra com WhatsApp "119"; a ficha mostra o botão WhatsApp, que abre conversa com um número inexistente (lembretes e comprovantes não chegam).
**Evidência:** teste na conta de teste em 20/11/2026; cliente apagada em seguida.
**Correção sugerida:** validar 10–11 dígitos quando preenchido (mesma regra do link) e mostrar "WhatsApp — confira o número" no rótulo, como já é feito com e-mail e data.
**Correção (commit dbebce4):** WhatsApp preenchido precisa ter 10 ou 11 dígitos.
**Reteste em produção (20/11/2026):** com `119` e com 9 dígitos o rótulo vira "WhatsApp — confira o número (DDD + número)" e "Cadastrar cliente" fica desabilitado; com 10 dígitos habilita; vazio continua permitido.
**Status:** fechado · conferido em produção.

---

## BUG-009 · Baixa · Acessibilidade: nomes técnicos ou de exemplo em mais três lugares
**Onde:**
- Botão de voltar do cabeçalho (ex.: Nova cliente): lido como **"(tabs), back"** (nome técnico, em inglês).
- Link público, etapa "Seus dados": campos lidos pelo exemplo — `textbox "(11) 90000-0000"` e `textbox "Ex: quero fazer francesinha"` — em vez de "WhatsApp" e "Observação".
- Nova cliente: anotações técnicas lidas pelo exemplo ("Ex: alergia a cola…").

**Esperado:** "Voltar, botão"; campos anunciados pelo rótulo (mesma correção do BUG-003).
**Evidência:** árvore de acessibilidade em produção, 20/11/2026.
**Correção (commit dbebce4):** botão voltar do cabeçalho com nome "Voltar"; link público com rótulos; anotações técnicas com rótulo.
**Reteste em produção (20/11/2026):** árvore de acessibilidade — Nova cliente: `button "Voltar"` (e volta para Clientes), `textbox "Anotações técnicas (opcional)"`; link público "Seus dados": `textbox "Nome completo"`, `textbox "WhatsApp"`, `textbox "Observação (opcional)"`.
**Status:** fechado · conferido na web (no celular, conferir o "Voltar" no próximo roteiro A2).

---

## BUG-010 · Baixa · Dados de exemplo criam atendimentos com o estúdio fechado
**Onde:** `loadExampleData` / `mockAppointments`
**Passos:** carregar dados de exemplo; ver a agenda.
**Obtido:** atendimentos no domingo (dia fechado: "Estúdio fechado") e às 08:30, antes da abertura (09:00), dentro da faixa "FECHADO".
**Esperado:** exemplos dentro do expediente, para não parecer que o app deixa agendar com o estúdio fechado.
**Correção (commit dbebce4):** exemplos às 08:30 passaram para 09:00 e todo exemplo fora do expediente ou em folga é pulado (`fitsHours` em `loadExampleData`); a série de cílios procura um dia em que 14:00 caiba.
**Reteste (20/11/2026):** conferido no código. A carga ponta a ponta precisa de uma conta sem exemplos (a de teste já tem): fazer junto com a conta Free da seção G do roteiro.
**Reteste ponta a ponta (20/11/2026, conta nova, expediente Seg–Sáb 9h–18h com almoço):** os 6 atendimentos de exemplo criados no Free caem todos dentro do expediente (nenhum no domingo, antes das 9h ou no almoço).
**Status:** fechado · conferido em produção.

---

## Melhorias anotadas no exploratório (20/11/2026, sem bug)
- `/termos` e `/privacidade` abertos direto pelo link não têm botão para ir ao app (proposital no código; um link "Entrar no app" no rodapé evita o beco sem saída).
- Nova cliente: com nome de 1 letra o botão fica desabilitado sem dizer por quê (exige 2 letras).
- Agenda: atendimentos de 45 min ou menos não mostram valor nem status no cartão (só a cor da barra).
- Ajustes na web: "Avisar agendamentos online · Ativo, aguardando registro do aparelho" — no navegador o push nunca registra; o texto pode confundir.
- Depois de salvar um agendamento em outro dia, a agenda volta para hoje em vez de mostrar o dia do agendamento.

**Funcionou bem:** conflitos de horário e duração, dia fechado com "Agendar fora do expediente", folga, salvar/cancelar agendamento, desfazer conclusão (receita sai do Financeiro), lucro líquido com taxas, busca sem acento e por telefone, validação de e-mail e data na ficha, validação do link público (nome só com espaços e WhatsApp com 9 dígitos recusados). Nenhum erro no console.
**Limitação do ambiente:** o navegador embutido do app de testes bloqueia `window.confirm` (responde "não" sem mostrar). No Chrome e no celular a confirmação aparece normalmente; para testar no navegador embutido foi preciso simular o "OK".

---

## BUG-011 · Alta · Na web, conta nova cai nos Termos sem botão e não chega ao primeiro acesso
**Onde:** site — `src/app/_layout.tsx` (rotas protegidas) e `src/components/legal-page.tsx`
**Passos:**
1. No site, Criar conta com um e-mail novo.
2. Observar a tela depois do cadastro; depois abrir `https://projeto-app-beleza.expo.app/`.

**Esperado:** abrir o primeiro acesso (`/onboarding`, "Boas-vindas! 💅" com o aceite dos Termos).
**Obtido:** vai para `/termos` (página pública dos Termos, sem botão "Voltar" nem "Continuar"). Abrir `/` também redireciona para `/termos`. A pessoa fica presa: só digitando `/onboarding` na barra de endereço o primeiro acesso aparece e funciona.
**Diagnóstico:** sessão válida e perfil com `onboardingCompleted = false` no aparelho; a guarda `needsOnboarding` deveria liberar `onboarding`, mas o roteador cai na rota pública `termos`. No celular o `LegalPage` tem `<Redirect>` para esse caso ("Se o roteador cair aqui sozinho (ex: logo depois do cadastro)"); na web não tem.
**Evidência:** conta descartável de QA em 20/11/2026, navegador embutido; `/` → `/termos` repetidas vezes; `/onboarding` direto funciona.
**Correção sugerida:** na web, quando há sessão e falta o primeiro acesso (ou o aceite), `LegalPage` sem `from=app` redireciona para `/onboarding` (como no celular) ou mostra "Continuar"; investigar por que `/` não cai em `onboarding` com a guarda ligada.
**Correção:** commit 6139c2e (sessão principal).
**Reteste (20/11/2026, produção):** conta descartável nova criada no site abriu direto em "Boas-vindas! 💅" (primeiro acesso). Sem login, `/` e `/onboarding` levam ao `/login`. ✅
**Status:** fechado.

---

## BUG-012 · Baixa · Primeiro acesso no plano Free trava ao criar os 4 serviços da especialidade
**Onde:** `src/app/onboarding.tsx` (passo 2, cria `specialty.services` um a um) × limite do Free (3 serviços ativos, `enforce_free_active_services`)
**Passos:** conta no Free antes de concluir o primeiro acesso (ex.: teste grátis vencido ou plano trocado) > passo 2 > "Manicure & Nail Design" (4 serviços) > Continuar.
**Esperado:** avançar com os serviços que cabem no plano (ou só 3 pré-selecionados no Free), com aviso.
**Obtido:** o 4º serviço é recusado (aviso de limite) e a tela não avança; na segunda tentativa avança (já existem serviços) e a conta fica com 3 dos 4. Ajustes mostra "Serviços e preços · 3 ativos".
**Impacto:** baixo hoje, porque contas novas começam no teste do Intermediário; acontece se o primeiro acesso for feito já no Free.
**Correção:** commit 6139c2e (sessão principal).
**Reteste (21/11/2026, produção):** conta descartável nova, colocada no Free por SQL antes do passo 2 > "Manicure & Nail Design" (4 serviços) > Continuar. Avançou no primeiro toque para o passo 3, com o aviso "3 serviços cadastrados · O plano Free permite 3 serviços ativos. Você pode trocar ou ajustar em Ajustes > Serviços…". Depois de concluir, Ajustes mostra "Serviços e preços · 3 ativos". ✅
Melhoria (sem bug): no Free, o texto do passo 2 ainda diz "já deixamos 4 serviços cadastrados"; poderia avisar antes que o plano guarda 3.
**Status:** fechado.

---

## BUG-013 · Baixa · Acessibilidade: botões sem nome em "Dados do estúdio" e na janela de excluir conta
**Onde:** Ajustes > Dados do estúdio (ícones/botões sem rótulo) e janela "Excluir minha conta" (botão "Cancelar")
**Passos:** abrir Ajustes > Dados do estúdio > Excluir minha conta; ler a árvore de acessibilidade.
**Obtido:** quatro `button` sem nome na tela (um deles é o "Cancelar" da janela de exclusão); o leitor de tela diz só "botão".
**Esperado:** cada botão com nome ("Cancelar", e o nome da ação de cada ícone).
**Evidência:** árvore de acessibilidade em produção, 20/11/2026 (conta descartável).
**Correção:** commit 6139c2e (sessão principal).
**Reteste (20/11/2026, produção, conta de teste):** em Dados do estúdio todos os botões têm nome ("Voltar", "Escolher logo do estúdio", "Link de agendamento online, disponível a partir do plano Intermediário", "Excluir minha conta", "Salvar dados"); na janela de exclusão, "Excluir conta para sempre" e "Cancelar". A janela foi fechada por "Cancelar", sem excluir. ✅
Resta só o campo de digitar a confirmação, nomeado pelo texto de exemplo "EXCLUIR" (aceitável).
**Status:** fechado.

---

## BUG-014 · Baixa · Acessibilidade: interruptores (liga/desliga) sem nome
**Onde:** `src/components/ui.tsx` — componente `Toggle` (usado em login, primeiro acesso, Ajustes, Dados do estúdio, Horários, Regiões e Serviços)
**Passos:** Ajustes > ler a árvore de acessibilidade do interruptor de "Avisar agendamentos online".
**Obtido:** `switch "on"`: o leitor de tela diz só "ligado", sem dizer o que liga. O `Toggle` não recebe nem repassa `accessibilityLabel`.
**Esperado:** o nome da opção ("Avisar agendamentos online, ligado").
**Correção sugerida:** `Toggle` aceitar `label` e repassar como `accessibilityLabel` ao `Switch`; preencher em cada uso com o texto da linha.
**Evidência:** produção, 20/11/2026, navegador embutido (conta de teste).
**Status:** aberto · baixa prioridade · correção para a sessão principal.

---

## Exclusão de conta (CT-CON-09) · 20/11/2026
Conta descartável no Free: Ajustes > Dados do estúdio > Excluir minha conta > digitar EXCLUIR > "Excluir conta para sempre". O app mostra "Sua conta foi excluída", volta ao login e o navegador fica sem dados guardados. SQL: login da conta excluída = 0; VAL-17 (dados sem perfil) = 0; VAL-18 (perfil sem login) = 0. ✅
21/11/2026: a conta descartável do reteste do BUG-012 foi excluída pelo mesmo caminho; o app voltou ao login, sem sessão guardada no navegador. ✅
