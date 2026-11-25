import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Dialog } from '@/components/ui/Dialog';
import { Label } from '@/components/ui/Field';
import { colors } from '@/theme/colors';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** Substitui o <select> da web: abre uma lista em diálogo, igual nas três plataformas. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecione...',
  compact,
}: {
  label?: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View className={compact ? 'min-w-[200px]' : 'w-full'}>
      {label ? <Label>{label}</Label> : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        className={`min-h-[48px] flex-row items-center justify-between gap-3 rounded-[10px] border border-line-input bg-white px-4 py-3 web:hover:bg-surface-subtle ${
          compact ? '' : 'w-full'
        }`}
      >
        <Text numberOfLines={1} className={`flex-shrink font-sans text-[15px] ${current ? 'text-ink' : 'text-ink-subtle'}`}>
          {current?.label ?? placeholder}
        </Text>
        <ChevronDown size={15} color={colors.ink} />
      </Pressable>
      <Dialog visible={open} onClose={() => setOpen(false)} title={label ?? 'Selecione'} maxWidth={460}>
        <View className="gap-2">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`min-h-[52px] flex-row items-center gap-3 rounded-[10px] border px-4 py-3 ${
                  selected ? 'border-primary bg-primary-subtle' : 'border-line-input bg-white web:hover:bg-surface-subtle'
                }`}
              >
                <View className="flex-1">
                  <Text className="font-sans-bold text-[14px] text-ink">{o.label}</Text>
                  {o.description ? <Text className="font-sans text-[12px] text-ink-muted">{o.description}</Text> : null}
                </View>
                {selected ? <Check size={16} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Dialog>
    </View>
  );
}
