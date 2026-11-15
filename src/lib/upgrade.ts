// Disparo do aviso de upgrade (paywall), sem dependências de interface.
// A tela do aviso fica em src/components/upgrade-modal.tsx (UpgradeHost).
import type { PlanFeature } from '@/constants/plans';

type Listener = (f: PlanFeature) => void;
const listeners = new Set<Listener>();

export function onUpgradeRequest(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Abre o aviso de upgrade para um recurso bloqueado. */
export function openUpgrade(feature: PlanFeature) {
  listeners.forEach((l) => l(feature));
}

/**
 * Libera a ação se o plano tem o recurso; se não tem, abre o aviso de upgrade.
 * Uso: if (!requireFeature(access.hasExport, 'export')) return;
 */
export function requireFeature(allowed: boolean, feature: PlanFeature): boolean {
  if (!allowed) openUpgrade(feature);
  return allowed;
}
