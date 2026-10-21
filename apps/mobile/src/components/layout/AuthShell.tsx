import type { LucideIcon } from 'lucide-react-native';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

/** Moldura das telas públicas: cabeçalho, conteúdo central e rodapé. */
export function AuthShell({ headerLeft, headerRight, footer, children, maxWidth = 400 }: {
  headerLeft: ReactNode;
  headerRight?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="h-14 flex-row items-center justify-between border-b border-line bg-white px-4 sm:px-6">
        {headerLeft}
        {headerRight}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="flex-grow items-center justify-center p-4" keyboardShouldPersistTaps="handled">
          <View style={{ maxWidth }} className="my-6 w-full">
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View className="border-t border-line px-6 py-3">{footer}</View>
    </SafeAreaView>
  );
}

/** Formulário das telas públicas. O ícone fica por compatibilidade, mas não é desenhado. */
export function AuthCard({ title, subtitle, children }: { icon?: LucideIcon; title: string; subtitle: string; children: ReactNode }) {
  return (
    <View className="rounded-xs border border-line bg-white p-6 sm:p-8">
      <View className="mb-6 gap-1">
        <Text accessibilityRole="header" className="font-sans-semibold text-xl text-ink">
          {title}
        </Text>
        <Text className="font-sans text-[13px] leading-5 text-ink-muted">{subtitle}</Text>
      </View>
      <View className="gap-4">{children}</View>
    </View>
  );
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="min-h-11 flex-row items-center gap-1.5">
      <ArrowLeft size={16} color={colors.ink} />
      <Text className="font-sans-medium text-[13px] text-ink">{label}</Text>
    </Pressable>
  );
}

/**
 * Marca do Segmenta: um núcleo reagente (marrom, cheio) sobre um não reagente
 * (azul, contorno), as duas classes que o app separa, e o nome ao lado.
 */
export function BrandMark({ showName = true }: { size?: number; showName?: boolean }) {
  return (
    <View className="flex-row items-center gap-2" accessibilityLabel="Segmenta">
      <View className="h-5 w-6">
        <View style={{ borderColor: colors.hema }} className="absolute left-0 top-0.5 h-4 w-4 rounded-full border-2" />
        <View style={{ backgroundColor: colors.dab }} className="absolute right-0 top-0.5 h-4 w-4 rounded-full" />
      </View>
      {showName ? <Text className="font-sans-semibold text-base text-ink">Segmenta</Text> : null}
    </View>
  );
}
