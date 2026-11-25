import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { colors } from '@/theme/colors';

type Variant = 'primary' | 'secondary' | 'outline' | 'neutral' | 'ghost' | 'danger' | 'soft';

const box: Record<Variant, string> = {
  primary: 'bg-primary web:hover:bg-primary-dark',
  secondary: 'bg-primary web:hover:bg-primary-dark',
  outline: 'bg-white border border-primary web:hover:bg-surface-alt',
  neutral: 'bg-white border border-line-button web:hover:bg-surface-subtle',
  ghost: 'web:hover:bg-surface-subtle',
  danger: 'bg-white border border-line-button web:hover:bg-danger-soft',
  soft: 'bg-surface-alt web:hover:bg-primary-muted/40',
};

const text: Record<Variant, string> = {
  primary: 'font-sans-bold text-white',
  secondary: 'font-sans-bold text-white',
  outline: 'font-sans-bold text-primary',
  neutral: 'font-sans-semibold text-ink',
  ghost: 'font-sans-semibold text-ink-muted',
  danger: 'font-sans-semibold text-danger',
  soft: 'font-sans-semibold text-primary',
};

const iconColor: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.white,
  outline: colors.primary,
  neutral: colors.ink,
  ghost: colors.inkMuted,
  danger: colors.danger,
  soft: colors.primary,
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

const sizes = {
  sm: 'min-h-9 px-3.5 py-1.5 rounded-[8px]',
  md: 'min-h-12 px-[22px] py-2.5 rounded-[10px]',
  lg: 'min-h-[50px] px-6 py-3 rounded-[10px]',
};

const textSizes = {
  sm: 'text-[13px]',
  md: 'text-[15px]',
  lg: 'text-[15px]',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  iconRight: IconRight,
  size = 'md',
  disabled,
  loading,
  className = '',
  accessibilityLabel,
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive }}
      className={`flex-row items-center justify-center gap-2 ${sizes[size]} ${box[variant]} ${inactive ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor[variant]} />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : 16} color={iconColor[variant]} />
      ) : null}
      <Text className={`${textSizes[size]} ${text[variant]}`}>{label}</Text>
      {IconRight ? <IconRight size={size === 'sm' ? 14 : 16} color={iconColor[variant]} /> : null}
    </Pressable>
  );
}

/** Botão só de ícone, com alvo de toque de 44 px (RNF-12). */
export function IconButton({
  icon: Icon,
  onPress,
  label,
  color = colors.inkMuted,
  active,
  disabled,
  size = 18,
  className = '',
}: {
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
      className={`h-11 w-11 items-center justify-center rounded-[10px] ${active ? 'bg-primary' : 'web:hover:bg-surface-alt'} ${disabled ? 'opacity-40' : ''} ${className}`}
    >
      <Icon size={size} color={active ? colors.white : color} />
    </Pressable>
  );
}
