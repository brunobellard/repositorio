// Planos de assinatura: preços, limites e recursos de cada nível.
// As mesmas regras são conferidas no banco (migração 20261121000000_planos_assinatura.sql).

export type PlanTier = 'free' | 'basic' | 'pro' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

/** Recursos que dependem do plano */
export type PlanFeature =
  | 'unlimitedClients'
  | 'unlimitedAppointments'
  | 'unlimitedServices'
  | 'recurrence'
  | 'receiptImage'
  | 'cardFees'
  | 'homeService'
  | 'themes'
  | 'customTheme'
  | 'publicLink'
  | 'push'
  | 'packages'
  | 'retentionCRM'
  | 'autoEmail'
  | 'export'
  | 'multiProfessional'
  | 'prioritySupport';

export interface PlanLimits {
  /** null = ilimitado */
  clients: number | null;
  appointmentsPerMonth: number | null;
  activeServices: number | null;
}

export interface Plan {
  tier: PlanTier;
  name: string;
  /** Preço em R$ */
  price: { monthly: number; yearly: number };
  tagline: string;
  highlight?: string;
  limits: PlanLimits;
  /** Benefícios mostrados no card (o que o plano adiciona) */
  benefits: string[];
}

export const PLAN_ORDER: PlanTier[] = ['free', 'basic', 'pro', 'enterprise'];
export const planRank = (t: PlanTier) => PLAN_ORDER.indexOf(t);

export const PLANS: Record<PlanTier, Plan> = {
  free: {
    tier: 'free',
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    tagline: 'Para começar a organizar a agenda',
    limits: { clients: 10, appointmentsPerMonth: 20, activeServices: 3 },
    benefits: ['Até 10 clientes', 'Até 20 agendamentos por mês', 'Até 3 serviços ativos', 'Financeiro e lembretes no WhatsApp'],
  },
  basic: {
    tier: 'basic',
    name: 'Básico',
    price: { monthly: 9.9, yearly: 99 },
    tagline: 'Sem limites para o dia a dia',
    limits: { clients: null, appointmentsPerMonth: null, activeServices: null },
    benefits: [
      'Clientes, agendamentos e serviços ilimitados',
      'Agenda recorrente (semanal, quinzenal, mensal…)',
      'Comprovante em imagem',
      'Taxas de cartão e lucro líquido real',
      'Atendimento a domicílio (bairros por dia, taxa e tempo de trânsito)',
      '6 paletas de cores prontas para o app',
    ],
  },
  pro: {
    tier: 'pro',
    name: 'Intermediário',
    price: { monthly: 19.9, yearly: 199 },
    tagline: 'Para crescer e fidelizar clientes',
    highlight: 'Mais escolhido',
    limits: { clients: null, appointmentsPerMonth: null, activeServices: null },
    benefits: [
      'Tudo do Básico',
      'Link público de agendamento online (com a cor do seu app)',
      'Link público inteligente (filtra dias pelo bairro da cliente)',
      'Cor personalizada (qualquer cor da sua marca)',
      'Notificações de novos agendamentos',
      'Pacotes pré-pagos',
      'Retorno de clientes e aniversariantes',
      'E-mails automáticos',
    ],
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Empresarial',
    price: { monthly: 49.9, yearly: 499 },
    tagline: 'Para estúdios com equipe',
    limits: { clients: null, appointmentsPerMonth: null, activeServices: null },
    benefits: [
      'Tudo do Intermediário',
      'Relatórios em PDF e planilha',
      'Várias agendas / profissionais (em breve)',
      'Suporte prioritário',
    ],
  },
};

