// TelemetryService: um só lugar para o Sentry (erros e desempenho) e o PostHog (analytics de produto).
//
// Regras:
// - Expõe só 4 métodos: init, identifyUser, trackEvent e captureError.
// - Nunca lança erro e nunca trava a tela: cada chamada fica num try/catch e o envio é em segundo plano.
// - Sem as variáveis de ambiente, não faz nada (o app segue igual, só sem telemetria).
// - Nada de dados sensíveis: e-mail, CPF/CNPJ, telefone, senha, nomes, endereços e anotações são
//   filtrados nas traits, nas propriedades, nos breadcrumbs e no beforeSend do Sentry (ver telemetry-scrub.ts).
// - O usuário é identificado pelo id interno da conta (UUID do Supabase), nunca pelo e-mail.
// - PostHog só liga com login: o link público de agendamento (sem login) não manda nada para ele,
//   e nada é gravado no aparelho (persistence "memory": sem cookies nem localStorage).
//
// Variáveis (em .env.local e no EAS; só as EXPO_PUBLIC_* chegam ao app):
//   EXPO_PUBLIC_SENTRY_DSN, EXPO_PUBLIC_POSTHOG_KEY e, opcional, EXPO_PUBLIC_POSTHOG_HOST.
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import PostHog from 'posthog-react-native';

import { isValidEventName, type EventProps } from '@/lib/analytics-props';
import { safeProps, scrubBreadcrumb, scrubEvent, scrubText } from '@/lib/telemetry-scrub';

// Lidas por nome literal: o Expo só embute no app as variáveis escritas assim (process.env.EXPO_PUBLIC_…)
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? '';
const isPostHogConfigured = Boolean(POSTHOG_KEY && POSTHOG_HOST);

const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
const appVersion = Constants.expoConfig?.version ?? undefined;

let started = false;
let sentryOn = false;
let posthog: PostHog | null = null;
let identifiedAs: string | null = null;

export interface UserTraits {
  /** Plano em vigor (free, basic, intermediate, enterprise) */
  plan?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface ErrorContext {
  /** Onde o erro aconteceu, em código curto (ex.: "store_reload", "public_booking") */
  where: string;
  [key: string]: string | number | boolean | null | undefined;
}

/** Cliente único, inicializado no layout raiz e reutilizado pelos eventos do app. */
function getPostHog(): PostHog | null {
  if (posthog || !isPostHogConfigured) return posthog;
  posthog = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    logs: {
      serviceName: 'agenda-beleza-mobile',
      serviceVersion: appVersion,
      environment: __DEV__ ? 'development' : 'production',
    },
    errorTracking: {
      autocapture: {
        uncaughtExceptions: true,
        unhandledRejections: true,
      },
    },
  });
  return posthog;
}

/** Canal dedicado aos poucos logs estruturados que este módulo adiciona ao PostHog. */
function posthogLog(message: string, attributes?: Record<string, string | number | boolean | undefined>): void {
  try {
    getPostHog()?.logger.info(message, attributes);
  } catch {
    // Logs nunca impedem o app de abrir nem a sessão de continuar.
  }
}

/** Converte qualquer coisa lançada (Error, erro do Supabase, texto) num Error com mensagem limpa. */
function toError(error: unknown): Error {
  if (error instanceof Error) return error; // a mensagem é limpa no beforeSend
  const e = (error ?? {}) as { message?: unknown; code?: unknown };
  const err = new Error(scrubText(typeof e.message === 'string' ? e.message : String(error)));
  if (typeof e.code === 'string' && e.code) err.name = `Erro ${e.code}`;
  return err;
}

export const TelemetryService = {
  /** Liga PostHog e Sentry uma vez, no layout raiz. */
  init(): void {
    if (started) return;
    started = true;

    if (!isPostHogConfigured) {
      if (__DEV__) {
        const variable = POSTHOG_KEY ? 'EXPO_PUBLIC_POSTHOG_HOST' : 'EXPO_PUBLIC_POSTHOG_KEY';
        console.error(
          `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`,
        );
      }
    } else {
      getPostHog();
      posthogLog('telemetry initialized', { platform, app_version: appVersion ?? 'unknown' });
    }

    try {
      if (!SENTRY_DSN) return;
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: __DEV__ ? 'development' : 'production',
        sendDefaultPii: false, // sem IP, cookies nem dados do usuário automáticos
        tracesSampleRate: __DEV__ ? 1 : 0.2, // desempenho: 20% das sessões em produção
        attachScreenshot: false, // a tela pode mostrar dados das clientes
        attachViewHierarchy: false,
        maxBreadcrumbs: 50,
        initialScope: { tags: { platform } },
        beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
        beforeSend: (event) => scrubEvent(event),
        beforeSendTransaction: (event) => scrubEvent(event),
      });
      sentryOn = true;
    } catch {
      // Telemetria nunca impede o app de abrir
    }
  },

  /**
   * Associa a sessão à conta (id interno) e ao plano. Com userId null (saiu da conta), desassocia.
   * Só traits simples e não sensíveis chegam aos serviços (ver safeProps).
   */
  identifyUser(userId: string | null, traits?: UserTraits): void {
    try {
      if (!userId) {
        if (!identifiedAs) return;
        posthogLog('authenticated session telemetry reset');
        identifiedAs = null;
        if (sentryOn) Sentry.setUser(null);
        posthog?.reset();
        return;
      }
      // A identidade persiste no SDK; atualizações de perfil não devem criar novos identify calls.
      if (identifiedAs === userId) return;
      const props = safeProps({ ...traits, platform, app_version: appVersion });
      if (sentryOn) {
        Sentry.setUser({ id: userId });
        if (typeof props.plan === 'string') Sentry.setTag('plan', props.plan);
      }
      const ph = getPostHog();
      if (ph) {
        ph.identify(userId, { $set: props });
        posthogLog('authenticated session telemetry linked', {
          platform,
          plan: typeof props.plan === 'string' ? props.plan : 'unknown',
        });
      }
      identifiedAs = userId;
    } catch {
      // ignora
    }
  },

  /** Evento de produto: vai para o PostHog (com login) e vira breadcrumb no Sentry. */
  trackEvent(eventName: string, properties?: EventProps): void {
    try {
      if (!isValidEventName(eventName)) return;
      const props = safeProps(properties);
      if (sentryOn) Sentry.addBreadcrumb({ category: 'event', message: eventName, data: props, level: 'info' });
      if (identifiedAs && posthog) posthog.capture(eventName, props);
    } catch {
      // ignora
    }
  },

  /** Exceção tratada (o app seguiu funcionando) enviada ao Sentry com metadados extras, já limpos. */
  captureError(error: unknown, context?: ErrorContext): void {
    try {
      if (!sentryOn) return;
      const { where, ...extra } = context ?? { where: 'unknown' };
      Sentry.captureException(toError(error), {
        level: 'error',
        tags: { where: scrubText(where).slice(0, 40), handled: 'yes' },
        extra: safeProps(extra),
      });
    } catch {
      // ignora
    }
  },
};
