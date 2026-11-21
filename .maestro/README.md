# Testes de interface no celular (Maestro)

Roteiros automáticos que tocam na tela do app como uma pessoa. Rodam no seu computador (Windows),
com um celular **Android** ligado por USB. No Windows o Maestro não controla iPhone (precisa de Mac).

## Preparar (uma vez)
1. **Java 17 ou mais novo** (o Java 8 que já existe no computador não serve):
   ```powershell
   winget install EclipseAdoptium.Temurin.17.JDK
   ```
   Feche e abra o terminal e confira: `java -version` deve mostrar 17 (ou mais).
2. **adb** (ferramenta do Android para falar com o celular por USB):
   ```powershell
   winget install Google.PlatformTools
   ```
3. **Maestro**: baixe https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip,
   extraia em `C:\maestro` e ponha `C:\maestro\bin` no PATH do usuário:
   ```powershell
   [Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\maestro\bin", "User")
   ```
   Feche e abra o terminal e confira: `maestro --help`.
4. **Celular**: Configurações > Sobre o telefone > toque 7 vezes em "Número da versão" (ativa o modo desenvolvedor) >
   Opções do desenvolvedor > **Depuração USB**. Ligue o cabo e aceite "Permitir depuração USB" no celular.
   Confira no computador: `adb devices` deve listar o aparelho como `device`.
   **Se a lista vier vazia** (comum em Samsung sem o driver USB), use o Wi-Fi (Android 11+, mesma rede):
   Opções do desenvolvedor > **Depuração sem fio** > "Parear dispositivo com código de pareamento", depois
   `adb pair <ip>:<porta-do-pareamento>` (digite o código) e `adb connect <ip>:<porta>` (a de "Endereço IP e porta").
5. **App**: `npx.cmd expo start` na pasta do projeto e abra o app no **Expo Go** do celular.
   O `APP_URL` é o endereço do **computador** onde o Expo roda (`exp://<ip-do-computador>:<porta>`, ex: `exp://192.168.0.8:8081`),
   **não** o endereço do celular que aparece no `adb devices`. Com o endereço errado o Expo Go mostra
   "Failed to download remote update".

Se o terminal disser "Java 17 or higher is required", ele foi aberto antes de instalar o Java: abra um terminal novo.

## Rodar
Use SEMPRE a **conta de teste** (os roteiros criam a cliente "QA Maestro" e um agendamento "QA").
A senha vai só no seu terminal, nunca em arquivo do repositório.

```powershell
maestro test .maestro -e APP_URL=exp://192.168.0.10:8081 -e QA_EMAIL=conta.teste@exemplo.com -e QA_PASSWORD=senha-da-conta-teste
```

Os roteiros:
- `01-login.yaml` (CT-E2E-01): entra com a conta de teste e vê a Agenda.
- `02-cliente-e-agendamento.yaml` (CT-E2E-02): próxima semana > terça-feira > Novo agendamento > cria a cliente
  "QA Maestro" > serviço "QA Manicure" > primeiro horário livre > Agendar > "Agendamento salvo".
  Depende do serviço "QA Manicure" ativo, da terça-feira aberta no expediente e do plano **Pro** da conta de teste
  (no Free, com 10 clientes, o app mostra "Mais de 10 clientes" e o roteiro para).
- `03-login-invalido.yaml` (CT-E2E-03): senha errada mostra "E-mail ou senha incorretos.".

Depois de rodar, limpe a conta de teste:
1. Ficha da cliente "QA Maestro" > toque no agendamento de terça (QA Manicure) > **Cancelar atendimento**, no fim da tela.
   Não toque em "Desfazer" no aviso que aparece.
   Com atendimento marcado o app não deixa excluir ("Cancele ou conclua antes de excluir").
2. Volte à ficha > **Excluir cliente** > confirme "Apagar dados". O atendimento cancelado fica no histórico como "Cliente removida".
Prints de cada passo ficam em `%USERPROFILE%\.maestro\tests\`. Anexe-os ao registrar um bug (docs/qa/bugs.md), sem dados de clientes reais.
