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
**Correção:** commit 662c9ee (sessão principal): `Toggle` exige `label` e repassa como `accessibilityLabel`; o passo 2 do primeiro acesso usa o limite do plano no texto ("3 serviços" no Free).
**Reteste (21/11/2026, produção, conta de teste, árvore de acessibilidade):** Ajustes → `switch "Avisar agendamentos online"`; Horário de funcionamento → `"Segunda aberto"` … `"Domingo aberto"`; Serviços e preços → `"<serviço> ativo"` (8 interruptores, ex.: "Manicure ativo"). ✅
Dados do estúdio, com a conta de volta no Pro → `"Aprovação automática"`. ✅
Não vistos nesta conta (só aparecem em outra situação; nomes conferidos no código): "Região ativa" (atendimento a domicílio), "Entrar com digital/Face ID" (só no celular), "Pausa para almoço" (primeiro acesso).
**Status:** fechado.

---

## BUG-015 · Média · Não dá para marcar atendimento depois das 22:00 (nem que atravesse a meia-noite)
**Onde:** `src/app/agendamento/novo.tsx` (grade de horários com "fora do expediente" fixa em 07:00–22:00; link "Agendar fora do expediente" só aparece em dia fechado ou folga) e `src/components/agenda/day-timeline.tsx` (a agenda só desenha as horas do expediente).
**Passos (CT-AGE-12):** dia aberto (ex.: até 19:00) > Novo agendamento > procurar 23:00, ou tocar na agenda depois do fechamento.
**Obtido (celular Android, 21/11/2026):** não há opção de agendar fora do expediente num dia aberto. No código: o link só aparece com o dia fechado ou de folga; pela agenda só dá para tocar fora do expediente se a hora aparecer na tela (ela mostra só o expediente); e mesmo com "fora do expediente" a grade vai das 07:00 às 21:30 (o atendimento tem que acabar até 22:00). Um horário 23:00–00:30 não tem como ser criado pelo app.
**Esperado:** num dia aberto também poder liberar horários fora do expediente (antes de abrir e depois de fechar), e a grade ir até perto da meia-noite, aceitando atendimento que termina no dia seguinte. A agenda e o banco já tratam o atendimento que atravessa a meia-noite (CT-AGE-12).
**Correção sugerida:** mostrar "Agendar fora do expediente" sempre (não só em dia fechado); com ele ligado, grade de 00:00 a 23:30 e `fits` sem limite de fim do dia.
**Correção:** commit 7aea7a8 (sessão principal).
**Reteste (21/11/2026, produção, conta de teste, navegador embutido):**
- Terça 24/11 (dia aberto): "Agendar fora do expediente" aparece abaixo dos horários. Ligado, a grade vai até 23:45.
- Cliente QA Teste, QA Manicure + Manicure (1h45), 23:00 → "Das 23:00 às 00:45 do dia seguinte" → "Agendamento salvo". Na agenda de terça aparece às 23:00. ✅
- Quarta 25/11, fora do expediente: 00:00, 00:15 e 00:30 indisponíveis; 00:45 livre (não encosta no atendimento da véspera). ✅
- Depois, o agendamento foi cancelado.

A agenda de quarta não mostra o pedaço 00:00–00:45: ficou registrado no BUG-016.
**Status:** fechado.

---

