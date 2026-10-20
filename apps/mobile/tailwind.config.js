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
      // Paleta do protótipo do AI Studio. As telas migradas também podem usar os
      // valores arbitrários originais, como bg-[#00236f].
      colors: {
        primary: { DEFAULT: '#00236f', dark: '#1e3a8a', soft: '#dce9ff' },
        surface: { DEFAULT: '#f8f9ff', alt: '#eff4ff' },
        ink: { DEFAULT: '#0b1c30', muted: '#444651', subtle: '#757682' },
        line: '#c5c5d3',
        dab: { DEFAULT: '#8e4d2d', dashed: '#ffb595' }, // núcleo reagente (marrom)
        hema: { DEFAULT: '#0284c7', dashed: '#38bdf8', soft: '#e0f2fe' }, // não reagente (azul)
        danger: { DEFAULT: '#ba1a1a', soft: '#ffdad6', dark: '#93000a' },
        warn: { DEFAULT: '#78350f', soft: '#fef3c7' },
      },
      // Nomes do Tailwind 4 usados no protótipo (rounded-xs, shadow-xs, shadow-2xs).
      borderRadius: { xs: '2px' },
      boxShadow: {
        '2xs': '0 1px rgb(0 0 0 / 0.05)',
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      // No Android e no iOS cada peso é uma família de fonte própria (veja src/theme/fonts.ts).
      fontFamily: {
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
        'sans-black': ['Inter_800ExtraBold'],
        mono: ['JetBrainsMono_400Regular'],
        'mono-medium': ['JetBrainsMono_500Medium'],
        'mono-bold': ['JetBrainsMono_700Bold'],
      },
    },
  },
  plugins: [],
};
