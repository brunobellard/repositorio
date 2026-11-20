# Testes de interface no celular (Maestro)

Roteiros automáticos que tocam na tela do app como uma pessoa. Rodam no seu computador,
com um celular Android ligado por USB (depuração USB ativa) ou um emulador.

## Preparar (uma vez)
1. Instale o Maestro: https://docs.maestro.dev/getting-started/installing-maestro (no Windows, pelo WSL ou pelo instalador).
2. Abra o app no Expo Go do aparelho (`npx.cmd expo start`) e anote o endereço `exp://...` que aparece no terminal.

## Rodar
Use SEMPRE a conta de teste (os roteiros criam clientes e agendamentos "QA ...").

```powershell
maestro test .maestro -e APP_URL=exp://192.168.0.10:8081 -e QA_EMAIL=conta.teste@exemplo.com -e QA_PASSWORD=senha-da-conta-teste
```

Os roteiros:
- `01-login.yaml`: entra com a conta de teste e vê a Agenda.
- `02-cliente-e-agendamento.yaml`: cria uma cliente "QA" pela tela de novo agendamento e salva o horário.
- `03-login-invalido.yaml`: senha errada mostra a mensagem em português.

Prints de cada passo ficam em `~/.maestro/tests/`. Anexe-os ao registrar um bug (docs/qa/bugs.md).
