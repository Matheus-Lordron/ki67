import type { LucideIcon } from 'lucide-react-native';
import { Check } from 'lucide-react-native';
import { type ComponentRef, forwardRef, type ReactNode } from 'react';
import { Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors } from '@/theme/colors';

export function Label({ children, hint }: { children: string; hint?: ReactNode }) {
  return (
    <View className="mb-1.5 flex-row items-center justify-between">
      <Text className="font-sans-medium text-[13px] text-ink">{children.replace(/:$/, '')}</Text>
      {typeof hint === 'string' ? <Text className="font-sans text-xs text-ink-subtle">{hint}</Text> : hint}
    </View>
  );
}

interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: ReactNode;
  icon?: LucideIcon;
  right?: ReactNode;
  mono?: boolean;
}

export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  { label, hint, icon: Icon, right, mono, multiline, className = '', ...props },
  ref,
) {
  return (
    <View className="w-full">
      {label ? <Label hint={hint}>{label}</Label> : null}
      <View className="relative justify-center">
        {Icon ? (
          <View className="absolute left-3 z-10" pointerEvents="none">
            <Icon size={16} color={colors.inkSubtle} />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          multiline={multiline}
          placeholderTextColor={colors.inkSubtle}
          textAlignVertical={multiline ? 'top' : 'center'}
          className={`min-h-10 w-full rounded-xs border border-line bg-white px-3 py-2 text-[13px] text-ink focus:border-ink web:outline-none ${mono ? 'font-mono' : 'font-sans'} ${Icon ? 'pl-9' : ''} ${right ? 'pr-10' : ''} ${multiline ? 'min-h-20' : ''} ${className}`}
          {...props}
        />
        {right ? <View className="absolute right-1">{right}</View> : null}
      </View>
    </View>
  );
});

export function Checkbox({ checked, onChange, label, description, disabled }: {
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
      className={`min-h-11 flex-row items-center gap-2.5 rounded-xs border p-2.5 ${checked ? 'border-ink bg-surface' : 'border-line bg-white'} ${disabled ? 'opacity-60' : ''}`}
    >
      <View className={`h-4 w-4 items-center justify-center rounded-xs border ${checked ? 'border-primary bg-primary' : 'border-line bg-white'}`}>
        {checked ? <Check size={12} color={colors.white} /> : null}
      </View>
      <View className="flex-1">
        <Text className="font-sans-medium text-[13px] text-ink">{label}</Text>
        {description ? <Text className="font-sans text-xs text-ink-subtle">{description}</Text> : null}
      </View>
    </Pressable>
  );
}

export function RadioRow({ selected, onPress, label, value }: { selected: boolean; onPress: () => void; label: string; value?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`min-h-10 flex-row items-center gap-2 rounded-xs border p-2 ${selected ? 'border-ink bg-surface' : 'border-line bg-white'}`}
    >
      <View className={`h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-ink' : 'border-line'}`}>
        {selected ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
      </View>
      <Text className="flex-1 font-sans text-[13px] text-ink">{label}</Text>
      {value ? <Text className="font-mono text-[13px] text-ink">{value}</Text> : null}
    </Pressable>
  );
}

/** Seletor de abas/segmentos. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View className="flex-row flex-wrap self-start rounded-xs border border-line bg-white p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`min-h-9 flex-row items-center gap-2 rounded-xs px-3 py-1.5 ${active ? 'bg-surface-alt' : 'web:hover:bg-surface'}`}
          >
            {Icon ? <Icon size={14} color={active ? colors.ink : colors.inkSubtle} /> : null}
            <Text className={`text-[13px] ${active ? 'font-sans-medium text-ink' : 'font-sans text-ink-muted'}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
