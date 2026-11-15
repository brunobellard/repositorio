// Regras de pacotes pré-pagos e taxas de pagamento.
import { startOfDay } from '@/lib/dates';
import type { Appointment, ClientPackage, PaymentFees, PaymentMethod } from '@/types';

/** Chave do JSON de taxas para cada forma de pagamento */
export const FEE_KEY: Record<PaymentMethod, keyof PaymentFees> = {
  debito: 'debit',
  credito: 'credit',
  pix: 'pix',
  dinheiro: 'cash',
};

/** Taxa em R$ (mesma conta feita no banco ao gravar a transação). */
export function feeFor(amount: number, method: PaymentMethod, fees: PaymentFees): number {
  return Math.round(amount * (fees[FEE_KEY[method]] ?? 0)) / 100;
}

export function isExpired(pkg: ClientPackage, now = new Date()): boolean {
  if (!pkg.expiresAt) return false;
  const [y, m, d] = pkg.expiresAt.split('-').map(Number);
  return startOfDay(now) > new Date(y, m - 1, d);
}

/** Sessões já agendadas com este pacote que ainda não foram concluídas nem canceladas. */
export function scheduledSessions(pkg: ClientPackage, appointments: Appointment[]): number {
  return appointments.filter(
    (a) => a.clientPackageId === pkg.id && a.status !== 'concluido' && a.status !== 'cancelado',
  ).length;
}

/** Créditos que ainda podem ser agendados (descontando as sessões já marcadas). */
export function availableCredits(pkg: ClientPackage, appointments: Appointment[]): number {
  return Math.max(0, pkg.totalSessions - pkg.usedSessions - scheduledSessions(pkg, appointments));
}

/** Pacotes da cliente que podem pagar este serviço agora. */
export function usablePackages(
  clientId: string | undefined,
  serviceIds: string[],
  packages: ClientPackage[],
  appointments: Appointment[],
): ClientPackage[] {
  if (!clientId) return [];
  return packages.filter(
    (p) =>
      p.clientId === clientId &&
      p.status === 'active' &&
      serviceIds.includes(p.serviceId) &&
      !isExpired(p) &&
      availableCredits(p, appointments) > 0,
  );
}
