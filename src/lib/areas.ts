// Bairros atendidos a domicílio.
import { WEEKDAYS_SHORT } from '@/lib/dates';

/** "Seg, Qua, Sex" ou "Todos os dias" */
export function describeDays(days: number[]): string {
  if (days.length === 7) return 'Todos os dias';
  return [...days].sort().map((d) => WEEKDAYS_SHORT[d]).join(', ');
}
