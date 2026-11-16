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
  const primary = normalizeHex(hex) ?? DEFAULT_THEME_COLOR;
  const rgb = toRgb(primary);
  // Cores muito claras: o "escuro" precisa escurecer mais para ser legível
  const darken = luminance(primary) > 0.5 ? 0.55 : 0.22;
  return {
    primary,
    primaryDark: toHex(mix(rgb, [0, 0, 0], darken)),
    primarySoft: toHex(mix(rgb, [255, 255, 255], 0.86)),
    onPrimary: contrastTextColor(primary),
  };
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
