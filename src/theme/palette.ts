// Tema de cores: paletas prontas e cálculo das variações a partir da cor principal.

export const DEFAULT_THEME_COLOR = '#C08497';

export const THEME_PRESETS: { name: string; hex: string }[] = [
  { name: 'Rosé Antigo', hex: '#C08497' },
  { name: 'Terracota Nude', hex: '#B56555' },
  { name: 'Verde Sálvia', hex: '#6B8E78' },
  { name: 'Lavanda Suave', hex: '#8B7AA8' },
  { name: 'Dourado Areia', hex: '#A68A64' },
  { name: 'Grafite Minimal', hex: '#27272A' },
];

export const isPresetColor = (hex: string) => THEME_PRESETS.some((p) => p.hex === normalizeHex(hex));

/** "#c08497" / "c08497" -> "#C08497"; null se não for um HEX de 6 dígitos */
export function normalizeHex(input: string): string | null {
  const m = input.trim().replace(/^#/, '').match(/^[0-9a-f]{6}$/i);
  return m ? `#${m[0].toUpperCase()}` : null;
}

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const h = (normalizeHex(hex) ?? DEFAULT_THEME_COLOR).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

const toHex = (rgb: Rgb) =>
  `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** Mistura a cor com outra (amount = 0..1 da outra cor) */
const mix = (a: Rgb, b: Rgb, amount: number): Rgb => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount) as Rgb;

/** Luminância relativa (WCAG), de 0 (preto) a 1 (branco) */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre duas cores (1 a 21). Texto normal precisa de 4,5:1 (NBR 17060 / WCAG 1.4.3). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mínimo para texto normal (AA) */
export const MIN_CONTRAST = 4.5;

/** Escurece a cor aos poucos até o texto ter contraste suficiente (no máximo até quase preto). */
function darkenUntil(hex: string, against: string): string {
  let rgb = toRgb(hex);
  for (let i = 0; i < 40 && contrastRatio(toHex(rgb), against) < MIN_CONTRAST; i++) rgb = mix(rgb, [0, 0, 0], 0.05);
  return toHex(rgb);
}

/** Texto legível sobre a cor: branco para cores escuras/médias, quase preto para cores muito claras */
export function contrastTextColor(hex: string): '#FFFFFF' | '#18181B' {
  return luminance(hex) > 0.5 ? '#18181B' : '#FFFFFF';
}

/** Cor clara demais some no fundo branco do app */
export const isTooLight = (hex: string) => luminance(hex) > 0.8;

export interface ThemeColors {
  primary: string;
  /** Tom mais escuro: textos e ícones de destaque */
  primaryDark: string;
  /** Tom bem claro (sólido): fundos de seleção e badges */
  primarySoft: string;
  /** Texto/ícone sobre a cor principal */
  onPrimary: string;
}

export function deriveTheme(hex: string): ThemeColors {
  const chosen = normalizeHex(hex) ?? DEFAULT_THEME_COLOR;
  const onPrimary = contrastTextColor(chosen);
  // Botões com texto branco: escurece só o necessário para o texto atingir 4,5:1 (UX-04).
  // Ex.: o rosé padrão #C08497 tinha 3,0:1 com branco.
  const primary = onPrimary === '#FFFFFF' ? darkenUntil(chosen, '#FFFFFF') : chosen;
  const rgb = toRgb(chosen);
  const primarySoft = toHex(mix(rgb, [255, 255, 255], 0.86));
  // Cores muito claras: o "escuro" precisa escurecer mais para ser legível
  const darken = luminance(chosen) > 0.5 ? 0.55 : 0.22;
  // Tom escuro é usado como texto sobre branco e sobre o fundo claro do tema: garante 4,5:1 nos dois
  const primaryDark = darkenUntil(darkenUntil(toHex(mix(rgb, [0, 0, 0], darken)), '#FFFFFF'), primarySoft);
  return { primary, primaryDark, primarySoft, onPrimary };
}

/** "R G B" para as variáveis CSS do Tailwind (rgb(var(--x) / alpha)) */
export const rgbTriplet = (hex: string) => toRgb(hex).join(' ');

/** Variáveis CSS usadas pelas classes bg-primary, text-primary-dark, text-on-primary… */
export function themeVars(t: ThemeColors): Record<string, string> {
  return {
    '--color-primary': rgbTriplet(t.primary),
    '--color-primary-dark': rgbTriplet(t.primaryDark),
    '--color-primary-soft': rgbTriplet(t.primarySoft),
    '--color-on-primary': rgbTriplet(t.onPrimary),
  };
}
