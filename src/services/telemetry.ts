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
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
const appVersion = Constants.expoConfig?.version ?? undefined;

// Build de produção servido no próprio computador (npx expo serve, localhost): conta como desenvolvimento,
// para os erros de testes locais não se misturarem com os de produção no Sentry.
const isLocalWeb =
  platform === 'web' &&
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/.test(window.location?.hostname ?? '');

let started = false;
let sentryOn = false;
let posthog: PostHog | null = null;
let identifiedAs: string | null = null;

export interface UserTraits {
  /** Plano em vigor (free, basic, intermediate, enterprise) */
  plan?: string;
  /**
   * Conta interna ou de teste (link do estúdio começando com "qa-"). Só o PostHog recebe, como
   * $internal_or_test_user: true, para a coorte "Internal / Test users" filtrar os painéis.
   * Contas reais não mandam nada (nem false).
   */
  isTestAccount?: boolean;
  [key: string]: string | number | boolean | null | undefined;
}

export interface ErrorContext {
  /** Onde o erro aconteceu, em código curto (ex.: "store_reload", "public_booking") */
  where: string;
  [key: string]: string | number | boolean | null | undefined;
}

/** PostHog é criado só quando há login (ver identifyUser). */
function getPostHog(): PostHog | null {
  if (posthog || !POSTHOG_KEY) return posthog;
  posthog = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    persistence: 'memory', // nada gravado no aparelho
    captureAppLifecycleEvents: false, // só os eventos que o app manda de propósito
    disableGeoip: true, // sem localização pelo IP
    // O app não usa feature flags: sem chamadas a /flags no login, no identify nem no reset (BUG-020).
    // A leitura da configuração do projeto (/config, uma vez por abertura) o SDK não deixa desligar.
    preloadFeatureFlags: false,
    disableRemoteFeatureFlags: true,
  });
  return posthog;
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
  /** Liga o Sentry (se houver EXPO_PUBLIC_SENTRY_DSN). Chamar uma vez, no layout raiz. */
  init(): void {
    if (started) return;
    started = true;
    try {
      if (!SENTRY_DSN) return;
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: __DEV__ || isLocalWeb ? 'development' : 'production',
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
        identifiedAs = null;
        if (sentryOn) Sentry.setUser(null);
        posthog?.reset();
        return;
      }
      const { isTestAccount, ...rest } = traits ?? {};
      const props = safeProps({ ...rest, platform, app_version: appVersion });
      if (sentryOn) {
        Sentry.setUser({ id: userId, ip_address: null }); // null: o Sentry não deduz o IP nem a cidade
        if (typeof props.plan === 'string') Sentry.setTag('plan', props.plan);
      }
      const ph = getPostHog();
      // Propriedade reservada do PostHog (com "$", que o safeProps não deixa passar): só o booleano true
      if (ph) ph.identify(userId, { $set: isTestAccount === true ? { ...props, $internal_or_test_user: true } : props });
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
