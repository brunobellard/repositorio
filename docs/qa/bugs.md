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
**Status:** corrigido · publicado e conferido nas telas públicas.

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