## BUG-016 · Baixa · Atendimento que passa da meia-noite não aparece na agenda do dia seguinte
**Onde:** `src/app/(tabs)/index.tsx`, l.63: `dayAppts` filtra só por `isSameDay(startsAt, selected)`.
**Passos (CT-AGE-12):** criar atendimento terça 23:00–00:45 (fora do expediente) > abrir a agenda de quarta.
**Obtido (21/11/2026, produção, navegador embutido):** quarta mostra "0 atendimentos" e a grade começa às 09:00. O trecho 00:00–00:45 não aparece, embora o horário esteja ocupado (o formulário de novo agendamento bloqueia 00:00–00:30).
**Esperado:** o atendimento aparecer também no começo do dia seguinte. O `day-timeline` já corta o que começa na véspera e alarga a grade para mostrar o horário.
**Correção sugerida:** filtrar os atendimentos que se sobrepõem ao dia (`startsAt < fim do dia && endsAt > início do dia`), não só os que começam nele. Conferir se o total "previsto" do dia não conta o atendimento duas vezes.
**Melhoria:** a tela do agendamento mostra "23:00 – 00:45", sem dizer "do dia seguinte".
**Correção:** commit 701e29a (sessão principal).
**Reteste (21/11/2026, produção, conta de teste, navegador embutido):**
- Criado terça 24/11 23:00–00:45 (QA Teste, fora do expediente).
- Quarta 25/11: a grade começa às 00:00 e mostra o atendimento das 00:00 às 00:45. O cabeçalho diz "1 atendimento · R$ 0,00 previsto": o valor fica só na terça. ✅
- Tela do agendamento: "23:00 – 00:45 do dia seguinte · 1h45". ✅
- Depois, o agendamento foi cancelado.

Melhoria: na quarta (folga dos dados de exemplo), o aviso "Folga · Dia inteiro sem atendimentos" continua aparecendo junto com esse atendimento.
Feita no commit 8577ac6 (sessão principal). Conferida em 21/11/2026, produção, navegador embutido:
- Quarta só com atendimentos cancelados: "Dia inteiro sem atendimentos · toque para liberar". ✅
- Com o da véspera ativo (terça 23:00–00:45): "1 atendimento mesmo assim · toque para liberar o dia". ✅
- Depois, o agendamento foi cancelado.
**Status:** fechado.

---

## BUG-017 · Alta · "Mudar status" foi parar dentro dos botões de forma de pagamento
**Onde:** `src/app/agendamento/[id].tsx` (commit 2c0257d, melhorias de UX P1), ~l.369–392. O bloco `{/* Status (controle secundário) */}`, com `<SectionLabel>Mudar status</SectionLabel>` e `STATUSES.map(...)`, ficou dentro do `<Pressable>` de cada forma de pagamento (`METHODS.map`). Está entre o `ActivityIndicator` e o `<Text>{paymentLabels[m]}</Text>`.
**Passos:** abrir um atendimento que já começou (ex.: Larissa Oliveira, hoje 09:00, confirmado) > ver a tela > tocar "Concluir e receber R$ 35,00".
**Obtido (21/11/2026, produção, navegador embutido, conta de teste):**
- Fora do pagamento, a seção "Mudar status" não aparece: não dá para voltar a Pendente/Confirmado nem marcar Concluído sem passar pelo pagamento.
- Depois de tocar "Concluir e receber", cada botão de pagamento mostra os chips Pendente/Confirmado/Concluído sobrepostos, e o nome da forma de pagamento (Pix, Crédito…) fica escondido. Tocar num chip ali pode disparar também o pagamento.
- Nenhum pagamento foi escolhido no teste.

**Esperado:** "Mudar status" como seção própria, abaixo das ações, sempre visível. Os botões de pagamento mostram só o nome da forma de pagamento.
**Correção sugerida:** fechar o `Pressable`/`Card` do pagamento antes do bloco de status e tirar "Mudar status" de dentro do `askPayment`.
**Correção:** commit 653c3af (sessão principal).
**Reteste (21/11/2026, produção, navegador embutido, conta de teste, Larissa 09:00):**
- "Mudar status" (Pendente, Confirmado, Concluído) aparece logo abaixo de "Concluir e receber R$ 35,00". ✅
- Ao tocar "Concluir e receber", o cartão "Forma de pagamento" mostra só Pix, Crédito, Débito e Dinheiro, e "Mudar status" fica abaixo dele. ✅
- A tela foi fechada sem escolher pagamento.

**Status:** fechado.

---

