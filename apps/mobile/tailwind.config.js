/** @type {import('tailwindcss').Config} */
module.exports = {
  // Arquivos onde existem classes do Tailwind (NativeWind).
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // O app é só tema claro; 'class' evita o erro do NativeWind na web quando o
  // navegador muda a classe de cor do <html>.
  darkMode: 'class',
  theme: {
    extend: {
      // Tokens do sistema visual Segmenta Studio (Figma segmenta-design).
      colors: {
        primary: {
          DEFAULT: '#0b1f52',
          dark: '#183786',
          soft: '#eef1f8',
          subtle: '#f3f6fd',
          muted: '#c9d4f5',
        },
        surface: {
          DEFAULT: '#ffffff',
          alt: '#eef1f8',
          subtle: '#f8f9fc',
          canvas: '#0e1a3a',
        },
        ink: {
          DEFAULT: '#0a0a0a',
          muted: '#5a6272',
          subtle: '#8a91a1',
        },
        line: {
          DEFAULT: '#e5e7eb',
          soft: '#eef0f4',
          card: '#b3bac8',
          input: '#a9b0bf',
          button: '#d5d9e2',
        },
        dab: { DEFAULT: '#8e4d2d', dashed: '#ffb595' }, // núcleo reagente (marrom)
        hema: { DEFAULT: '#0284c7', dashed: '#38bdf8', soft: '#e0f2fe' }, // não reagente (azul)
        danger: { DEFAULT: '#b42318', soft: '#fef3f2', dark: '#912018' },
        warn: { DEFAULT: '#78350f', soft: '#fef3c7' },
      },
      borderRadius: { xs: '8px' },
      boxShadow: {
        '2xs': '0 1px 2px rgb(10 10 10 / 0.04)',
        xs: '0 2px 14px 0 rgb(10 10 10 / 0.07)',
      },
      // No Android e no iOS cada peso é uma família de fonte própria (veja src/theme/fonts.ts).
      fontFamily: {
        sans: ['Manrope_400Regular'],
        'sans-medium': ['Manrope_500Medium'],
        'sans-semibold': ['Manrope_600SemiBold'],
        'sans-bold': ['Manrope_700Bold'],
        'sans-black': ['Manrope_800ExtraBold'],
        mono: ['JetBrainsMono_400Regular'],
        'mono-medium': ['JetBrainsMono_500Medium'],
        'mono-bold': ['JetBrainsMono_700Bold'],
      },
    },
  },
  plugins: [],
};
