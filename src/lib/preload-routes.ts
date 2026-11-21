// UX-15: na web (SDK 58), cada tela é um arquivo de código separado, baixado só na primeira vez que abre
// ("async routes"). Abrir um agendamento pela primeira vez mostrava só o cabeçalho por ~0,3–0,7 s.
// Aqui o app pede esses arquivos em segundo plano, depois que a Agenda já apareceu, sem desenhar
// as telas (router.prefetch desenharia a tela escondida e dispararia os eventos de "formulário aberto").
import { Platform } from 'react-native';

let done = false;

/** Baixa o código do detalhe e do novo agendamento (só na web, uma vez, sem bloquear nada). */
export function preloadAppointmentRoutes() {
  if (done || Platform.OS !== 'web') return;
  done = true;
  setTimeout(() => {
    import('@/app/agendamento/[id]').catch(() => {});
    import('@/app/agendamento/novo').catch(() => {});
  }, 1500);
}
