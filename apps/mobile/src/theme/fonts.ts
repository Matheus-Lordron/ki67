import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';

// Carregadas uma vez em src/app/_layout.tsx. Os nomes batem com fontFamily do
// tailwind.config.js: use font-sans-bold, font-mono etc. em vez de font-bold,
// porque no Android/iOS cada peso de uma fonte personalizada é uma família própria.
// IBM Plex: desenhada para interfaces técnicas, com números tabulares na versão mono.
export const appFonts = {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
};
