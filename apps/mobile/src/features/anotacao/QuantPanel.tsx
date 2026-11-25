import { Sparkles } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { TextField } from '@/components/ui/Field';
import type { SaveStatus } from '@/state/editorStore';
import { colors } from '@/theme/colors';
import type { MarkLabel } from '@/types';
import { formatKi67, getKi67Stratification } from '@/utils/ki67';

/** Faixas de St. Gallen como badges do NativeWind. */
export function StratBadge({ index }: { index: number | null }) {
  const s = getKi67Stratification(index);
  return (
    <View className="self-start rounded-full bg-surface-alt px-2.5 py-1">
      <Text className="font-sans-bold text-[11px] text-primary">{s.label}</Text>
    </View>
  );
}

export function SaveIndicator({ status, version, offline }: { status: SaveStatus; version: number; offline: boolean }) {
  const text = status === 'saved' ? (version > 0 ? `Salvo · v${version}` : 'Salvo') : status === 'saving' ? 'Salvando...' : offline ? 'Offline' : 'Não salvo';
  const tone = status === 'saved' ? 'text-ink-muted' : status === 'saving' ? 'text-amber-700' : 'text-danger';
  return (
    <View accessibilityLiveRegion="polite" className="flex-row items-center gap-1.5">
      <View className={`h-1.5 w-1.5 rounded-full ${status === 'saved' ? 'bg-emerald-600' : status === 'saving' ? 'bg-amber-600' : 'bg-danger'}`} />
      <Text className={`font-sans-semibold text-[12px] ${tone}`}>{text}</Text>
    </View>
  );
}

interface QuantPanelProps {
  counts: { reagents: number; nonReagents: number; total: number };
  ki67: number | null;
  activeLabel: MarkLabel;
  onLabel: (label: MarkLabel) => void;
  onPreAnnotate: () => void;
  observation: string;
  onObservation: (text: string) => void;
  activeVersion: number;
  onHistory: () => void;
  readOnly?: boolean;
}

/** Painel lateral de anotação Ki-67 no padrão do Aside do Figma (node 14:742). */
export function QuantPanel({
  counts,
  ki67,
  activeLabel,
  onLabel,
  onPreAnnotate,
  observation,
  onObservation,
  activeVersion,
  onHistory,
  readOnly,
}: QuantPanelProps) {
  const pct = (n: number) => (counts.total > 0 ? `${((n / counts.total) * 100).toFixed(1).replace('.', ',')}%` : '0%');

  return (
    <View className="gap-5">
      <View className="gap-2 rounded-[12px] border border-line bg-surface-subtle p-3.5" accessibilityLiveRegion="polite">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-sans-semibold text-[12px] text-ink-muted">Índice Ki-67</Text>
          <StratBadge index={ki67} />
        </View>
        <Text accessibilityLabel={`Índice Ki-67 ${formatKi67(ki67)}`} className="font-sans-black text-[28px] leading-[32px] tracking-[-0.56px] text-ink">
          {formatKi67(ki67)}
        </Text>
      </View>

      <View className="gap-2">
        <Text className="font-sans-semibold text-[13px] text-ink">Rótulo</Text>
        <View className="gap-2">
          {(['reagente', 'nao_reagente'] as const).map((label) => {
            const active = activeLabel === label;
            const isR = label === 'reagente';
            const value = isR ? counts.reagents : counts.nonReagents;
            return (
              <Pressable
                key={label}
                onPress={() => onLabel(label)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={isR ? 'Rótulo reagente' : 'Rótulo não reagente'}
                className={`min-h-[64px] justify-between rounded-[10px] px-3.5 py-3 ${
                  active ? 'border-2 border-primary bg-primary-subtle' : 'border border-line-input bg-white web:hover:bg-surface-subtle'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className={`h-2.5 w-2.5 rounded-full ${isR ? 'bg-dab' : 'border-2 border-hema bg-white'}`} />
                    <Text className="font-sans-semibold text-[13px] text-ink">{isR ? 'Reagente' : 'Não reagente'}</Text>
                  </View>
                  <Text className="font-sans text-[12px] text-ink-muted">{pct(value)}</Text>
                </View>
                <Text className="font-sans-black text-[18px] text-ink">{value}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text className="font-sans text-[13px] text-ink-muted">{counts.total} núcleos marcados</Text>
      </View>

      {!readOnly ? (
        <Pressable
          onPress={onPreAnnotate}
          accessibilityRole="button"
          className="min-h-[42px] flex-row items-center justify-center gap-2 rounded-[10px] bg-surface-alt px-3.5 web:hover:bg-primary-muted/50"
        >
          <Sparkles size={16} color={colors.primary} />
          <Text className="font-sans-semibold text-[13px] text-primary">Pré-marcar não reagentes</Text>
        </Pressable>
      ) : null}

      <View>
        <TextField
          label="Observação clínica"
          multiline
          maxLength={2000}
          editable={!readOnly}
          value={observation}
          onChangeText={onObservation}
          placeholder="Hotspot, estroma, qualidade da lâmina ou exclusões"
          accessibilityLabel="Observação clínica"
        />
      </View>

      <View className="flex-row items-baseline justify-between pt-1">
        <Text className="font-sans-semibold text-[13px] text-ink-muted">
          Histórico de versões {activeVersion > 0 ? `(v${activeVersion})` : ''}
        </Text>
        <Pressable onPress={onHistory} accessibilityRole="button" hitSlop={8}>
          <Text className="font-sans-bold text-[13px] text-primary">Ver tudo</Text>
        </Pressable>
      </View>
    </View>
  );
}
