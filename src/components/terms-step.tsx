import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegalConsentBox } from '@/components/legal-consent-box';
import { Button } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { setNextLoginMode } from '@/lib/login-mode';

/**
 * Aceite único dos Termos de Uso e da Política de Privacidade, logo depois do cadastro.
 * "Não aceito" sai da conta e volta para a tela de cadastro.
 */
export function TermsStep() {
  const { acceptTerms, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!accepted || busy) return;
    setBusy(true);
    setError(null);
    const err = await acceptTerms();
    setBusy(false);
    // Deu certo: a sessão é atualizada e o onboarding segue sozinho
    if (err) setError(err);
  }

  async function decline() {
    if (busy) return;
    setBusy(true);
    // Sem sessão, o app volta sozinho para o login, já na aba "Criar conta"
    setNextLoginMode('criar');
    await signOut();
  }

  return (
    // flexGrow: no navegador a página rola inteira e os botões nunca ficam fora de alcance
    <ScrollView
      style={{ flex: 1 }}
      className="bg-bg"
      contentContainerStyle={{
        flexGrow: 1,
        padding: 24,
        paddingTop: insets.top + 24,
        paddingBottom: Math.max(insets.bottom, 16) + 24,
      }}>
      <View className="w-full max-w-[560px] self-center">
        <Text className="text-[24px] font-bold tracking-tight text-ink">Boas-vindas! 💅</Text>
        <Text className="mb-5 mt-1 text-[14px] leading-5 text-muted">
          Antes de começar, leia e aceite os Termos de Uso e a Política de Privacidade.
        </Text>
        <LegalConsentBox accepted={accepted} onChange={setAccepted} />
        {error ? (
          <View className="mb-3 rounded-2xl bg-primary-soft px-4 py-3">
            <Text className="text-[13px] text-primary-dark">{error}</Text>
          </View>
        ) : null}
        <Button
          title={busy && accepted ? 'Salvando…' : 'Aceitar e continuar'}
          icon="arrow-forward"
          loading={busy && accepted}
          onPress={confirm}
          disabled={!accepted || busy}
        />
        <View className="mt-2">
          <Button title="Não aceito, voltar ao cadastro" variant="secondary" onPress={decline} disabled={busy} />
        </View>
      </View>
    </ScrollView>
  );
}
