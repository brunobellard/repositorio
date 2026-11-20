// Cor do tema guardada no aparelho, para o app já abrir com ela (sem piscar a cor padrão).
// Fica aqui (e não no ThemeContext) para o login/logout poder limpá-la sem dependência circular.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const THEME_CACHE_KEY = 'agenda-beleza:theme-color';

/** Ao sair da conta: a próxima pessoa no aparelho não herda a cor do estúdio anterior. */
export async function clearThemeCache() {
  try {
    await AsyncStorage.removeItem(THEME_CACHE_KEY);
  } catch {
    // ignora
  }
}
