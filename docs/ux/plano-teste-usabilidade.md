# Plano de teste de usabilidade com profissionais de beleza

**Formato:** presencial, no celular, moderado, com pensamento em voz alta.
**Participantes:** 3 a 4 profissionais (o que dá para recrutar agora). Com 4 pessoas aparecem os problemas mais frequentes; os números servem para **comparar e priorizar**, não para estatística.
**Duração por sessão:** 50–60 min. **Quem aplica:** você (moderador). **Quem analisa:** sessão de UX, com a planilha preenchida.

## 1. Objetivos
1. Confirmar ou descartar os problemas de severidade 3 da [avaliação heurística](avaliacao-heuristica.md) (UX-01, 02, 03, 04, 07).
2. Medir eficácia (conclusão), eficiência (tempo, toques, erros) e satisfação (SEQ por tarefa, SUS no final) — os três critérios da ABNT NBR ISO 9241-11.
3. Descobrir o que a heurística não pega: vocabulário da profissional, hábitos com WhatsApp, o que ela esperava encontrar.

## 2. Perfil e recrutamento
**Critérios (todas):**
- Trabalha com beleza (manicure, lash, sobrancelha, cabelo, estética) e atende pelo menos 15 clientes por mês.
- Marca horários hoje por WhatsApp, caderno, agenda do celular ou outro app.
- Usa o próprio celular todo dia. Não conhece o Esmero (nem participou do desenvolvimento).

**Misturar, se der:** 1 que atende a domicílio; 1 que usa outro app de agenda; 1 com Android simples; 1 acima de 40 anos.

**Convite (WhatsApp):**
> Oi, [nome]! Estou criando um app de agenda para profissionais de beleza e queria ver você usando, para descobrir o que está confuso. Leva uns 50 min, é presencial, e não tem resposta certa: quem está sendo testado é o app, não você. Como agradecimento, [vale-presente/valor]. Topa? Qual dia e horário fica melhor?

**Agradecimento:** sugerido R$ 50–80 (Pix ou vale), pago mesmo que ela desista no meio.

## 3. Preparação (antes de cada sessão)
- [ ] **Conta de teste por participante**: você cria (no site) uma conta descartável "Participante N" e deixa **parada antes do primeiro acesso** (para a tarefa T1). Plano Pro por SQL, como no README de QA. Depois da sessão, excluir a conta (Ajustes > Dados do estúdio > Excluir minha conta).
- [ ] Depois que ela fizer o T1, **você** carrega os dados de exemplo (Ajustes > Carregar dados de exemplo) e prepara:
  - um atendimento de **hoje, já passado**, com Larissa Oliveira (para T4);
  - um agendamento **pendente pelo link público** (faça você pelo link, em aba anônima, com nome "Paula Teste" e WhatsApp fictício) (para T7);
  - confirmar que **quinta-feira às 14:00** e **sexta às 14:00** estão livres (T2 e T5);
  - um agendamento **futuro avulso** (sem repetição) para Amanda Ribeiro (T5).
