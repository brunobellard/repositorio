# Plano de testes — Agenda Beleza

Versão 1.0 · 20/11/2026 · Responsável: QA

## 1. Objetivo
Garantir que o app (Android, iPhone e web) e o link público de agendamento funcionam conforme as regras de negócio, sem perder dados, sem vazar dados entre estúdios e com mensagens claras em português.

## 2. Escopo

| Módulo | Dentro do escopo |
|---|---|
| Conta | Criar conta, entrar, sair, esqueci a senha, digital, excluir conta, primeiro acesso (onboarding) |
| Agenda | Novo agendamento, edição, série recorrente (só este / este e os próximos / todos), cancelar, concluir, desfazer, conflitos, domicílio e deslocamento |
| Clientes | Cadastro, ficha, histórico de 12 meses e completo, "Para chamar de volta", aniversariantes, excluir/apagar dados (LGPD), exportação |
| Pacotes | Vender, usar sessões, saldo, validade, editar, excluir, comprovante |
| Financeiro | Receitas automáticas, despesas, taxas de maquininha, exportação (planilha e PDF) |
| Link público | Escolha de serviços, local, data/hora, dados da cliente, limites contra abuso, fuso horário |
| Planos | Limites do Free, recursos por plano, teste grátis vencido |
| Offline | Cache, fila de alterações, sincronização, abertura sem internet |
| Notificações | Push de novo agendamento pelo link |
| Segurança | RLS (cada estúdio só vê o que é seu), funções restritas, segredos fora do repositório |

Fora do escopo nesta versão: pagamento da assinatura nas lojas, desempenho com mais de 5.000 atendimentos, testes de carga.

## 3. Estratégia (pirâmide)

| Nível | Ferramenta | Onde roda | O que cobre |
|---|---|---|---|
| Unitário | Jest (`npm test`) | Computador e CI, sem banco | Regras de pacotes, recorrência, conflitos de horário, planos, retorno de clientes, fuso, formatação |
| API / banco | Jest (`npm run test:api`) | Computador e CI, Supabase de produção | Permissões sem login (RLS), funções restritas, link público, regras com a conta de teste |
| Dados | SQL (`docs/qa/validacao-sql.sql`) | SQL Editor do Supabase | Consistência dos dados reais (pacotes, receitas, sobreposição, LGPD, órfãos, RLS) |
| Interface (E2E) | Maestro (`.maestro/`) | Celular/emulador | Login, cliente nova, agendamento, mensagens de erro |
| Manual / exploratório | Roteiro (`roteiro-celular.md`) + navegador | Celular real e web | Push, digital, modo avião, câmera/arquivos, visual |

## 4. Ambiente e massa de dados
- **Ambiente único: produção**, com uma **conta de teste** dedicada (decisão do responsável pelo produto). Nunca usar a conta real do estúdio em testes automatizados.
- Tudo que os testes criam usa o prefixo **"QA "** e datas em **2031**, e é apagado no fim da execução.
- Massa de dados detalhada: [massa-de-dados.md](massa-de-dados.md).
- Segredos (e-mail e senha da conta de teste, slug do estúdio) ficam só em **GitHub > Settings > Secrets** ou em variáveis locais, nunca no repositório (público).

## 5. Critérios de entrada e saída
**Entrada:** typecheck e lint passando; migrações novas aplicadas no Supabase.

**Saída (liberar versão):**
- 100% dos testes unitários e de API passando no CI.
- Nenhum bug **Crítico** ou **Alto** aberto em [bugs.md](bugs.md).
- `validacao-sql.sql` com 0 problemas em todas as regras.
- Roteiro do celular executado nos itens marcados como regressão.

## 6. Severidade dos bugs
| Severidade | Quando |
|---|---|
| Crítica | Perda ou vazamento de dados, cobrança errada, app não abre |
| Alta | Fluxo principal bloqueado (agendar, concluir, entrar), texto legal/LGPD incorreto |
| Média | Funciona com contorno; mensagem confusa; regra secundária errada |
| Baixa | Visual, acessibilidade, texto |

## 7. Riscos
| Risco | Mitigação |
|---|---|
| Testes em produção criam dados reais | Conta de teste isolada, prefixo "QA", limpeza no `afterAll`, um teste de API por vez no CI |
| Push, digital e modo avião não automatizáveis no CI | Roteiro manual a cada versão |
| Fuso horário | Testes unitários rodam fixos em America/Sao_Paulo e cobrem Manaus |
| Regras duplicadas app × banco | Testes unitários (app) e de API (banco) para a mesma regra |

## 8. Entregáveis
- [casos-de-teste.md](casos-de-teste.md) — cenários e casos com ID, prioridade e resultado esperado
- [massa-de-dados.md](massa-de-dados.md) — dados de teste
- [bugs.md](bugs.md) — bugs registrados com passos e evidências
- [roteiro-celular.md](roteiro-celular.md) — execução manual no celular
- [validacao-sql.sql](validacao-sql.sql) — validação de dados
- `__tests__/` — testes automatizados (Jest) · `.maestro/` — testes de interface · `.github/workflows/qa.yml` — pipeline
