// CT-PAC: regras de pacotes pré-pagos e taxas de pagamento (src/lib/packages.ts)
import { describe, expect, it } from '@jest/globals';

import {
  activeFees,
  amountDue,
  availableCredits,
  feeFor,
  isExpired,
  packageCovered,
  scheduledSessions,
  usablePackages,
} from '@/lib/packages';
import type { PaymentFees, Profile } from '@/types';

import { appt, local, pkg } from '../fixtures';

const fees: PaymentFees = { debit: 1.99, credit: 4.99, pix: 0.99, cash: 0 };
const profile = (p: Partial<Profile>) =>
  ({ paymentFees: fees, planTier: 'pro', subscriptionStatus: 'active', ...p }) as Profile;

describe('taxas de pagamento', () => {
  it('CT-PAC-01 calcula a taxa em reais com arredondamento de centavos', () => {
    expect(feeFor(100, 'credito', fees)).toBe(4.99);
    expect(feeFor(33.33, 'debito', fees)).toBe(0.66);
    expect(feeFor(100, 'dinheiro', fees)).toBe(0);
  });

  it('CT-PAC-02 plano sem "Taxas de cartão" não desconta nada', () => {
    expect(activeFees(profile({ planTier: 'free' }))).toEqual({ debit: 0, credit: 0, pix: 0, cash: 0 });
  });

  it('CT-PAC-03 teste grátis vencido vale como Free (sem taxas)', () => {
    const p = profile({ subscriptionStatus: 'trialing', trialEndsAt: '2000-01-01T00:00:00Z' });
    expect(activeFees(p).credit).toBe(0);
  });
});

describe('validade', () => {
  it('CT-PAC-04 pacote vale até o fim do dia do vencimento', () => {
    const p = pkg({ expiresAt: '2030-03-10' });
    expect(isExpired(p, local(2030, 3, 10, 23, 59))).toBe(false);
    expect(isExpired(p, local(2030, 3, 11, 0, 0))).toBe(true);
  });

  it('CT-PAC-05 sem validade nunca vence', () => {
    expect(isExpired(pkg({ expiresAt: undefined }), local(2099, 1, 1))).toBe(false);
  });
});

describe('créditos', () => {
  const list = [
    appt({ id: 'x1', clientPackageId: 'p1', status: 'pendente' }),
    appt({ id: 'x2', clientPackageId: 'p1', status: 'confirmado' }),
    appt({ id: 'x3', clientPackageId: 'p1', status: 'cancelado' }),
    appt({ id: 'x4', clientPackageId: 'p1', status: 'concluido' }),
    appt({ id: 'x5', clientPackageId: 'outro', status: 'pendente' }),
  ];

  it('CT-PAC-06 agendadas = pendentes e confirmadas deste pacote', () => {
    expect(scheduledSessions(pkg(), list)).toBe(2);
  });

  it('CT-PAC-07 créditos livres descontam usadas e agendadas', () => {
    expect(availableCredits(pkg({ totalSessions: 4, usedSessions: 1 }), list)).toBe(1);
  });

  it('CT-PAC-08 créditos nunca ficam negativos', () => {
    expect(availableCredits(pkg({ totalSessions: 2, usedSessions: 2 }), list)).toBe(0);
  });

  it('CT-PAC-09 pacote utilizável: mesma cliente, serviço, ativo, válido e com crédito', () => {
    const ok = pkg({ id: 'ok' });
    const outraCliente = pkg({ id: 'oc', clientId: 'c2' });
    const outroServico = pkg({ id: 'os', serviceIds: ['s9'] });
    const encerrado = pkg({ id: 'en', status: 'completed' });
    const vencido = pkg({ id: 've', expiresAt: '2000-01-01' });
    const semCredito = pkg({ id: 'sc', totalSessions: 1, usedSessions: 1 });
    const result = usablePackages('c1', ['s1'], [ok, outraCliente, outroServico, encerrado, vencido, semCredito], []);
    expect(result.map((p) => p.id)).toEqual(['ok']);
  });

  it('CT-PAC-10 sem cliente escolhida não há pacote', () => {
    expect(usablePackages(undefined, ['s1'], [pkg()], [])).toEqual([]);
  });
});

describe('valor a receber de sessão de pacote', () => {
  const packages = [pkg()];

  it('CT-PAC-11 pacote cobre uma sessão do serviço do pacote', () => {
    const a = appt({ clientPackageId: 'p1', totalPrice: 50 });
    expect(packageCovered(a, packages)).toBe(50);
    expect(amountDue(a, packages)).toBe(0);
  });

  it('CT-PAC-12 serviço extra e taxa de deslocamento continuam sendo cobrados', () => {
    const a = appt({
      clientPackageId: 'p1',
      services: [
        { serviceId: 's1', name: 'Manicure', price: 50, durationMin: 60 },
        { serviceId: 's2', name: 'Pedicure', price: 40, durationMin: 45 },
      ],
      travelFee: 15,
      totalPrice: 105,
    });
    expect(amountDue(a, packages)).toBe(55);
  });

  it('CT-PAC-13 sem pacote cobra o total', () => {
    expect(amountDue(appt({ totalPrice: 80 }), packages)).toBe(80);
  });

  it('CT-PAC-15 pacote com vários serviços cobre todos eles e só vale com todos no atendimento', () => {
    const maoEPe = pkg({ id: 'mp', serviceIds: ['s1', 's2'] });
    const both = [
      { serviceId: 's1', name: 'Manicure', price: 50, durationMin: 60 },
      { serviceId: 's2', name: 'Pedicure', price: 40, durationMin: 45 },
    ];
    expect(usablePackages('c1', ['s1', 's2', 's3'], [maoEPe], []).map((p) => p.id)).toEqual(['mp']);
    expect(usablePackages('c1', ['s1'], [maoEPe], [])).toEqual([]);
    const a = appt({ clientPackageId: 'mp', services: both, travelFee: 15, totalPrice: 105 });
    expect(packageCovered(a, [maoEPe])).toBe(90);
    expect(amountDue(a, [maoEPe])).toBe(15);
  });

  it('CT-PAC-16 pacote no formato antigo (sem serviceIds, vindo do cache) não quebra a tela', () => {
    const old = { ...pkg(), serviceIds: undefined } as unknown as ReturnType<typeof pkg>;
    const a = appt({ clientPackageId: 'p1', totalPrice: 50 });
    expect(() => amountDue(a, [old])).not.toThrow();
    expect(amountDue(a, [old])).toBe(50);
    expect(usablePackages('c1', ['s1'], [old], [])).toEqual([]);
  });

  it('CT-PAC-14 pacote que não cobre os serviços não desconta', () => {
    const a = appt({ clientPackageId: 'p1', services: [{ serviceId: 's2', name: 'Pedicure', price: 40, durationMin: 45 }], totalPrice: 40 });
    expect(amountDue(a, packages)).toBe(40);
  });
});
