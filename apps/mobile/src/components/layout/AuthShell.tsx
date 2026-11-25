import { Image } from 'expo-image';
import type { LucideIcon } from 'lucide-react-native';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

const brandMarkSvg = require('../../../assets/images/brand-mark.svg');
const loginHeroSvg = require('../../../assets/images/login-hero.svg');

/** Moldura das telas públicas no padrão split-screen do Figma (formulário à esquerda, painel institucional à direita). */
export function AuthShell({
  headerLeft,
  headerRight,
  footer,
  children,
  maxWidth = 380,
}: {
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  maxWidth?: number;
}) {
  const { width } = useWindowDimensions();
  const split = width >= 1024;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="flex-1 flex-row bg-white">
        <View className="flex-1 bg-white" style={split ? { flex: 770 } : undefined}>
          <View className="min-h-[64px] flex-row items-center justify-between border-b border-line bg-white px-6 py-4 lg:px-12">
            {headerLeft ?? <BrandLogo />}
            {headerRight}
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
            <ScrollView contentContainerClassName="flex-grow items-center justify-center px-6 py-8 sm:px-14" keyboardShouldPersistTaps="handled">
              <View style={{ maxWidth }} className="w-full">
                {children}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
          {footer ? <View className="border-t border-line bg-white px-6 py-3 lg:px-12">{footer}</View> : null}
        </View>

        {split ? (
          <View style={{ flex: 670 }} className="relative overflow-hidden bg-primary">
            <Image
              source={loginHeroSvg}
              contentFit="cover"
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
            <View className="absolute bottom-14 left-14 right-14">
              <Text className="max-w-[360px] font-sans-bold text-[30px] leading-[36px] tracking-[-0.6px] text-white">
                {'Anotação cega de\nimagens Segmenta\nStudio'}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-8">
      <View className="gap-2">
        <Text accessibilityRole="header" className="font-sans-black text-[36px] leading-[42px] tracking-[-1.2px] text-ink sm:text-[40px] sm:leading-[44px]">
          {title}
        </Text>
        <Text className="font-sans text-[15px] leading-[22.5px] text-ink-muted">{subtitle}</Text>
      </View>
      <View className="gap-5">{children}</View>
    </View>
  );
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="min-h-10 flex-row items-center gap-2">
      <ArrowLeft size={15} color={colors.primary} />
      <Text className="font-sans-semibold text-[14px] text-primary">{label}</Text>
    </Pressable>
  );
}

export function BrandMark({ size = 28 }: { size?: number }) {
  const iconSize = Math.round(size * 0.5);
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center rounded-[8px] bg-primary">
      <Image source={brandMarkSvg} style={{ width: iconSize, height: iconSize }} contentFit="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <BrandMark size={28} />
      {!compact ? <Text className="font-sans-bold text-[16px] tracking-[-0.16px] text-ink">Segmenta Studio</Text> : null}
    </View>
  );
}
