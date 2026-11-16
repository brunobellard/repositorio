// Permissões e limites do plano atual.
// Teste vencido sem assinatura ativa vale como Free (mesma regra do banco).
import { FEATURES, PLANS, planRank, type PlanFeature, type PlanTier } from '@/constants/plans';
import { useStore } from '@/data/store';
import { startOfDay } from '@/lib/dates';
import type { Profile } from '@/types';

const DAY = 86_400_000;

/** Plano em vigor a partir do perfil (função pura, usada também fora de componentes). */
export function effectivePlan(p: Pick<Profile, 'planTier' | 'subscriptionStatus' | 'trialEndsAt'>, now = new Date()): PlanTier {
  if (p.subscriptionStatus === 'active') return p.planTier;
  if (p.subscriptionStatus === 'trialing' && p.trialEndsAt && new Date(p.trialEndsAt) > now) return p.planTier;
  return 'free';
}

export function planHas(plan: PlanTier, feature: PlanFeature) {
  return planRank(plan) >= planRank(FEATURES[feature].minPlan);
}

export function usePlanAccess() {
  const { profile, clients, appointments, services } = useStore();
  const now = new Date();
  const currentPlan = effectivePlan(profile, now);
  const limits = PLANS[currentPlan].limits;

  const isTrialActive =
    profile.subscriptionStatus === 'trialing' && !!profile.trialEndsAt && new Date(profile.trialEndsAt) > now;
  const daysLeftInTrial = isTrialActive
    ? Math.max(0, Math.ceil((new Date(profile.trialEndsAt!).getTime() - now.getTime()) / DAY))
    : 0;
  const trialExpired = profile.subscriptionStatus === 'trialing' && !isTrialActive;

  const has = (feature: PlanFeature) => planHas(currentPlan, feature);

  /** Agendamentos ativos no mês de `date` (o limite do Free é por mês) */
  const appointmentsInMonth = (date = now) => {
    const from = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
    return appointments.filter((a) => {
      const t = new Date(a.startsAt).getTime();
      return a.status !== 'cancelado' && t >= from && t < to;
    }).length;
  };

  return {
    currentPlan,
    plan: PLANS[currentPlan],
    /** Plano contratado (pode diferir do em vigor quando o teste venceu) */
    subscribedPlan: profile.planTier,
    subscriptionStatus: profile.subscriptionStatus,
    billingCycle: profile.billingCycle,
    isTrialActive,
    daysLeftInTrial,
    trialExpired,
    limits,
    has,

    canAddClient: (currentCount = clients.length, adding = 1) =>
      limits.clients === null || currentCount + adding <= limits.clients,
    canAddAppointmentThisMonth: (currentCount = appointmentsInMonth(), adding = 1) =>
      limits.appointmentsPerMonth === null || currentCount + adding <= limits.appointmentsPerMonth,
    canAddService: (currentCount = services.filter((s) => s.active).length, adding = 1) =>
      limits.activeServices === null || currentCount + adding <= limits.activeServices,
    appointmentsInMonth,

    hasRecurrence: has('recurrence'),
    hasReceiptImage: has('receiptImage'),
    hasCardFees: has('cardFees'),
    hasHomeService: has('homeService'),
    hasThemes: has('themes'),
    hasCustomTheme: has('customTheme'),
    hasPublicLink: has('publicLink'),
    hasPush: has('push'),
    hasPackages: has('packages'),
    hasRetentionCRM: has('retentionCRM'),
    hasAutoEmail: has('autoEmail'),
    hasExport: has('export'),
  };
}

/** Início do mês de uma data (útil para contar o limite mensal) */
export const monthOf = (d: Date) => startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