- [ ] Celular: o da participante (app instalado ou site salvo na tela inicial) ou o seu. Brilho no automático. Notificações silenciosas.
- [ ] Gravação **só da tela e do áudio** (gravador de tela do celular). Nada de rosto.
- [ ] Cronômetro (o do celular do moderador) e a planilha [planilha-registro.csv](planilha-registro.csv) impressa ou aberta.
- [ ] Termo de consentimento ([seção 8](#8-termo-de-consentimento-lgpd)) em 2 vias.
- [ ] **Piloto:** faça uma sessão inteira com alguém de fora (amiga, familiar) antes da primeira participante, para acertar tempo e textos.

## 4. Roteiro da sessão
| Tempo | Etapa |
|---|---|
| 0–5 min | Boas-vindas, termo de consentimento, ligar a gravação. |
| 5–10 min | Perguntas iniciais (seção 5). |
| 10–45 min | Tarefas (seção 6), uma de cada vez, com a SEQ depois de cada uma. |
| 45–52 min | Questionário SUS (seção 7.3). |
| 52–60 min | Perguntas finais, agradecimento, pagamento. |

**Fala de abertura (ler):**
> Obrigado por vir. Vou te pedir algumas tarefas no app, como se fosse o seu dia a dia. Quem está sendo testado é o app, não você: se algo for difícil, é culpa dele, e isso é exatamente o que eu quero descobrir. Vá falando em voz alta o que você está pensando, procurando e esperando. Eu vou ficar quieto a maior parte do tempo, e às vezes não vou poder responder perguntas, porque quero ver como seria se você estivesse sozinha. Pode desistir de uma tarefa quando quiser. Posso gravar a tela e o áudio, sem o seu rosto?

**Regras do moderador**
- Não ensinar o caminho. Se perguntarem: "O que você acha que faria?" / "Onde você procuraria?"
- Se travar por **3 minutos** ou pedir para desistir: encerra a tarefa como "não concluída" e, se for preciso para a próxima, mostra o caminho.
- Anotar falas literais entre aspas ("achei que esse botão estava apagado").
- Não comentar acertos ("isso!") nem erros.
- Use os nomes fictícios dos dados de exemplo. A participante **não** digita dados de clientes reais dela.

## 5. Perguntas iniciais
1. Que serviços você faz? Quantas clientes atende por semana?
2. Como você marca os horários hoje? Me mostra (se for no celular).
3. Quando uma cliente pede horário no WhatsApp, o que você faz, passo a passo?
4. Como você controla o que recebeu no dia/mês?
5. Já usou algum app de agenda? O que te fez parar ou continuar?

## 6. Tarefas
Ler o cenário em voz alta e entregar o celular. Cronometrar **do fim da leitura até ela dizer "pronto"** (ou desistir). Contar **toques** pela gravação depois.

| ID | Cenário (ler para a participante) | Sucesso quando | Caminho ótimo (toques) | Hipóteses testadas |
|---|---|---|---|---|
| T1 | "Você acabou de baixar o app e criar a conta. Deixe o seu estúdio pronto para usar." | Concluiu os 3 passos e chegou na agenda. | ~8 | Primeiro acesso; UX-10 (o que ela faz depois) |
| T2 | "A Juliana Martins te mandou mensagem pedindo manicure e pedicure na quinta-feira às 14h. Marque." | Agendamento salvo com cliente, 2 serviços, quinta 14:00. | 6 | UX-03 |
| T3 | "Uma cliente nova, a Paula, WhatsApp (11) 9 8888-0000, quer alongamento em gel no dia [data daqui a 5 semanas] às 10h. Marque." | Cliente criada com WhatsApp correto e agendamento na data certa. | ~12 | UX-05, UX-13 |
| T4 | "A Larissa acabou de ser atendida e te pagou no Pix. Registre." | Atendimento concluído com Pix e receita no Financeiro. | 3 | **UX-01** |
| T5 | "A Juliana pediu para passar o horário de quinta para sexta no mesmo horário. Depois, a Amanda Ribeiro avisou que não vem mais no próximo horário dela. Resolva as duas." | Remarcado para sexta; o da Amanda cancelado (e só ele). | 5 + 2 | **UX-02**, UX-17 |
| T6 | "Uma cliente pediu para você mandar o link para ela mesma marcar. Mande o link pelo WhatsApp." | Link copiado/compartilhado e colado no WhatsApp (pode ser para o moderador). | 3+ | UX-09 |
| T7 | "Chegou um pedido de horário pelo seu link. Encontre e aceite." | Agendamento da "Paula Teste" muda para Confirmado. | 2 | **UX-07** |
| T8 | "Venda para a Camila Rocha um pacote de 4 manutenções de alongamento por R$ 400, pago no crédito." | Pacote criado para a Camila, 4 sessões, R$ 400, crédito. | ~8 | UX-16 |
| T9 | "Quanto você faturou esta semana? E quanto pagou de taxa de cartão?" | Valores certos falados em voz alta. | 1–2 | UX-11 |

**Se o tempo apertar:** fazer na ordem T2, T4, T5, T7, T6, T3 e deixar T1, T8, T9 como opcionais. (T1 pode ser feita primeiro, se a conta estiver parada no primeiro acesso.)

**Depois de cada tarefa — SEQ:**
> "No geral, essa tarefa foi: 1 muito difícil … 7 muito fácil?" e "Por que essa nota?"

## 7. Métricas e como registrar
### 7.1 Por tarefa (uma linha por participante × tarefa na planilha)
| Métrica | Como medir | Critério ISO |
|---|---|---|
| Conclusão | 1 = sozinha e correta · 0,5 = com erro ou com uma dica · 0 = não concluiu / desistiu | Eficácia |
| Tempo na tarefa (s) | Cronômetro; conferir na gravação | Eficiência |
| Toques | Contar na gravação; comparar com o caminho ótimo (razão de desvio = toques ÷ ótimo) | Eficiência |
| Erros | Ações erradas que ela percebeu e desfez (leve) ou que ficaram erradas (grave) | Eficácia |
| Dicas do moderador | Quantas vezes precisou ajudar | Eficácia |
| SEQ (1–7) | Pergunta depois da tarefa | Satisfação |
| Falas e observações | Citação literal + momento do vídeo (mm:ss) | — |

### 7.2 Metas de referência (para comparar no relatório)
- Conclusão ≥ 80% nas tarefas T2, T4, T5, T7.
- SEQ média ≥ 5,5 (média de mercado ~5,5).
- T2 em ≤ 60 s e T4 em ≤ 20 s (a profissional faz isso entre clientes).

### 7.3 SUS — no final (escala 1 = discordo totalmente … 5 = concordo totalmente)
1. Eu usaria este app com frequência.
2. Achei o app mais complicado do que precisava ser.
3. Achei o app fácil de usar.
4. Acho que precisaria de ajuda de alguém para conseguir usar o app.
5. As funções do app estão bem integradas.
6. Achei o app inconsistente (coisas parecidas funcionando de jeitos diferentes).
7. Imagino que a maioria das pessoas aprenderia a usar o app rapidamente.
8. Achei o app trabalhoso de usar.
9. Me senti segura usando o app.
10. Precisei aprender muitas coisas antes de conseguir usar o app.

**Cálculo:** itens ímpares → (nota − 1); itens pares → (5 − nota); somar e multiplicar por 2,5 (0–100). Referência: 68 = média; ≥ 80 = bom.

### 7.4 Perguntas finais
1. O que foi mais fácil? E o mais chato?
2. Se pudesse mudar uma coisa, qual seria?
3. Você trocaria o seu jeito atual de marcar por este app? O que faltaria?
4. Quanto pagaria por mês por isso? (só para orientar o produto)

## 8. Termo de consentimento (LGPD)
> **Termo de participação em teste do app Esmero**
>
> Eu, ______________________, aceito participar de um teste de uso do app Esmero, de responsabilidade de DataCore Intelligence (CNPJ 68.947.841/0001-44).
>
> 1. **O que vai acontecer:** vou usar o app em tarefas do dia a dia, falando em voz alta o que penso, por cerca de 50 minutos.
> 2. **O que será gravado:** a tela do celular e o áudio. Meu rosto não será gravado.
> 3. **Para que:** só para melhorar o app. As gravações não serão publicadas nem usadas em propaganda.
> 4. **Como meus dados serão tratados:** nos relatórios eu apareço como "P1, P2…", sem nome, telefone ou imagem. As gravações e este termo ficam guardados com acesso restrito e serão apagados em até 6 meses.
> 5. **Meus direitos:** posso parar a qualquer momento, sem dar motivo e sem perder o agradecimento, e pedir que minhas gravações sejam apagadas pelo contato: ______________________.
> 6. **Base legal:** consentimento (art. 7º, I, da LGPD).
>
> Local e data: ____________  Assinatura: ______________________

## 9. Cuidados com os dados (o repositório é público)
- **Nunca** colocar no repositório: gravações, termos assinados, nomes, telefones ou fotos de participantes.
- Na planilha que vier para análise, use só **P1–P4** e as colunas do modelo. Se quiser salvar a planilha preenchida aqui, salve como `docs/ux/resultados/sessoes.csv` **sem nomes**; vídeos ficam fora do repositório (ex.: Google Drive privado).
- Prints de tela nos relatórios: só com dados de exemplo.

## 10. Análise (o que acontece depois)
Traga a planilha preenchida (P1–P4) e, se quiser, as citações. A análise vai:
1. Calcular por tarefa: taxa de conclusão, tempo mediano, razão de desvio de toques, erros, SEQ médio; SUS por participante e médio.
2. Montar a **matriz de problemas** (problema × participante), contando em quantas pessoas cada um apareceu.
3. Cruzar com a avaliação heurística: confirmar, rebaixar ou subir a severidade de cada UX-xx; registrar problemas novos (UX-2x).
4. Atualizar o [relatorio.md](relatorio.md) com a evidência das sessões.
