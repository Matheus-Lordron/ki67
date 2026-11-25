import { CheckCircle2, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/state/appStore';

/** Rodapé institucional fixado ao final das telas roláveis (padrão do Figma). */
export function AppFooter() {
  return (
    <View className="w-full items-center justify-center bg-primary px-6 py-[22px]">
      <Text className="font-sans-semibold text-[13px] tracking-[0.52px] text-white">UTFPR</Text>
    </View>
  );
}

/** Área de conteúdo rolável com largura máxima e rodapé institucional. */
export function Screen({ children, maxWidth = 1160 }: { children: ReactNode; maxWidth?: number }) {
  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="flex-grow justify-between" keyboardShouldPersistTaps="handled">
      <View className="w-full items-center px-4 py-10 sm:px-10 lg:py-14">
        <View style={{ maxWidth }} className="w-full gap-8 lg:gap-10">
          {children}
        </View>
      </View>
      <AppFooter />
    </ScrollView>
  );
}

function splitToast(raw: string): { title: string; body?: string } {
  const colonIdx = raw.indexOf(': ');
  if (colonIdx > 0 && colonIdx < 40) {
    return { title: raw.slice(0, colonIdx), body: raw.slice(colonIdx + 2) };
  }
  const dotIdx = raw.indexOf('. ');
  if (dotIdx > 0 && dotIdx < 42) {
    return { title: raw.slice(0, dotIdx), body: raw.slice(dotIdx + 2) };
  }
  return { title: raw };
}

/** Aviso flutuante no padrão do componente Toast do Figma (node 7:14). */
export function ToastHost() {
  const message = useAppStore((s) => s.toastMessage);
  const insets = useSafeAreaInsets();
  if (!message) return null;
  const { title, body } = splitToast(message);

  return (
    <View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={{ bottom: insets.bottom + 24 }}
      className="absolute left-4 right-4 z-50 items-end md:left-auto"
    >
      <View className="w-full max-w-[380px] flex-row items-start gap-3.5 rounded-[12px] bg-primary py-4 pl-5 pr-4 shadow-2xl">
        <View className="pt-0.5">
          <CheckCircle2 size={20} color="#ffffff" />
        </View>
        <View className="flex-1 gap-1">
          <Text className="font-sans-bold text-[14px] text-white">{title}</Text>
          {body ? <Text className="font-sans text-[13px] leading-[19px] text-primary-muted">{body}</Text> : null}
        </View>
        <Pressable
          onPress={() => useAppStore.setState({ toastMessage: null })}
          accessibilityRole="button"
          accessibilityLabel="Fechar aviso"
          className="-mt-1 h-7 w-7 items-center justify-center rounded-[8px] web:hover:bg-white/10"
        >
          <X size={14} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}
