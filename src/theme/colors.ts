// Valores brutos para lugares onde className não chega (ícones, tab bar).
// Mantenha em sincronia com tailwind.config.js.
import { DEFAULT_THEME_COLOR, deriveTheme, type ThemeColors } from '@/theme/palette';
import type { AppointmentStatus, PaymentMethod } from '@/types';

const DEFAULT_THEME = deriveTheme(DEFAULT_THEME_COLOR);

export const colors = {
  bg: '#FAF8F6',
  surface: '#FFFFFF',
  ink: '#2A2326',
  muted: '#6F6569',
  line: '#EFE9E7',
  // Cor do tema: trocada por applyThemeColors (ThemeProvider), não edite aqui
  primary: DEFAULT_THEME.primary,
  primaryDark: DEFAULT_THEME.primaryDark,
  primarySoft: DEFAULT_THEME.primarySoft,
  onPrimary: DEFAULT_THEME.onPrimary,
  whatsapp: '#1C7A4B',
};

/** Atualiza as cores do tema usadas em ícones e estilos (o ThemeProvider remonta a tela em seguida). */
export function applyThemeColors(t: ThemeColors) {
  colors.primary = t.primary;
  colors.primaryDark = t.primaryDark;
  colors.primarySoft = t.primarySoft;
  colors.onPrimary = t.onPrimary;
}

export const statusInfo: Record<
  AppointmentStatus,
  { label: string; color: string; bg: string; text: string; bgClass: string }
> = {
  pendente: {
    label: 'Pendente',
    color: '#8A6420',
    bg: '#FBF2E0',
    text: 'text-status-pendente',
    bgClass: 'bg-status-pendente-bg',
  },
  confirmado: {
    label: 'Confirmado',
    color: '#4A7356',
    bg: '#EAF2EC',
    text: 'text-status-confirmado',
    bgClass: 'bg-status-confirmado-bg',
  },
  concluido: {
    label: 'Concluído',
    color: '#4A6582',
    bg: '#E7EEF5',
    text: 'text-status-concluido',
    bgClass: 'bg-status-concluido-bg',
  },
  cancelado: {
    label: 'Cancelado',
    color: '#6F6569',
    bg: '#F2EFEF',
    text: 'text-status-cancelado',
    bgClass: 'bg-status-cancelado-bg',
  },
};

export const paymentLabels: Record<PaymentMethod, string> = {
  pix: 'Pix',
  credito: 'Crédito',
  debito: 'Débito',
  dinheiro: 'Dinheiro',
};
