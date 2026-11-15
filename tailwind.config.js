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
        primary: {
          DEFAULT: '#B76E79',
          dark: '#9A5561',
          soft: '#F7EBED',
        },
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
