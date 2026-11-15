// Valores brutos para lugares onde className não chega (ícones, tab bar).
// Mantenha em sincronia com tailwind.config.js.
import type { AppointmentStatus, PaymentMethod } from '@/types';

export const colors = {
  bg: '#FAF8F6',
  surface: '#FFFFFF',
  ink: '#2A2326',
  muted: '#8A7F83',
  line: '#EFE9E7',
  primary: '#B76E79',
  primaryDark: '#9A5561',
  primarySoft: '#F7EBED',
  whatsapp: '#25A366',
} as const;

export const statusInfo: Record<
  AppointmentStatus,
  { label: string; color: string; bg: string; text: string; bgClass: string }
> = {
  pendente: {
    label: 'Pendente',
    color: '#B7862F',
    bg: '#FBF2E0',
    text: 'text-status-pendente',
    bgClass: 'bg-status-pendente-bg',
  },
  confirmado: {
    label: 'Confirmado',
    color: '#5E8B6A',
    bg: '#EAF2EC',
    text: 'text-status-confirmado',
    bgClass: 'bg-status-confirmado-bg',
  },
  concluido: {
    label: 'Concluído',
    color: '#5B7896',
    bg: '#E7EEF5',
    text: 'text-status-concluido',
    bgClass: 'bg-status-concluido-bg',
  },
  cancelado: {
    label: 'Cancelado',
    color: '#9C9396',
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
