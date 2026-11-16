/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // O app é só tema claro por enquanto; 'class' evita erro no navegador
  darkMode: 'class',
  theme: {
    extend: {
      // Mantenha em sincronia com src/theme/colors.ts
      colors: {
        bg: '#FAF8F6',
        surface: '#FFFFFF',
        ink: '#2A2326',
        muted: '#8A7F83',
        line: '#EFE9E7',
        // Cor do tema (Ajustes > Aparência e cores): variáveis CSS definidas no ThemeProvider
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-dark) / <alpha-value>)',
          soft: 'rgb(var(--color-primary-soft) / <alpha-value>)',
        },
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)',
        status: {
          confirmado: '#5E8B6A',
          'confirmado-bg': '#EAF2EC',
          pendente: '#B7862F',
          'pendente-bg': '#FBF2E0',
          concluido: '#5B7896',
          'concluido-bg': '#E7EEF5',
          cancelado: '#9C9396',
          'cancelado-bg': '#F2EFEF',
        },
      },
      borderRadius: {
        card: '18px',
      },
    },
  },
  plugins: [],
};
