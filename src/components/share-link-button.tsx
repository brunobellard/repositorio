// UX-09: "Compartilhar meu link" (folha de compartilhamento do sistema), em vários lugares do app.
import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import { Button } from '@/components/ui';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { bookingUrl, isValidSlug } from '@/lib/booking';
import { track } from '@/lib/analytics';
import { notify } from '@/lib/confirm';
import { requireFeature } from '@/lib/upgrade';

/** Link público do estúdio (null se ainda não tem link válido). */
export function useBookingLink(): string | null {
  const { profile } = useStore();
  return profile.slug && isValidSlug(profile.slug) ? bookingUrl(profile.slug) : null;
}

/** Abre a folha de compartilhamento; no navegador sem suporte, copia o link. */
export async function shareBookingLink(link: string, businessName?: string, place = 'app') {
  const message = `Agende seu horário comigo${businessName ? ` no ${businessName}` : ''}: ${link}`;
  try {
    if (Platform.OS === 'web') {
      const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
      if (nav?.share) {
        await nav.share({ text: message, url: link });
        track('booking_link_shared', { place });
        return;
      }
      await Clipboard.setStringAsync(link);
      track('booking_link_copied', { place });
      notify('Link copiado', 'Cole no WhatsApp ou na bio do Instagram.');
      return;
    }
    const r = await Share.share({ message });
    if (r.action !== Share.dismissedAction) track('booking_link_shared', { place });
  } catch {
    // Compartilhamento cancelado pela pessoa: nada a fazer
  }
}

/** Botão pronto: respeita o plano (sem link público, abre a tela de planos). */
export function ShareLinkButton({ variant = 'secondary', place }: { variant?: 'primary' | 'secondary'; place: string }) {
  const { profile } = useStore();
  const access = usePlanAccess();
  const link = useBookingLink();
  if (!link) return null;
  return (
    <Button
      title="Compartilhar meu link"
      icon="share-social-outline"
      variant={variant}
      onPress={() => requireFeature(access.hasPublicLink, 'publicLink') && shareBookingLink(link, profile.businessName, place)}
    />
  );
}
