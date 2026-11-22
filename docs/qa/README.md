# QA — Agenda Beleza

| Documento | Para quê |
|---|---|
| [plano-de-testes.md](plano-de-testes.md) | Escopo, estratégia, ambiente, critérios de liberação, riscos |
| [casos-de-teste.md](casos-de-teste.md) | Todos os cenários com ID, prioridade, tipo e status |
| [massa-de-dados.md](massa-de-dados.md) | Conta, serviços, clientes e valores de borda para testar |
| [bugs.md](bugs.md) | Bugs encontrados, com passos e evidências |
| [roteiro-celular.md](roteiro-celular.md) | Testes manuais no celular (regressão marcada com 🔁) |
| [validacao-sql.sql](validacao-sql.sql) | Consultas (só leitura) que conferem os dados reais no Supabase |

## Rodar os testes automatizados

```powershell
npm test
```
Testes das regras do app (sem banco).

```powershell
npm run test:api
```
Permissões e link público no Supabase. As regras com login só rodam se `QA_TEST_EMAIL` e `QA_TEST_PASSWORD` estiverem definidos (conta de teste). O slug do estúdio vai em `QA_STUDIO_SLUG`.

```powershell
$env:QA_TEST_EMAIL="..."; $env:QA_TEST_PASSWORD="..."; $env:QA_STUDIO_SLUG="..."; npm run test:api
```

Interface no celular: ver [.maestro/README.md](../../.maestro/README.md).

## Criar a conta de teste (uma vez)
1. No site ou no app, **Criar conta** com um e-mail só para testes (ex.: `seuemail+qa@gmail.com`) e uma senha gerada pelo gerenciador de senhas. Confirmar o e-mail se pedido.
2. Primeiro acesso: estúdio **"QA Estúdio"**, fuso America/Sao_Paulo, aceitar os Termos. Não carregar dados reais.
   O **link de agendamento precisa começar com `qa-`** já no primeiro acesso. Com o nome "QA Estúdio", o link sugerido já sai `qa-estudio`.
3. Ajustes > Link de agendamento: confira que o link começa com `qa-` (ex.: `qa-estudio`). Ele é o `QA_STUDIO_SLUG`.

**Por que `qa-`:** com o link começando por `qa-`, o app manda ao PostHog `$internal_or_test_user: true`, e a conta sai dos painéis de uso real (coorte "Internal / Test users"). Contas reais não mandam essa marca, e o Sentry não recebe nada dela.
- Vale também para **contas descartáveis**: no primeiro acesso, use um nome que gere o link `qa-…` (ex.: "QA Descartável") ou digite o link à mão.
- Se o link for trocado para `qa-…` depois, o app marca a conta de novo, mas os eventos de antes da troca ficam fora do filtro.
4. SQL Editor: deixar o plano Pro ativo de vez (senão vira Free quando o teste grátis de 14 dias acabar e os casos de pacote/link são pulados):
   ```sql
   update profiles set plan_tier = 'pro', subscription_status = 'active'
    where id = (select id from auth.users where email = 'E-MAIL-DA-CONTA-DE-TESTE');
   ```
5. Cadastrar os 5 segredos abaixo no GitHub.

## CI (GitHub Actions)
`.github/workflows/qa.yml` roda a cada push na `main`: typecheck, lint, testes unitários e, se os segredos existirem, os testes de API.
Sem os segredos, o job `api` fica verde mas pula os testes; o resumo da execução mostra o aviso "Testes de API incompletos".
Segredos em **GitHub > Settings > Secrets and variables > Actions**:
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `QA_TEST_EMAIL`, `QA_TEST_PASSWORD`, `QA_STUDIO_SLUG`.
