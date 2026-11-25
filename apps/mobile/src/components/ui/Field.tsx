import type { LucideIcon } from 'lucide-react-native';
import { Check } from 'lucide-react-native';
import { type ComponentRef, forwardRef, type ReactNode } from 'react';
import { Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors } from '@/theme/colors';

export function Label({
  children,
  optional,
  hint,
}: {
  children: string;
  optional?: string;
  hint?: ReactNode;
}) {
  return (
    <View className="mb-2 flex-row items-baseline justify-between gap-2">
      <Text className="font-sans-semibold text-[13px] text-ink">
        {children}
        {optional ? <Text className="font-sans-medium text-[13px] text-ink-muted">{` · ${optional}`}</Text> : null}
      </Text>
      {typeof hint === 'string' ? <Text className="font-sans text-[12px] text-ink-muted">{hint}</Text> : hint}
    </View>
  );
}

interface TextFieldProps extends TextInputProps {
  label?: string;
  optional?: string;
  hint?: ReactNode;
  icon?: LucideIcon;
  right?: ReactNode;
  mono?: boolean;
}

export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  { label, optional, hint, icon: Icon, right, mono, multiline, className = '', ...props },
  ref,
) {
  return (
    <View className="w-full">
      {label ? <Label optional={optional} hint={hint}>{label}</Label> : null}
      <View className="relative justify-center">
        {Icon ? (
          <View className="absolute left-4 z-10" pointerEvents="none">
            <Icon size={16} color={colors.inkSubtle} />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          multiline={multiline}
          placeholderTextColor={colors.inkSubtle}
          textAlignVertical={multiline ? 'top' : 'center'}
          className={`min-h-[48px] w-full rounded-[10px] border border-line-input bg-white px-4 py-3 text-[15px] text-ink focus:border-primary web:outline-none ${
            mono ? 'font-mono' : 'font-sans'
          } ${Icon ? 'pl-11' : ''} ${right ? 'pr-11' : ''} ${multiline ? 'min-h-[96px]' : ''} ${className}`}
          {...props}
        />
        {right ? <View className="absolute right-1.5">{right}</View> : null}
      </View>
    </View>
  );
});

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onChange}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      className={`min-h-[56px] flex-row items-center gap-3 rounded-[10px] border border-line-input px-4 py-3 ${
        checked ? 'bg-primary-subtle' : 'bg-white web:hover:bg-surface-subtle'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <View
        className={`h-[18px] w-[18px] items-center justify-center rounded-[3px] border ${
          checked ? 'border-primary bg-primary' : 'border-[#767676] bg-white'
        }`}
      >
        {checked ? <Check size={12} color={colors.white} /> : null}
      </View>
      <View className="flex-1">
        <Text className="font-sans-bold text-[14px] text-ink">{label}</Text>
        {description ? <Text className="font-sans text-[12px] text-ink-muted">{description}</Text> : null}
      </View>
    </Pressable>
  );
}

export function RadioRow({
  selected,
  onPress,
  label,
  value,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  value?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`min-h-[48px] flex-row items-center gap-3 rounded-[10px] border px-4 py-3 ${
        selected ? 'border-primary bg-primary-subtle' : 'border-line-input bg-white web:hover:bg-surface-subtle'
      }`}
    >
      <View className={`h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-primary' : 'border-line-input'}`}>
        {selected ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
      </View>
      <Text className={`flex-1 font-sans-semibold text-[14px] ${selected ? 'text-primary' : 'text-ink'}`}>{label}</Text>
      {value ? <Text className="font-sans-black text-[15px] text-ink">{value}</Text> : null}
    </Pressable>
  );
}

/** Seletor de abas/segmentos no padrão do Figma (ex.: Pendentes 1 | Avaliadas 3). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number; icon?: LucideIcon }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-1 self-start rounded-[12px] bg-surface-alt p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`min-h-[40px] flex-row items-center justify-center gap-1.5 rounded-[9px] px-[18px] py-2 ${
              active ? 'bg-primary' : 'web:hover:bg-white/60'
            }`}
          >
            <Text className={`font-sans-bold text-[14px] ${active ? 'text-white' : 'text-primary'}`}>{o.label}</Text>
            {o.count !== undefined ? (
              <Text className={`font-sans-bold text-[14px] ${active ? 'text-white opacity-75' : 'text-primary opacity-60'}`}>{o.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