## Regressão das melhorias de UX P1 (commit 2c0257d) · 21/11/2026
Produção, navegador embutido, conta de teste. Fora o BUG-017 (corrigido em 653c3af e retestado), tudo ✅:
- **Detalhe do agendamento:**
  - "Concluir e receber R$ 35,00" num atendimento que já começou.
  - "Confirmar agendamento" num pedido do link pendente.
  - Futuro e não online: sem botão principal.
- **Cancelar atendimento:**
  - Num avulso (QA Teste, hoje 11:00) cancela na hora e mostra "Atendimento cancelado" com "Desfazer". "Desfazer" voltou para Pendente.
  - Numa sessão de série (30/11 16:00) pergunta "Cancelar apenas este / este e os próximos / todos da série". Fechado com "Voltar", sem cancelar.
- **Novo agendamento (aberto pela Agenda, terça 24/11):**
  - "Agendar" tocável. Vazio: "Falta: cliente, serviço". Com cliente e serviço: "Falta: horário", e a tela rola até a seção.
  - Cliente nova pelo formulário: nome "Z" → "pelo menos 2 letras"; WhatsApp "(11) 99" → "DDD + número". Cancelada sem salvar.
  - Ao salvar (QA Teste, 16:00), a Agenda abriu em 24/11. Depois o agendamento foi cancelado.
- **Clientes > Nova cliente:** "Cadastrar cliente" vazio → "Confira o cadastro · Falta: nome (pelo menos 2 letras)".
- **Agenda:** faixa "1 pedido pelo link aguardando você" com número 1 no ícone da aba. A lista "Pedidos pelo link" tem Confirmar e Recusar (não usados). Cartões com ícone de status.
- **Link público:**
  - Sem serviço → "Escolha um serviço".
  - Sem dia → "Escolha o dia".
  - Sem horário → "Escolha o horário".
  - Seus dados vazios → "Confira seus dados · Falta: nome completo, WhatsApp com DDD". Nada foi enviado.
  - Melhoria: o aviso "Escolha o horário" repete o subtítulo dos dias ("Os dias em destaque têm horários livres"); o certo seria falar dos horários.
- **Contraste AA:** coberto pelos 19 testes de `__tests__/unit/theme-test.ts`, da sessão principal.

---

