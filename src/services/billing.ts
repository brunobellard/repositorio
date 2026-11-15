// Cobrança das assinaturas.
//
// Estrutura pronta para conectar um provedor de pagamento sem mexer nas telas:
//   * RevenueCat  — compras dentro do app (Google Play / App Store), ideal para o app móvel
//   * Stripe ou Mercado Pago — checkout pela web (Pix, cartão, boleto)
//
// Fluxo esperado com qualquer provedor:
//   1. o app chama startCheckout(plano, ciclo) e o provedor cobra a cliente;
//   2. o provedor avisa o nosso backend (webhook) -> uma Edge Function com a
//      service role atualiza profiles.plan_tier / subscription_status / billing_cycle;
//   3. o app recarrega o perfil e libera os recursos.
// A profissional nunca altera o próprio plano pelo app: o banco bloqueia (migração de planos).
import type { BillingCycle, PlanTier } from '@/constants/plans';

export type CheckoutResult =
  | { status: 'redirected' } // abriu o pagamento (web/loja)
  | { status: 'purchased' } // compra concluída (ex: RevenueCat)
  | { status: 'cancelled' }
  | { status: 'unavailable'; message: string };

export interface BillingProvider {
  readonly id: 'none' | 'revenuecat' | 'stripe' | 'mercadopago';
  startCheckout(plan: Exclude<PlanTier, 'free'>, cycle: BillingCycle, userId: string): Promise<CheckoutResult>;
  /** Abrir a área de gerenciamento/cancelamento da assinatura */
  manageSubscription?(userId: string): Promise<void>;
}

/** Enquanto nenhum provedor estiver configurado, a assinatura não é cobrada. */
const notConfigured: BillingProvider = {
  id: 'none',
  async startCheckout() {
    return {
      status: 'unavailable',
      message: 'O pagamento das assinaturas ainda não foi ativado. Em breve você poderá assinar por aqui.',
    };
  },
};

/** Troque aqui pelo provedor escolhido (ex: revenueCatProvider, stripeProvider). */
export const billingProvider: BillingProvider = notConfigured;

export const billingConfigured = () => billingProvider.id !== 'none';
