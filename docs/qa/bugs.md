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
**Status:** aberto — depende de você informar os dados.

---

## BUG-002 · Média · Endereço inexistente mostra página técnica em inglês com mapa de rotas
**Onde:** site web (Expo Router, falta `src/app/+not-found.tsx`)
**Passos:**
1. Abrir https://projeto-app-beleza.expo.app/rota-que-nao-existe

**Esperado:** página em português ("Página não encontrada") com botão para voltar ao início.
**Obtido:** tela preta "Unmatched Route — Page could not be found." com link **Sitemap**, que lista todas as telas do app para qualquer visitante.
**Evidência:** [bug-002-rota-inexistente.jpg](evidencias/bug-002-rota-inexistente.jpg)
**Correção sugerida:** criar `src/app/+not-found.tsx` com texto em português e link para o início/login.
**Status:** aberto.

---

## BUG-003 · Baixa · Botões e links sem papel de "botão" para leitores de tela
**Onde:** login (Entrar, Criar conta, Esqueci minha senha) e demais telas — `Pressable` sem `accessibilityRole`
**Passos:**
1. Abrir `/login` com leitor de tela (TalkBack/VoiceOver) ou inspecionar a árvore de acessibilidade.

**Esperado:** "Entrar, botão"; campos anunciados pelo rótulo ("E-mail", "Senha").
**Obtido:** botões aparecem como elementos genéricos; campos são anunciados pelo exemplo ("voce@email.com", "Mínimo 6 caracteres"), não pelo rótulo.
**Evidência:** árvore de acessibilidade da página de login: `textbox "voce@email.com"`, botões como `generic`.
**Correção sugerida:** `accessibilityRole="button"` no componente `Button` e nos `Pressable` clicáveis; `accessibilityLabel` com o rótulo nos campos do `Field`.
**Status:** aberto.

---

## BUG-004 · Baixa · Validação de e-mail só confere "@"
**Onde:** login e cadastro — `src/app/login.tsx` (`email.includes('@')`)
**Passos:** digitar `ana@` e uma senha de 6 caracteres.
**Esperado:** botão desabilitado até o e-mail ter formato válido (`nome@dominio.com`).
**Obtido:** botão habilitado; o erro só aparece depois de enviar ao servidor.
**Status:** aberto.
