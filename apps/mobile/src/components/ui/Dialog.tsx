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

const toneStyle = {
  warning: { color: colors.warning },
  success: { color: colors.success },
  primary: { color: colors.ink },
};

export function Dialog({ visible, onClose, title, subtitle, icon: Icon, iconTone = 'primary', children, footer, variant = 'center', maxWidth = 480 }: DialogProps) {
  const sheet = variant === 'sheet';
  return (
    <Modal visible={visible} transparent animationType={sheet ? 'slide' : 'fade'} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className={`flex-1 bg-black/40 ${sheet ? 'justify-end' : 'items-center justify-center p-4'}`}>
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Fechar" />
        <View
          style={{ maxWidth: sheet ? undefined : maxWidth, maxHeight: '88%' }}
          className={`w-full border border-line bg-white shadow-lg ${sheet ? 'rounded-t-md' : 'rounded-xs'}`}
        >
          <View className="flex-row items-center gap-3 border-b border-surface-alt px-5 pb-3 pt-5">
            {Icon && iconTone !== 'primary' ? <Icon size={18} color={toneStyle[iconTone].color} /> : null}
            <View className="flex-1">
              <Text accessibilityRole="header" className="font-sans-semibold text-base text-ink">{title}</Text>
              {subtitle ? <Text className="font-sans text-xs text-ink-subtle">{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" className="h-11 w-11 items-center justify-center rounded-xs web:hover:bg-surface-alt">
              <X size={20} color={colors.inkSubtle} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="gap-4 p-5" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View className="flex-row flex-wrap justify-end gap-2 border-t border-surface-alt px-5 py-3">{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
