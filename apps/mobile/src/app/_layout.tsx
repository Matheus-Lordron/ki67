import '@/global.css';

import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ui/Screen';
import { useAppStore } from '@/state/appStore';
import { appFonts } from '@/theme/fonts';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const booting = useAppStore((s) => s.booting);
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  );
  const ready = (fontsLoaded || !!fontError) && !booting;

  // Modo real: retoma a sessão salva no aparelho (só se o 2FA dela já foi confirmado).
  useEffect(() => {
    void useAppStore.getState().restoreSession();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Estado real da conexão (RNF-05): o indicador do cabeçalho e o autosave usam isto.
  useEffect(
    () => NetInfo.addEventListener((state) => useAppStore.getState().setIsOnline(state.isConnected !== false)),
    [],
  );

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <View className="flex-1 bg-surface">
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f8f9ff' } }} />
          <ToastHost />
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
