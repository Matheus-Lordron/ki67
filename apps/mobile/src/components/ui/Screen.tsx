import { ShieldCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/state/appStore';

/** Área de conteúdo rolável com largura máxima, padrão das telas de lista. */
export function Screen({ children, maxWidth = 1280 }: { children: ReactNode; maxWidth?: number }) {
  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="items-center p-4 lg:p-6" keyboardShouldPersistTaps="handled">
      <View style={{ maxWidth }} className="w-full gap-6">
        {children}
      </View>
    </ScrollView>
  );
}

/** Aviso global (equivale ao toast fixo do protótipo). */
export function ToastHost() {
  const message = useAppStore((s) => s.toastMessage);
  const insets = useSafeAreaInsets();
  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{ bottom: insets.bottom + 24 }}
      className="absolute left-4 right-4 z-50 items-end md:left-auto"
    >
      <View className="max-w-md flex-row items-center gap-2 rounded-xs border border-white/20 bg-primary px-4 py-2.5 shadow-xl">
        <ShieldCheck size={16} color="#34d399" />
        <Text className="flex-shrink font-mono text-xs text-white">{message}</Text>
      </View>
    </View>
  );
}
