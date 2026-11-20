import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useAuth } from '@/data/auth';
import {
  authenticate,
  getBiometricSupport,
  isBiometricEnabled,
  setBiometricEnabled,
  type BiometricSupport,
} from '@/lib/biometrics';
import { colors } from '@/theme/colors';

/** Depois de quanto tempo em segundo plano o app pede a digital de novo */
const RELOCK_AFTER_MS = 60_000;

interface BiometricLock {
  ready: boolean;
  support: BiometricSupport;
  enabled: boolean;
  /** Pede a digital e, se confirmar, ativa a entrada por biometria */
  enable: () => Promise<boolean>;
  disable: () => Promise<void>;
  /**
   * Guarda a escolha feita na tela de login/cadastro, sem pedir a digital agora.
   * Ela passa a ser pedida na próxima abertura do app (ou ao voltar do segundo plano).
   */
  setPreference: (on: boolean) => Promise<void>;
}

const Ctx = createContext<BiometricLock | null>(null);

export function BiometricLockProvider({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const [ready, setReady] = useState(false);
  const [support, setSupport] = useState<BiometricSupport>({ available: false, label: 'digital', icon: 'finger-print' });
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  // Ao abrir o app: se a biometria estiver ativa, começa bloqueado.
  useEffect(() => {
    Promise.all([getBiometricSupport(), isBiometricEnabled()]).then(([s, on]) => {
      const active = s.available && on;
      setSupport(s);
      setEnabled(active);
      setLocked(active);
      setReady(true);
    });
  }, []);

  // Ao voltar do segundo plano depois de um tempo, bloqueia de novo.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && backgroundAt.current !== null) {
        if (enabled && Date.now() - backgroundAt.current > RELOCK_AFTER_MS) setLocked(true);
        backgroundAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const enable = useCallback(async () => {
    if (!support.available) return false;
    const ok = await authenticate(`Confirme sua ${support.label} para ativar`);
    if (!ok) return false;
    await setBiometricEnabled(true);
    setEnabled(true);
    return true;
  }, [support]);

  const disable = useCallback(async () => {
    await setBiometricEnabled(false);
    setEnabled(false);
    setLocked(false);
  }, []);

  const setPreference = useCallback(
    async (on: boolean) => {
      if (on && !support.available) return;
      await setBiometricEnabled(on);
      setEnabled(on);
      setLocked(false); // nesta sessão a pessoa acabou de entrar com a senha: não pede agora
    },
    [support],
  );

  // Estável, para o leitor abrir só uma vez quando a tela de bloqueio aparece
  const unlock = useCallback(() => setLocked(false), []);

  const value: BiometricLock = { ready, support, enabled, enable, disable, setPreference };
  const showLock = ready && locked && !!session;

  return (
    <Ctx.Provider value={value}>
      {!ready ? (
        <View className="flex-1 bg-bg" />
      ) : showLock ? (
        <LockScreen
          support={support}
          onUnlock={unlock}
          onUsePassword={async () => {
            setLocked(false);
            await signOut();
          }}
        />
      ) : (
        children
      )}
    </Ctx.Provider>
  );
}

function LockScreen({
  support,
  onUnlock,
  onUsePassword,
}: {
  support: BiometricSupport;
  onUnlock: () => void;
  onUsePassword: () => void;
}) {
  const [failed, setFailed] = useState(false);

  const tryUnlock = useCallback(async () => {
    const ok = await authenticate();
    if (ok) onUnlock();
    else setFailed(true);
  }, [onUnlock]);

  // Abre o leitor assim que a tela aparece
  useEffect(() => {
    authenticate().then((ok) => (ok ? onUnlock() : setFailed(true)));
  }, [onUnlock]);

  return (
    <View className="flex-1 items-center justify-center bg-bg px-8">
      <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-primary-soft">
        <Ionicons name={support.icon} size={40} color={colors.primaryDark} />
      </View>
      <Text className="mb-1 text-xl font-semibold text-ink">Agenda Beleza</Text>
      <Text className="mb-8 text-center text-[14px] text-muted">
        {failed ? `Não foi possível confirmar sua ${support.label}.` : `Use sua ${support.label} para entrar.`}
      </Text>
      <View className="w-full gap-3">
        <Button title={`Entrar com ${support.label}`} icon={support.icon} onPress={tryUnlock} />
        <Button title="Entrar com e-mail e senha" variant="secondary" onPress={onUsePassword} />
      </View>
    </View>
  );
}

export function useBiometricLock(): BiometricLock {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBiometricLock precisa estar dentro de <BiometricLockProvider>');
  return v;
}
