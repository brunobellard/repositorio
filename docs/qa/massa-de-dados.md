# Massa de dados de teste

Regras gerais:
- Só na **conta de teste** (nunca na conta real do estúdio).
- Nomes começam com **"QA "**; datas de agendamentos automáticos em **2031**.
- Telefones fictícios no formato `119000000NN`; e-mails `qa+NN@exemplo.com`.
- Nada de dados de clientes reais em prints, bugs ou commits (o repositório é público).

## Conta de teste
| Item | Valor |
|---|---|
| E-mail / senha | Segredos `QA_TEST_EMAIL` / `QA_TEST_PASSWORD` (GitHub) — não escrever aqui |
| Plano | Pro (para cobrir pacotes, link, recorrência e domicílio). Repetir os casos de limite com outra conta no Free |
| Fuso | America/Sao_Paulo |
| Slug do link | Segredo `QA_STUDIO_SLUG` |

## Serviços
| Nome | Preço | Duração | Uso |
|---|---|---|---|
| QA Manicure | R$ 50,00 | 60 min | Base de quase todos os casos |
| QA Pedicure | R$ 40,00 | 45 min | Combinação de serviços / extra em sessão de pacote |
| QA Alongamento | R$ 180,00 | 150 min | Atendimento longo (atravessa o almoço) |
| QA Inativo | R$ 10,00 | 15 min | Não deve aparecer no link nem nos chips |

## Expediente
Segunda a sábado 09:00–18:00, almoço 12:00–13:00; domingo fechado. Taxas: débito 1,99%, crédito 4,99%, Pix 0,99%, dinheiro 0%.

## Clientes
| Nome | WhatsApp | Particularidade | Casos |
|---|---|---|---|
| QA Ana Recorrente | 11900000001 | Série semanal de 4 sessões | CT-REC |
| QA Bia Pacote | 11900000002 | Pacote 4x Manicure, 1 usada, 1 agendada | CT-PAC |
| QA Carla Sumida | 11900000003 | Último atendimento concluído há 14 meses | CT-CLI-04 (retorno > 12 meses) |
| QA Dani Domicílio | 11900000004 | Endereço e bairro atendido | CT-DOM |
| QA Eva Remover | 11900000005 | 2 atendimentos concluídos (para "Apagar dados") | CT-CLI LGPD |
| QA Fê Sem Histórico | 11900000006 | Nenhum atendimento (exclusão definitiva) | CT-CLI |
| QA Gi Aniversário | 11900000007 | Nascimento no mês atual | Aniversariantes |
| QA Acento Ção | 11900000008 | Nome com acento (busca "acento cao") | Busca |

## Casos de borda (valores)
| Campo | Válidos | Inválidos |
|---|---|---|
| WhatsApp no link | 10 e 11 dígitos, com ou sem +55 | 9 dígitos, letras |
| Nome no link | 3–120 caracteres | 1–2 caracteres, só espaços |
| Serviços no link | 1 a 6 | 0, 7 |
| Horário no link | ≥ agora + 30 min e ≤ 90 dias | passado, < 30 min, > 90 dias |
| Sessões do pacote | 1–99 | 0, abaixo das usadas + agendadas |
| Valor (moeda) | 0,01 a 9.999.999,99 | — |
| Senha | ≥ 6 caracteres | 5 caracteres |
| Recorrência | 2–52 sessões; "até" no futuro | "até" antes do 1º dia (deve virar sessão única) |

## Massa automatizada
As fábricas em `__tests__/fixtures.ts` (`appt`, `pkg`, `client`, `block`, `weekHours`) geram estes dados para os testes unitários. Os testes de API criam e apagam a própria massa (`__tests__/api/business-rules-test.ts`).
