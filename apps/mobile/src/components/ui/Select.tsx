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
export function Select<T extends string>({ label, value, options, onChange, placeholder = 'Selecione...', compact }: {
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
    <View className={compact ? '' : 'w-full'}>
      {label ? <Label>{label}</Label> : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        className={`min-h-10 flex-row items-center justify-between gap-2 rounded-xs border border-line bg-white px-3 py-2 web:hover:bg-surface ${compact ? '' : 'w-full'}`}
      >
        <Text numberOfLines={1} className={`flex-shrink font-sans text-xs ${current ? 'text-ink' : 'text-ink-subtle'}`}>
          {current?.label ?? placeholder}
        </Text>
        <ChevronDown size={14} color={colors.inkSubtle} />
      </Pressable>
      <Dialog visible={open} onClose={() => setOpen(false)} title={label ?? 'Selecione'} maxWidth={420}>
        <View className="gap-1.5">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`min-h-11 flex-row items-center gap-2 rounded-xs border p-2.5 ${selected ? 'border-primary bg-surface-alt' : 'border-line bg-white web:hover:bg-surface'}`}
              >
                <View className="flex-1">
                  <Text className="font-sans-semibold text-xs text-ink">{o.label}</Text>
                  {o.description ? <Text className="font-mono text-[11px] text-ink-subtle">{o.description}</Text> : null}
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
