import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { colors } from '@/theme/colors';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'soft';

// Um botão principal por tela (escuro); os demais ficam contidos (borda ou sem fundo).
const box: Record<Variant, string> = {
  primary: 'bg-primary web:hover:bg-primary-dark',
  secondary: 'bg-primary web:hover:bg-primary-dark',
  outline: 'bg-white border border-line web:hover:bg-surface',
  ghost: 'web:hover:bg-surface-alt',
  danger: 'bg-white border border-line web:hover:bg-danger-soft',
  soft: 'bg-surface-alt web:hover:bg-primary-soft',
};
const text: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: 'text-ink',
  ghost: 'text-ink',
  danger: 'text-danger',
  soft: 'text-ink',
};
const iconColor: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.white,
  outline: colors.ink,
  ghost: colors.ink,
  danger: colors.danger,
  soft: colors.ink,
};

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  accessibilityLabel?: string;
  children?: ReactNode;
}

const sizes = { sm: 'min-h-8 px-2.5 py-1', md: 'min-h-10 px-3.5 py-2', lg: 'min-h-11 px-4 py-2.5' };

export function Button({ label, onPress, variant = 'primary', icon: Icon, iconRight: IconRight, size = 'md', disabled, loading, className = '', accessibilityLabel }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive }}
      className={`flex-row items-center justify-center gap-1.5 rounded-xs ${sizes[size]} ${box[variant]} ${inactive ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? <ActivityIndicator size="small" color={iconColor[variant]} /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} color={iconColor[variant]} /> : null}
      <Text className={`font-sans-medium ${size === 'sm' ? 'text-xs' : 'text-[13px]'} ${text[variant]}`}>{label}</Text>
      {IconRight ? <IconRight size={14} color={iconColor[variant]} /> : null}
    </Pressable>
  );
}

/** Botão só de ícone, com alvo de toque de 44 px (RNF-12). */
export function IconButton({ icon: Icon, onPress, label, color = colors.inkMuted, active, disabled, size = 18, className = '' }: {
  icon: LucideIcon;
  onPress?: () => void;
  label: string;
  color?: string;
  active?: boolean;
  disabled?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-11 w-11 items-center justify-center rounded-xs ${active ? 'bg-primary' : 'web:hover:bg-surface-alt'} ${disabled ? 'opacity-40' : ''} ${className}`}
    >
      <Icon size={size} color={active ? colors.white : color} />
    </Pressable>
  );
}
