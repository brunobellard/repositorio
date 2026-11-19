// Especialidades do onboarding: cada uma pré-cadastra 4 serviços editáveis.
// Preços e durações de referência para estúdios no Brasil (podem ser ajustados depois).
import type { IconName } from '@/components/ui';

export interface SpecialtyService {
  name: string;
  category: string;
  price: number;
  durationMin: number;
}

export interface Specialty {
  id: string;
  label: string;
  icon: IconName;
  services: SpecialtyService[];
}

export const SPECIALTIES: Specialty[] = [
  {
    id: 'nails',
    label: 'Manicure & Nail Design',
    icon: 'hand-left-outline',
    services: [
      { name: 'Manicure', category: 'Unhas', price: 35, durationMin: 45 },
      { name: 'Pedicure', category: 'Unhas', price: 40, durationMin: 60 },
      { name: 'Alongamento em gel', category: 'Unhas', price: 160, durationMin: 150 },
      { name: 'Manutenção de alongamento', category: 'Unhas', price: 110, durationMin: 120 },
    ],
  },
  {
    id: 'hair',
    label: 'Cabeleireiro(a)',
    icon: 'cut-outline',
    services: [
      { name: 'Corte feminino', category: 'Cabelo', price: 90, durationMin: 60 },
      { name: 'Escova', category: 'Cabelo', price: 60, durationMin: 45 },
      { name: 'Coloração', category: 'Cabelo', price: 180, durationMin: 120 },
      { name: 'Hidratação capilar', category: 'Cabelo', price: 80, durationMin: 60 },
    ],
  },
  {
    id: 'brows',
    label: 'Design de Sobrancelhas',
    icon: 'eye-outline',
    services: [
      { name: 'Design de sobrancelhas', category: 'Sobrancelhas', price: 45, durationMin: 30 },
      { name: 'Design com henna', category: 'Sobrancelhas', price: 60, durationMin: 45 },
      { name: 'Brow lamination', category: 'Sobrancelhas', price: 130, durationMin: 60 },
      { name: 'Micropigmentação fio a fio', category: 'Sobrancelhas', price: 450, durationMin: 150 },
    ],
  },
  {
    id: 'lashes',
    label: 'Extensão de Cílios',
    icon: 'sparkles-outline',
    services: [
      { name: 'Extensão fio a fio', category: 'Cílios', price: 150, durationMin: 120 },
      { name: 'Volume russo', category: 'Cílios', price: 200, durationMin: 150 },
      { name: 'Manutenção de cílios', category: 'Cílios', price: 100, durationMin: 90 },
      { name: 'Lash lifting', category: 'Cílios', price: 120, durationMin: 60 },
    ],
  },
  {
    id: 'facial',
    label: 'Estética Facial',
    icon: 'happy-outline',
    services: [
      { name: 'Limpeza de pele', category: 'Estética', price: 150, durationMin: 90 },
      { name: 'Peeling de diamante', category: 'Estética', price: 130, durationMin: 60 },
      { name: 'Hidratação facial', category: 'Estética', price: 120, durationMin: 60 },
      { name: 'Dermaplaning', category: 'Estética', price: 140, durationMin: 60 },
    ],
  },
];
