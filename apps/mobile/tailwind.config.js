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
      // Interface neutra, de instrumento de laboratório: cinzas quentes e texto
      // quase preto. A cor fica reservada para o dado (DAB marrom e hematoxilina
      // azul) e para os estados (erro, alerta, sucesso).
      colors: {
        primary: { DEFAULT: '#1f2124', dark: '#000000', soft: '#e8e7e3' },
        surface: { DEFAULT: '#f5f5f2', alt: '#ecebe7' },
        ink: { DEFAULT: '#1f2124', muted: '#4f5156', subtle: '#76787d' },
        line: '#d9d8d2',
        dab: { DEFAULT: '#8e4d2d', dashed: '#ffb595', soft: '#f6ece6' }, // núcleo reagente (marrom)
        hema: { DEFAULT: '#2f6f9f', dashed: '#5aa3d6', soft: '#e7f0f6' }, // não reagente (azul)
        danger: { DEFAULT: '#b42318', soft: '#fdecea', dark: '#7a1a12' },
        warn: { DEFAULT: '#7a4b0c', soft: '#fbf1dc' },
      },
      borderRadius: { xs: '3px' },
      // Sem sombra nos blocos: a separação vem da borda e do espaço.
      boxShadow: { '2xs': 'none', xs: 'none' },
      // No Android e no iOS cada peso é uma família de fonte própria (veja src/theme/fonts.ts).
      fontFamily: {
        sans: ['IBMPlexSans_400Regular'],
        'sans-medium': ['IBMPlexSans_500Medium'],
        'sans-semibold': ['IBMPlexSans_600SemiBold'],
        'sans-bold': ['IBMPlexSans_600SemiBold'],
        'sans-black': ['IBMPlexSans_700Bold'],
        mono: ['IBMPlexMono_400Regular'],
        'mono-medium': ['IBMPlexMono_500Medium'],
        'mono-bold': ['IBMPlexMono_500Medium'],
      },
    },
  },
  plugins: [],
};
