import type { LucideIcon } from 'lucide-react-native';
import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface DialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconTone?: 'warning' | 'success' | 'primary';
  children: ReactNode;
  footer?: ReactNode;
  /** 'center' (padrão) ou 'sheet' (painel que sobe da borda inferior, usado no celular). */
  variant?: 'center' | 'sheet';
  maxWidth?: number;
}

export function Dialog({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  variant = 'center',
  maxWidth = 580,
}: DialogProps) {
  const sheet = variant === 'sheet';
  return (
    <Modal visible={visible} transparent animationType={sheet ? 'slide' : 'fade'} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className={`flex-1 bg-black/45 ${sheet ? 'justify-end' : 'items-center justify-center p-4'}`}
      >
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Fechar" />
        <View
          style={{ maxWidth: sheet ? undefined : maxWidth, maxHeight: '90%' }}
          className={`w-full bg-white shadow-2xl ${sheet ? 'rounded-t-[20px]' : 'rounded-[16px]'}`}
        >
          <View className="flex-row items-start justify-between gap-4 px-6 pb-2 pt-7 sm:px-9 sm:pt-9">
            <View className="flex-1 gap-1.5">
              <Text className="font-sans-black text-[24px] leading-[29px] tracking-[-0.52px] text-ink sm:text-[26px] sm:leading-[30px]">
                {title}
              </Text>
              {subtitle ? <Text className="font-sans text-[14px] leading-[21px] text-ink-muted">{subtitle}</Text> : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              className="-mr-2 -mt-2 h-11 w-11 items-center justify-center rounded-[10px] web:hover:bg-surface-alt"
            >
              <X size={18} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="gap-[18px] px-6 py-5 sm:px-9" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View className="flex-row flex-wrap justify-end gap-3 px-6 pb-7 pt-2 sm:px-9 sm:pb-9">{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
