// UX-04: as cores derivadas do tema garantem contraste AA (4,5:1) nos botões e textos de destaque.
import { describe, expect, it } from '@jest/globals';

import { contrastRatio, deriveTheme, MIN_CONTRAST, THEME_PRESETS } from '@/theme/palette';

describe('contraste das cores do tema', () => {
  const colors = [...THEME_PRESETS.map((p) => p.hex), '#F5C6D6', '#FFE066', '#E57373'];
  for (const hex of colors) {
    it(`${hex}: texto do botão principal com 4,5:1 ou mais`, () => {
      const t = deriveTheme(hex);
      expect(contrastRatio(t.primary, t.onPrimary)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    });
    it(`${hex}: tom escuro legível sobre branco e sobre o fundo claro`, () => {
      const t = deriveTheme(hex);
      expect(contrastRatio(t.primaryDark, '#FFFFFF')).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(t.primaryDark, t.primarySoft)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    });
  }

  it('o rosé padrão (3,0:1 com branco) é escurecido só o necessário', () => {
    const t = deriveTheme('#C08497');
    expect(t.onPrimary).toBe('#FFFFFF');
    expect(t.primary).not.toBe('#C08497');
    expect(contrastRatio(t.primary, '#FFFFFF')).toBeLessThan(MIN_CONTRAST + 0.6);
  });
});
