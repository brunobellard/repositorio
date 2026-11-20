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

## CI (GitHub Actions)
`.github/workflows/qa.yml` roda a cada push na `main`: typecheck, lint, testes unitários e, se os segredos existirem, os testes de API.
Segredos em **GitHub > Settings > Secrets and variables > Actions**:
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `QA_TEST_EMAIL`, `QA_TEST_PASSWORD`, `QA_STUDIO_SLUG`.