/** Plano mínimo que libera cada recurso, com o texto usado no aviso de upgrade */
export const FEATURES: Record<PlanFeature, { minPlan: PlanTier; title: string; description: string }> = {
  unlimitedClients: {
    minPlan: 'basic',
    title: 'Mais de 10 clientes',
    description: 'O plano Free guarda até 10 clientes. No Básico o cadastro é ilimitado.',
  },
  unlimitedAppointments: {
    minPlan: 'basic',
    title: 'Mais de 20 agendamentos no mês',
    description: 'O plano Free permite 20 agendamentos por mês. No Básico a agenda é ilimitada.',
  },
  unlimitedServices: {
    minPlan: 'basic',
    title: 'Mais de 3 serviços ativos',
    description: 'O plano Free permite 3 serviços ativos. No Básico o catálogo é ilimitado.',
  },
  recurrence: {
    minPlan: 'basic',
    title: 'Agenda recorrente',
    description: 'Repita agendamentos toda semana, quinzena, a cada 3 semanas ou todo mês, com aviso de conflitos.',
  },
  receiptImage: {
    minPlan: 'basic',
    title: 'Comprovante em imagem',
    description: 'Envie o comprovante como imagem com o seu logo. O texto no WhatsApp continua liberado.',
  },
  cardFees: {
    minPlan: 'basic',
    title: 'Taxas de cartão',
    description: 'Desconte as taxas da maquininha e veja o lucro líquido real no Financeiro.',
  },
  homeService: {
    minPlan: 'basic',
    title: 'Atendimento a domicílio',
    description:
      'Controle de bairros atendidos por dia da semana, taxa de deslocamento e tempo de trânsito entre atendimentos. A partir do plano Básico, por apenas R$ 9,90/mês. No link de agendamento (a partir do Intermediário), a cliente escolhe o bairro.',
  },
  themes: {
    minPlan: 'basic',
    title: 'Paletas de cores',
    description:
      'Troque a cor do app por uma das 6 paletas prontas. A partir do Intermediário, a cor vale também para o seu link de agendamento.',
  },
  customTheme: {
    minPlan: 'pro',
    title: 'Cor personalizada',
    description: 'Use a cor exata da sua marca (código HEX) no app e no link de agendamento.',
  },
  publicLink: {
    minPlan: 'pro',
    title: 'Link de agendamento online',
    description: 'Suas clientes agendam sozinhas por um link na bio do Instagram ou no WhatsApp.',
  },
  push: {
    minPlan: 'pro',
    title: 'Notificações de agendamento',
    description: 'Receba um aviso no celular sempre que uma cliente agendar pelo link.',
  },
  packages: {
    minPlan: 'pro',
    title: 'Pacotes pré-pagos',
    description: 'Venda pacotes de sessões e acompanhe o saldo de cada cliente.',
  },
  retentionCRM: {
    minPlan: 'pro',
    title: 'Retorno de clientes',
    description: 'Veja quem sumiu há mais de 20 dias e as aniversariantes do mês, com mensagem pronta no WhatsApp.',
  },
  autoEmail: {
    minPlan: 'pro',
    title: 'E-mails automáticos',
    description: 'Envie confirmações e comprovantes por e-mail.',
  },
  export: {
    minPlan: 'enterprise',
    title: 'Relatórios em PDF e planilha',
    description: 'Exporte o financeiro e a base de clientes para o contador ou para backup.',
  },
  multiProfessional: {
    minPlan: 'enterprise',
    title: 'Várias agendas',
    description: 'Agendas separadas para cada profissional do estúdio.',
  },
  prioritySupport: {
    minPlan: 'enterprise',
    title: 'Suporte prioritário',
    description: 'Atendimento com prioridade.',
  },
};

/** Desconto do plano anual em meses grátis (12x mensal − anual) */
export const yearlySavings = (p: Plan) => Math.round((p.price.monthly * 12 - p.price.yearly) * 100) / 100;

/** Erro "PLAN_LIMIT:<recurso>" vindo do banco -> recurso do app */
export const LIMIT_TO_FEATURE: Record<string, PlanFeature> = {
  clients: 'unlimitedClients',
  appointments: 'unlimitedAppointments',
  services: 'unlimitedServices',
  recurrence: 'recurrence',
  packages: 'packages',
  homeService: 'homeService',
  themes: 'themes',
  customTheme: 'customTheme',
};