## BUG-018 · Baixa · Ajustes mostra a cor do tema como código (#956675) e nenhuma paleta aparece marcada
**Onde:** `src/app/(tabs)/ajustes.tsx` l.211 (`THEME_PRESETS.find((p) => p.hex === colors.primary)`) e a seleção de paleta em `src/app/ajustes/aparencia.tsx`. Desde o contraste AA do 2c0257d, `colors.primary` é a versão escurecida da cor escolhida (#C08497 → #956675) e não bate mais com o HEX da paleta.
**Passos:** conta de teste com o tema padrão (Rosé Antigo) > Ajustes > ver "Aparência e cores" > abrir a tela.
**Obtido (21/11/2026, produção, navegador embutido):**
- Em Ajustes, "Aparência e cores" mostra "#956675" (antes mostrava "Rosé Antigo").
- Em Aparência e cores, nenhuma das paletas fica marcada.

**Esperado:** "Rosé Antigo" no detalhe e a paleta marcada.
**Correção sugerida:** comparar com a cor escolhida, guardada no perfil/tema, e não com `colors.primary` escurecida.
**Correção:** commit faab3b2 (sessão principal): o ThemeContext expõe `chosenColor`.
**Reteste (21/11/2026, produção, navegador embutido):**
- Ajustes: "Aparência e cores → Rosé Antigo". ✅
- Aparência e cores: "Rosé Antigo (#C08497)" marcado. ✅

**Status:** fechado.

---

## BUG-019 · Baixa · "Outra data": a faixa de dias não mostra o dia escolhido
**Onde:** `src/app/agendamento/novo.tsx`, faixa horizontal de datas, depois de escolher um dia em "Outra data" (414d88b; a correção de faab3b2 não resolveu na web).
**Passos:** Novo agendamento (25/11) > "Outra data" > escolher 11/12.
**Obtido (21/11/2026, produção, navegador embutido, 375 px e desktop):**
- O 11/12 fica selecionado, mas a faixa rola até o fim. Aparecem 15–18/12, e o dia escolhido fica fora da tela (scrollLeft 1561 de 1936).
- Para ver o dia marcado é preciso rolar para trás.

**Esperado:** a faixa para com o dia escolhido visível, de preferência no centro.
**Correção sugerida:** depois de a faixa crescer, rolar até a posição do dia escolhido (índice × largura do item), não até o fim (`scrollToEnd`).
**Causa (sessão principal, 21/11):** é o mesmo problema do UX-05. Ao fechar o calendário, o navegador devolve o foco ao botão "Outra data", o último item da faixa, e rola até ele. Correção em andamento: o botão sai da faixa e vai para o lado do rótulo "Data".
**Correção:** commit da0c7ff (sessão principal).
**Reteste (21/11/2026, produção, navegador embutido):**
- Novo agendamento (25/11): "Outra data" aparece ao lado do rótulo "Data", fora da faixa.
- Escolhido 10/12: fica selecionado e visível no meio da faixa (7 a 14/12 na tela). ✅

UX-15, que entrou no mesmo commit: ~2,3 s depois de a Agenda abrir, o app baixa em segundo plano o código das telas de detalhe e de novo agendamento. Ao abrir um agendamento pelo cartão, nenhum código novo é baixado e o detalhe aparece sem intervalo em branco. ✅

**Status:** fechado.

---

## Regressão do commit faab3b2 (medição de uso, BUG-018, Financeiro, Outra data) · 21/11/2026
Produção, navegador embutido, conta de teste:
- BUG-018 fechado (acima).
- Financeiro em 375 px: título "Financeiro" numa linha só; "Exportar" e "Vender pacote" na linha de baixo. ✅
- Outra data: BUG-019.
- Fluxo completo sem erro do servidor (todas as chamadas 2xx no Resource Timing):
  - novo agendamento (QA Teste, terça 24/11 16:00) → `create_appointment` 200 e `app_events` 201;
  - concluir com Pix (pede "Concluir antes do horário?") → `complete_appointment` 200 e "Receita lançada: R$ 50,00 · Pix";
  - desfazer ("Desfazer a conclusão?") → receita sai;
  - cancelar.
- O agendamento ficou cancelado.
- Eventos: `app_events` grava com 201 depois de criar o agendamento e de escolher "Outra data". O envio é silencioso, sem aviso na tela. ✅
- O console mostrou dois "400" sem endereço, num momento que não consegui repetir. Nas repetições nenhuma chamada ao banco deu 400 (as únicas falhas foram as checagens de conexão `HEAD /`, canceladas de propósito). Fica em observação. Hipótese da sessão principal: fila de eventos antiga do aparelho, de antes da migração, descartada no primeiro envio. Se aparecer de novo, anotar a URL na aba Rede.
- API (local, com a chave pública): CT-EVT-01 a 05 ✅. O CT-EVT-06 e os de regras de negócio precisam da senha da conta de teste e rodam no CI. Unitários: 112 ✅.
- SQL (rodado pelo usuário no SQL Editor, 21/11): VAL-20 = 0 tabelas sem RLS (app_events protegida); VAL-21 só as 4 do link público como "ok", nenhuma "PROBLEMA"; VAL-22 false/false nas 4 funções, incluindo `purge_old_app_events()`. ✅
- Não testado: Política de Privacidade atualizada (texto jurídico; só a data foi vista na mensagem da sessão principal).

---

## Regressão do pacote de UX P2/P3 (commit 414d88b) · 21/11/2026
Produção, navegador embutido, conta de teste. Fora o BUG-018, tudo ✅:
- **Compartilhar link:**
  - Ajustes > "Compartilhar link de agendamento" envia "Agende seu horário comigo no QA Estúdio: …/agendar/qa-estudio".
  - O compartilhamento foi interceptado no navegador; nada foi enviado.
  - Dia vazio da Agenda (01/12): "Nenhum horário marcado neste dia" + "Compartilhar meu link".
- **Novo agendamento:**
  - Na quarta 25/11 (folga): "Próximo livre: Qui, 26 de novembro às 09:00" + "Usar". "Usar" levou ao dia 26 e marcou 09:00.
  - "Outra data" abre o calendário, e o dia 10/12 ficou selecionado. Nada foi salvo.
  - Melhoria: depois de "Outra data", a faixa de dias não rola até o dia escolhido; aparecem 14–17/12 e o 10/12 fica fora da tela.
- **Financeiro:**
  - Seletor de mês (Outubro vazio, com "+ Lançar despesa"); para em novembro de 2025.
  - Hoje / Esta semana / Este mês mudam os cartões. Hoje: R$ 350,00, 6 pagos, lucro R$ 345,80 já sem R$ 4,20 de taxas.
  - Receitas com o nome da cliente ("Manicure · QA T."), "+ Despesa" e "Vender pacote".
- **Atendimento cancelado:** "Atendimento cancelado: lembretes e confirmação não se aplicam."
- **Clientes:** filtros em duas linhas ("Todas", "Para chamar de volta", "Aniversariantes de novembro").
- **Ajustes:** "Envio automático (WhatsApp) · Em breve".
- **API:** CT-SEG-11 agora inclui `remove_example_data`. Sem login: "permission denied for function" ✅.
- **Não testado:**
  - "Remover dados de exemplo": só aparece com exemplos marcados, e a conta de teste tem exemplos antigos, sem marca. Apagar dados precisa de autorização.
  - "Primeiros passos" e "Confirme o nome do estúdio": precisam de conta nova.

---

## BUG-020 · Baixa · PostHog faz chamadas de feature flags no login e depois de sair da conta
**Onde:** `src/services/telemetry.ts` (commit eab8b92). O comentário de `preloadFeatureFlags: false` diz "sem chamadas extras", e `posthog.reset()` é chamado ao sair.
**Passos:** web, tela de login > entrar com a conta de teste > ver as chamadas a `*.posthog.com` > sair da conta > usar o link público.
**Obtido (21/11/2026, produção, navegador embutido, registrador de `fetch`):**
- Ao entrar: `GET us-assets.i.posthog.com/array/<chave>/config` e 2× `POST us.i.posthog.com/flags/?v=2`, com `distinct_id` = UUID da conta, plano e dados do aparelho (sem e-mail ou nome).
- Depois de sair: 1× `POST /flags/?v=2` com um `distinct_id` anônimo novo (o `reset()` recarrega as flags). Nenhum evento (`/batch`) foi enviado depois de sair. ✅

**Esperado:** o app não usa feature flags, então nenhuma chamada a `/flags`, e nada ao PostHog depois de sair. Cada chamada leva o IP do aparelho ao PostHog, embora `$geoip_disable` esteja ligado nos eventos.
**Correção sugerida:** desligar o carregamento de flags (ex.: opção de não buscar flags ou `disableRemoteConfig`, conforme a versão do posthog-react-native) e, ao sair, usar `optOut()` ou descartar a instância em vez de só `reset()`.
**Correção (sessão Logs & Analytics, 21/11, local, ainda sem commit nem deploy):** `disableRemoteFeatureFlags: true` em `telemetry.ts`. Sem `/flags` no login, no `identify` e no `reset()`.
O `GET /array/<chave>/config` (1× por abertura, sem UUID) continua: o posthog-react-native 4.87.1 não deixa desligar (`disableRemoteConfig` não faz nada). Esse ponto fica como **limitação do fornecedor**, aceita.
**Reteste pendente:** depois do deploy, conferir login, uso e saída da conta: nenhum `/flags`, só `/config` na abertura e `/batch` com login.
**Correção:** commit ee6a7de (sessão Logs & Analytics).
**Reteste (21/11/2026, produção web, navegador embutido, registrador de `fetch` instalado antes do login):**
- Entrar: `GET /array/<chave>/config` (1×) + `POST /batch/` com `$identify` (`distinct_id` = UUID da conta; `$set` só com `platform` e `app_version`; `$geoip_disable: true`).
- Usar: Novo agendamento > Agendar vazio → `/batch/` com `appointment_form_opened` e `appointment_save_blocked`.
- Sair ("Sair da conta?") e usar o link público até a etapa de data: nenhuma chamada ao PostHog.
- Total: 0 chamadas a `/flags`. ✅
- O `/config` na abertura continua, aceito como limitação do fornecedor.

Política, seção 6: retenção no banco (até 13 meses), no PostHog (até 12 meses, apagado junto com a conta) e no Sentry (até 90 dias). ✅
Não testado: exclusão da pessoa no PostHog ao apagar a conta. Depende de o usuário cadastrar `POSTHOG_PERSONAL_API_KEY`/`POSTHOG_PROJECT_ID` e publicar a `delete-account`, e de apagar uma conta descartável.

**Status:** fechado.

---

## Regressão da telemetria Sentry + PostHog (commits eab8b92 e 8636033) · 21/11/2026
Produção web, navegador embutido, conta de teste. Registrador de `fetch`/XHR/sendBeacon instalado antes do login; corpo do `/batch` descompactado (gzip). Fora o BUG-020, tudo ✅:
- **Sem login:** a tela de login e o link público (`/agendar/qa-estudio`, até a etapa de data) não fazem nenhuma chamada a PostHog ou Sentry. Só `public_studio`, `get_public_busy_slots` e `log_public_event`.
- **Com login:** `identify` com `distinct_id` = UUID da conta e `$set` só com `platform`, `app_version` e `plan`.
- **Evento `appointment_save_blocked`** (Agendar com o formulário vazio): `origin: agenda`, `missing: cliente-servicos`, `$geoip_disable: true`, `$is_identified: true`, `$recording_status: disabled`. Sem e-mail, nome, telefone, CPF ou texto digitado.
- **Ao sair** ("Sair da conta?" confirmado): nenhum `/batch` depois, mesmo usando a tela de login e o link público. Só a chamada de flags do BUG-020.
- **Console:** só o 400 de `auth/v1/token?grant_type=refresh_token` (sessão salva expirada ao reabrir o navegador). Ela é a causa provável dos dois "400 sem endereço" anotados na regressão do faab3b2. Nenhum erro novo da telemetria.
- **Política de Privacidade** (`/privacidade`, "Última atualização: 21 de novembro de 2026"): seções 2 a 5 citam Sentry e PostHog e dizem que o link público não vai ao PostHog, como observado. O e-mail de contato continua o do BUG-001.
- **Unitários:** 86 ✅, incluindo `telemetry-scrub-test.ts`.
- **Não testado:** envio real de erro ao Sentry (provocar um erro em produção) e celular (precisa de build nova com os pacotes nativos).

---

## BUG-021 · Média · Ao excluir a conta, a pessoa não é apagada no PostHog (busca devolve 401)
**Onde:** `supabase/functions/delete-account/index.ts`, `deletePostHogPerson` (commit ee6a7de), e os segredos `POSTHOG_PERSONAL_API_KEY` / `POSTHOG_PROJECT_ID` da função.
**Passos (21/11/2026, produção web, navegador embutido):**
1. Conta descartável criada pelo usuário (estúdio "test").
2. O app mandou ao PostHog `$identify`, `$set`, `appointment_form_opened` e `appointment_form_abandoned` com `distinct_id` 3f679d6c-c5d4-4483-89d8-fe71e475c738.
3. Em Persons, a busca por esse id achou a pessoa 366fb283-7075-5806-9141-e9540be460e3.
4. Ajustes > Dados do estúdio > Excluir minha conta > EXCLUIR > "Excluir conta para sempre".

**Obtido:**
- A conta foi excluída (`delete-account` 200, "Sua conta foi excluída", volta ao login). ✅
- O log da função diz: `delete-account: falha ao apagar no PostHog 3f679d6c-… Error: busca 401`. A pessoa e os eventos continuam no PostHog.

**Esperado:** pessoa e eventos apagados no PostHog, como diz a Política (seção 6: "Ao excluir a conta, o cadastro da conta no PostHog e os eventos ligados a ela são apagados automaticamente").
**Causa provável:** 401 é autenticação, antes de qualquer escopo (escopo faltando daria 403). Opções:
- o segredo não é uma chave pessoal `phx_…` (por exemplo, a chave de projeto `phc_…` do app);
- a chave foi colada com espaço ou aspas;
- a chave foi revogada;
- a chave é de outra região (o app usa US; o host padrão da função é `https://us.posthog.com`).

**Correção sugerida:** criar uma Personal API key (`phx_…`) com `person:read` e `person:write` no projeto certo, regravar com `supabase secrets set` e repetir o teste com outra conta descartável.
**Pendência do usuário:** apagar à mão no PostHog a pessoa 366fb283-… (Persons > lixeira, marcando também os eventos). A conta já não existe, então a função não vai rodar de novo para ela.
**Correção (usuário, 21/11):** nova Personal API key `phx_` com acesso só ao "Default project" e escopo Person = Write, gravada com `supabase secrets set`. A pessoa 366fb283-… foi apagada à mão no PostHog.
**Reteste (21/11/2026, produção web, navegador embutido):**
- Nova conta descartável (estúdio "Teste"), `distinct_id` 127563ac-2c34-42f2-9249-150caffe4b3b.
- O app mandou `$identify`, `$set`, `appointment_form_opened` e `appointment_form_abandoned`.
- O usuário achou a pessoa em Persons.
- Ajustes > Dados do estúdio > Excluir minha conta > EXCLUIR → `delete-account` 200 e volta ao login.
- O usuário recarregou Persons: a pessoa sumiu. ✅
- SQL depois das duas exclusões (22/11, pelo usuário): VAL-17 (dados sem perfil) = 0 e VAL-18 (perfil sem login) = 0. ✅
- Os eventos o PostHog apaga em segundo plano.

**Status:** fechado.

---

## BUG-022 · Baixa · Token de acesso inválido mostra erro técnico em inglês ("No suitable key or wrong key type")
**Onde:** `src/lib/supabase.ts`, `friendlyError`. Os erros de JWT do PostgREST (`PGRST301` inválido, `PGRST303` expirado) não estão no `switch` e caem no `return error.message`, em inglês.
**Passos (22/11/2026, produção web, navegador embutido, conta de teste):**
1. Logada, alterar só a assinatura do `access_token` guardado (`sb-…-auth-token`), mantendo o refresh token.
2. Recarregar a página.

**Obtido:**
- Todas as leituras e gravações do carregamento dão 401.
- O app mantém a tela com os dados guardados (certo) e mostra o aviso "Erro ao carregar dados · No suitable key or wrong key type".
- Não pede para entrar de novo nem tenta renovar a sessão.

**Esperado:** texto em português, por exemplo "Sua sessão expirou. Entre de novo.", e, de preferência, renovar a sessão (`refreshSession`) ou levar ao login.
**Correção sugerida:** tratar `PGRST301`/`PGRST302`/`PGRST303` em `friendlyError` como sessão expirada; no `store_reload`, com esses códigos, tentar `supabase.auth.refreshSession()` antes de avisar.
**Observação:** na prática acontece com token adulterado ou chave do projeto trocada (rotação de JWT). Um token só vencido é renovado pelo cliente antes da chamada.
**Status:** aberto (sessão principal).

---

## CT-TEL-07 · Erro real chegando ao Sentry (web) · 22/11/2026
- Mesmo teste do BUG-022: o carregamento falhou com 401 e o app chamou `captureError(…, { where: "store_reload", code })`.
- O navegador enviou um envelope a `https://o…ingest.de.sentry.io/api/…/envelope/` (região UE), com resposta 200. ✅
- O token original foi devolvido e a página recarregada: carregamento normal, sem nenhum 401. A sessão continuou válida.
- **Conferido pelo usuário no Sentry (Issues, evento 988c0e79):**
  - título "Erro PGRST301 · No suitable key or wrong key type", nível error, `handled: yes`;
  - tags `where: store_reload`, `plan: pro`, `platform: web`, `environment: production`, `release: 1.0.0`;
  - usuário só com o id 05ee8f63-…; dado extra só `code: PGRST301`;
  - breadcrumbs com as chamadas 401 ao Supabase (URLs com o id da conta, sem dados de clientes);
  - sem e-mail, nome ou telefone. ✅
- **Achados no evento:**
  - BUG-023: localização pelo IP (Ubatuba).
  - BUG-024: span_id estragado pelo filtro.
  - O stack trace está minificado (`__common-….js`): sem source maps da web. O 8636033 cuida só das builds nativas.
- Mobile: não testado (precisa de build com o Sentry nativo).

---

## BUG-023 · Baixa · Sentry guarda a localização pelo IP ("Ubatuba, Brazil")
**Onde:** configurações do projeto no Sentry (não é código). `sendDefaultPii: false` não impede o Sentry de calcular a localização pelo IP de quem envia.
**Obtido (22/11/2026, evento 988c0e79):** Contexts > User > Geography = "Ubatuba, Brazil".
**Esperado:** nem IP nem localização. A Política (seção 2) descreve o que vai ao Sentry e não cita localização; com o PostHog, o IP já é descartado (CT-TEL-05).
**Correção sugerida:** no Sentry, Settings > Security & Privacy (da organização ou do projeto), ligar "Prevent Storing of IP Addresses". Depois, conferir num evento novo que Geography some.
**Status:** aberto (usuário / sessão Logs & Analytics).

---

## BUG-024 · Baixa · O filtro de dados estraga o id do trace no Sentry ("Processing Error")
**Onde:** `src/lib/telemetry-scrub.ts`, l.116–125 e l.33. `scrubEvent` passa `scrubValue` em todos os `event.contexts`, inclusive `contexts.trace` (span_id e trace_id em hexadecimal), e a regra de números longos troca trechos com 8 ou mais dígitos por "[numero]".
**Obtido (22/11/2026, evento 988c0e79):** "Event Processing Errors: Discarded invalid value · contexts.trace.span_id · 979ed[numero]d · not a valid span id". O erro fica sem ligação com o trace de desempenho.
**Esperado:** ids técnicos (trace_id, span_id, parent_span_id, event_id) passam sem filtro.
**Correção sugerida:** pular `contexts.trace` (ou as chaves `*_id` em hexadecimal) no `scrubValue` e incluir um teste em `__tests__/unit/telemetry-scrub-test.ts` com um span_id como "979ed12345678d".
**Status:** aberto (sessão Logs & Analytics).

---

## Exclusão de conta (CT-CON-09) · 20/11/2026
Conta descartável no Free: Ajustes > Dados do estúdio > Excluir minha conta > digitar EXCLUIR > "Excluir conta para sempre". O app mostra "Sua conta foi excluída", volta ao login e o navegador fica sem dados guardados. SQL: login da conta excluída = 0; VAL-17 (dados sem perfil) = 0; VAL-18 (perfil sem login) = 0. ✅
21/11/2026: a conta descartável do reteste do BUG-012 foi excluída pelo mesmo caminho; o app voltou ao login, sem sessão guardada no navegador. ✅
