import { CheckCircle2, FileText, History, Sparkles } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { TextField } from '@/components/ui/Field';
import type { SaveStatus } from '@/state/editorStore';
import { colors } from '@/theme/colors';
import type { MarkLabel } from '@/types';
import { formatKi67, getKi67Stratification } from '@/utils/ki67';

/** Faixas de St. Gallen como badges do NativeWind (as classes do protótipo usam a mesma paleta). */
export function StratBadge({ index }: { index: number | null }) {
  const s = getKi67Stratification(index);
  return (
    <View className={`self-start rounded-xs border px-1.5 py-0.5 ${s.badgeClass.split(' ').filter((c) => c.startsWith('bg-') || c.startsWith('border-')).join(' ')}`}>
      <Text className={`font-mono-bold text-[10px] ${s.badgeClass.split(' ').find((c) => c.startsWith('text-'))}`}>{s.label}</Text>
    </View>
  );
}

export function SaveIndicator({ status, version, offline }: { status: SaveStatus; version: number; offline: boolean }) {
  const style =
    status === 'saved' ? 'bg-emerald-100 text-emerald-800' : status === 'saving' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';
  const [bg, fg] = style.split(' ');
  const text = status === 'saved' ? `Salvo · v${version}` : status === 'saving' ? 'Salvando...' : offline ? 'Não salvo · offline' : 'Não salvo';
  return (
    <View accessibilityLiveRegion="polite" className={`flex-row items-center gap-1 rounded-xs px-2 py-0.5 ${bg}`}>
      <View className={`h-1.5 w-1.5 rounded-full ${status === 'saved' ? 'bg-emerald-600' : status === 'saving' ? 'bg-amber-600' : 'bg-rose-600'}`} />
      <Text className={`font-mono-bold text-[10px] ${fg}`}>{text}</Text>
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

/** Painel de quantificação Ki-67 (índice, seletor de label, pré-marcação e observação). */
export function QuantPanel({ counts, ki67, activeLabel, onLabel, onPreAnnotate, observation, onObservation, activeVersion, onHistory, readOnly }: QuantPanelProps) {
  const pct = (n: number) => (counts.total > 0 ? `${((n / counts.total) * 100).toFixed(1)}%` : '0%');
  return (
    <View className="gap-4">
      <View className="gap-2 rounded-xs border border-line bg-surface-alt p-3.5" accessibilityLiveRegion="polite">
        <View className="flex-row flex-wrap items-center justify-between gap-1">
          <Text className="font-mono-bold text-[11px] uppercase text-ink-subtle">Índice Ki-67 calculado</Text>
          <StratBadge index={ki67} />
        </View>
        <View className="flex-row items-baseline gap-2">
          <Text accessibilityLabel={`Índice Ki-67 ${formatKi67(ki67)}`} className="font-mono-bold text-3xl tracking-tight text-primary">{formatKi67(ki67)}</Text>
          <Text className="font-sans text-xs text-ink-subtle">Índice proliferativo</Text>
        </View>
        <View className="items-center rounded-xs border border-line bg-white p-2">
          <Text className="font-mono text-[11px] text-ink-muted">
            Fórmula: <Text className="font-mono-bold text-primary">[Reagentes / Total] × 100</Text>
          </Text>
        </View>
        <View className="mt-1 gap-1">
          <View className="flex-row justify-between">
            <Text className="font-mono text-[10px] text-ink-subtle">Baixo (&lt;10%)</Text>
            <Text className="font-mono text-[10px] text-ink-subtle">Interm. (10-20%)</Text>
            <Text className="font-mono-bold text-[10px] text-dab">Alto (&gt;20%)</Text>
          </View>
          <View className="h-2 flex-row overflow-hidden rounded-full bg-slate-200">
            <View className="w-[10%] bg-emerald-500" />
            <View className="w-[10%] bg-amber-500" />
            <View className="w-[80%] bg-dab" />
          </View>
        </View>
      </View>

      <View className="gap-1.5">
        <View className="flex-row items-center justify-between">
          <Text className="font-sans-semibold text-xs text-ink">Seletor de rótulo ativo:</Text>
          <Text className="font-mono text-[10px] text-ink-subtle">Atalhos [1] e [2]</Text>
        </View>
        <View className="flex-row gap-2">
          {(['reagente', 'nao_reagente'] as const).map((label) => {
            const active = activeLabel === label;
            const isR = label === 'reagente';
            return (
              <Pressable
                key={label}
                onPress={() => onLabel(label)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={isR ? 'Label reagente' : 'Label não reagente'}
                className={`flex-1 gap-2 rounded-xs p-2.5 ${active ? (isR ? 'border-2 border-dab bg-warn-soft' : 'border-2 border-hema bg-hema-soft') : 'border border-line bg-white'}`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <View className={`h-2.5 w-2.5 rounded-full ${isR ? 'bg-dab' : 'border border-hema bg-hema-soft'}`} />
                    <Text className={`font-sans-bold text-xs ${isR ? 'text-warn' : 'text-sky-700'}`}>{isR ? 'Reagente (DAB)' : 'Não Reagente'}</Text>
                  </View>
                  <Text className={`rounded-xs px-1 font-mono text-[10px] text-white ${isR ? 'bg-dab' : 'bg-hema'}`}>[{isR ? 1 : 2}]</Text>
                </View>
                <View className="flex-row items-baseline justify-between">
                  <Text className={`font-mono-bold text-lg ${isR ? 'text-warn' : 'text-sky-700'}`}>{isR ? counts.reagents : counts.nonReagents}</Text>
                  <Text className={`font-mono text-xs ${isR ? 'text-warn' : 'text-sky-700'}`}>{pct(isR ? counts.reagents : counts.nonReagents)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {!readOnly ? (
        <Pressable onPress={onPreAnnotate} className="min-h-10 flex-row items-center justify-center gap-2 rounded-xs border border-hema bg-hema-soft px-3 web:hover:bg-sky-200">
          <Sparkles size={16} color={colors.hema} />
          <Text className="font-sans-semibold text-xs text-sky-700">Pré-marcar não reagentes (automático)</Text>
        </Pressable>
      ) : null}

      <View className="flex-row items-center justify-between rounded-xs border border-line bg-white p-3">
        <View>
          <Text className="font-sans text-[11px] text-ink-subtle">Total de núcleos marcados</Text>
          <Text className="font-mono-bold text-lg text-ink">
            {counts.total} <Text className="font-sans text-[10px] text-ink-subtle">/ meta: 500 células</Text>
          </Text>
        </View>
        <View className={`flex-row items-center gap-1 rounded-xs px-2 py-0.5 ${counts.total >= 500 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
          <CheckCircle2 size={14} color={counts.total >= 500 ? '#047857' : '#b45309'} />
          <Text className={`font-sans-semibold text-[11px] ${counts.total >= 500 ? 'text-emerald-800' : 'text-amber-900'}`}>
            {counts.total >= 500 ? 'Amostragem suficiente' : 'Contagem parcial'}
          </Text>
        </View>
      </View>

      <View>
        <View className="mb-1 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            <FileText size={14} color={colors.primary} />
            <Text className="font-sans-semibold text-xs text-ink">Observação clínica:</Text>
          </View>
          <Text className={`font-mono text-[10px] ${observation.length > 1900 ? 'font-mono-bold text-danger' : 'text-ink-subtle'}`}>{observation.length} / 2.000</Text>
        </View>
        <TextField
          multiline
          maxLength={2000}
          editable={!readOnly}
          value={observation}
          onChangeText={onObservation}
          placeholder="Notas sobre o hotspot, estroma, qualidade da lâmina ou exclusões..."
          accessibilityLabel="Observação clínica"
        />
      </View>

      <View className="flex-row items-center justify-between">
        <Pressable onPress={onHistory} className="min-h-11 flex-row items-center gap-1.5" accessibilityRole="button">
          <History size={14} color={colors.primary} />
          <Text className="font-sans-semibold text-xs text-primary">Histórico de versões (ver e restaurar)</Text>
        </Pressable>
        <Text className="font-mono text-[11px] text-ink-subtle">v{activeVersion} ativa</Text>
      </View>
    </View>
  );
}
