// Tema de cores do app: a cor principal vem do perfil (profiles.theme_color) e fica
// guardada no aparelho para o app já abrir com ela, sem piscar a cor padrão.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vars } from 'nativewind';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { planRank, type PlanTier } from '@/constants/plans';
import { useAuth } from '@/data/auth';
import { useStore } from '@/data/store';
import { effectivePlan } from '@/hooks/usePlanAccess';
import { THEME_CACHE_KEY } from '@/lib/theme-cache';
import { applyThemeColors } from '@/theme/colors';
import {
  DEFAULT_THEME_COLOR,
  deriveTheme,
  isPresetColor,
  normalizeHex,
  themeVars,
  type ThemeColors,
} from '@/theme/palette';

const CACHE_KEY = THEME_CACHE_KEY;

interface Theme {
  /** Cor principal (HEX) usada na tela; pode ser um pouco mais escura que a escolhida, para ter contraste AA */
  primaryColor: string;
  /** Cor escolhida pela profissional (paleta ou HEX), sem o ajuste de contraste: use para comparar com as paletas */
  chosenColor: string;
  /** Cor principal com transparência (~10%), para fundos suaves */
  softBackgroundColor: string;
  /** Texto legível sobre a cor principal: branco ou quase preto */
  contrastTextColor: string;
  /** Todas as variações calculadas */
  theme: ThemeColors;
}

const ThemeContext = createContext<Theme | null>(null);

/** Cor que o plano permite usar: Free = padrão; paletas = Básico; HEX livre = Intermediário. */
export function allowedThemeColor(hex: string | undefined, plan: PlanTier): string {
  const color = normalizeHex(hex ?? '') ?? DEFAULT_THEME_COLOR;
  if (color === DEFAULT_THEME_COLOR) return color;
  if (isPresetColor(color)) return planRank(plan) >= planRank('basic') ? color : DEFAULT_THEME_COLOR;
  return planRank(plan) >= planRank('pro') ? color : DEFAULT_THEME_COLOR;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile, loading } = useStore();
  const { session } = useAuth();
  // undefined = ainda lendo o aparelho (a tela de abertura continua visível)
  const [cached, setCached] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then((v) => setCached(normalizeHex(v ?? '')))
      .catch(() => setCached(null));
  }, []);

  // Sem sessão (tela de login): sempre a cor padrão, nunca a do estúdio que usou o aparelho antes
  const fromProfile =
    session && profile.id && !loading ? allowedThemeColor(profile.themeColor, effectivePlan(profile)) : null;
  const color = (session ? (fromProfile ?? cached) : null) ?? DEFAULT_THEME_COLOR;
  const theme = useMemo(() => deriveTheme(color), [color]);
  // Ícones e estilos que usam colors.primary (src/theme/colors.ts)
  applyThemeColors(theme);

  // Guarda a cor do perfil para a próxima abertura
  useEffect(() => {
    if (fromProfile) AsyncStorage.setItem(CACHE_KEY, fromProfile).catch(() => {});
  }, [fromProfile]);

  // No navegador, janelas (Modal) ficam fora desta árvore: as variáveis vão também no <html>
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    for (const [k, v] of Object.entries(themeVars(theme))) document.documentElement.style.setProperty(k, v);
  }, [theme]);

  const value = useMemo<Theme>(
    () => ({
      primaryColor: theme.primary,
      chosenColor: color,
      softBackgroundColor: `${theme.primary}1A`,
      contrastTextColor: theme.onPrimary,
      theme,
    }),
    [theme, color],
  );

  if (cached === undefined) return null;

  return (
    <ThemeContext.Provider value={value}>
      {/* key: trocar a cor redesenha o app inteiro com o novo tema */}
      <View key={theme.primary} style={[{ flex: 1 }, vars(themeVars(theme))]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme precisa estar dentro de <ThemeProvider>');
  return t;
}
