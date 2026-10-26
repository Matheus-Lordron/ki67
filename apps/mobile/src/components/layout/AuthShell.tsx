import type { LucideIcon } from 'lucide-react-native';
import { ArrowLeft, Microscope } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

/** Moldura das telas públicas: cabeçalho, cartão central e rodapé regulatório. */
export function AuthShell({ headerLeft, headerRight, footer, children, maxWidth = 440 }: {
  headerLeft: ReactNode;
  headerRight?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="h-14 flex-row items-center justify-between border-b border-line bg-white px-4 sm:px-6">
        {headerLeft}
        {headerRight}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-surface">
        <ScrollView contentContainerClassName="flex-grow items-center justify-center p-4" keyboardShouldPersistTaps="handled">
          <View style={{ maxWidth }} className="my-4 w-full">
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View className="border-t border-line bg-white px-6 py-3">{footer}</View>
    </SafeAreaView>
  );
}

export function AuthCard({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle: string; children: ReactNode }) {
  return (
    <View className="rounded-xs border border-line bg-white p-6 shadow-md sm:p-8">
      <View className="mb-6 items-center">
        <View className="mb-3 h-12 w-12 items-center justify-center rounded-xs border border-line bg-surface-alt">
          <Icon size={24} color={colors.primary} />
        </View>
        <Text accessibilityRole="header" className="text-center font-sans-bold text-xl text-ink">
          {title}
        </Text>
        <Text className="mt-1 text-center font-sans text-xs leading-5 text-ink-muted">{subtitle}</Text>
      </View>
      <View className="gap-4">{children}</View>
    </View>
  );
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="min-h-11 flex-row items-center gap-1.5">
      <ArrowLeft size={16} color={colors.primary} />
      <Text className="font-sans-semibold text-xs text-primary">{label}</Text>
    </Pressable>
  );
}

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center rounded-xs bg-primary">
      <Microscope size={size * 0.6} color={colors.white} />
    </View>
  );
}
