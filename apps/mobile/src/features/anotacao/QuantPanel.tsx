import { History, Sparkles } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { TextField } from '@/components/ui/Field';
import type { SaveStatus } from '@/state/editorStore';
import { colors } from '@/theme/colors';
import type { MarkLabel } from '@/types';

export function SaveIndicator({ status, version, offline }: { status: SaveStatus; version: number; offline: boolean }) {
  const text = status === 'saved' ? `Salvo · versão ${version}` : status === 'saving' ? 'Salvando…' : offline ? 'Não salvo · sem conexão' : 'Não salvo';
  const dot = status === 'saved' ? colors.success : status === 'saving' ? colors.warning : colors.danger;
  return (
    <View accessibilityLiveRegion="polite" className="flex-row items-center gap-1.5">
      <View style={{ backgroundColor: dot }} className="h-1.5 w-1.5 rounded-full" />
      <Text className="font-sans text-xs text-ink-muted">{text}</Text>
    </View>
  );
}

export const CLASSES: { label: MarkLabel; name: string; key: string; color: string }[] = [
  { label: 'reagente', name: 'Reagente', key: '1', color: colors.dab },
  { label: 'nao_reagente', name: 'Não reagente', key: '2', color: colors.hema },
];

/** Marca da classe: cheia para reagente, só contorno para não reagente (igual ao canvas). */
export function ClassSwatch({ label, size = 10 }: { label: MarkLabel; size?: number }) {
  const reagent = label === 'reagente';
  return (
    <View
      style={{ width: size, height: size, borderColor: reagent ? colors.dab : colors.hema, backgroundColor: reagent ? colors.dab : 'transparent' }}
      className="rounded-full border-2"
    />
  );
}

interface QuantPanelProps {
  counts: { reagents: number; nonReagents: number; total: number };
  activeLabel: MarkLabel;
  onLabel: (label: MarkLabel) => void;
  onPreAnnotate: () => void;
  observation: string;
  onObservation: (text: string) => void;
  activeVersion: number;
  onHistory: () => void;
  readOnly?: boolean;
}

/** Painel da anotação: classe ativa com a contagem de cada uma, pré-marcação e observação. */
export function QuantPanel({ counts, activeLabel, onLabel, onPreAnnotate, observation, onObservation, activeVersion, onHistory, readOnly }: QuantPanelProps) {
  return (
    <View className="gap-6">
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="font-sans-medium text-[13px] text-ink">Classe</Text>
          <Text className="font-sans text-xs text-ink-subtle">teclas 1 e 2</Text>
        </View>
        <View accessibilityRole="radiogroup" className="overflow-hidden rounded-xs border border-line">
          {CLASSES.map((c, i) => {
            const active = activeLabel === c.label;
            const n = c.label === 'reagente' ? counts.reagents : counts.nonReagents;
            return (
              <Pressable
                key={c.label}
                onPress={() => onLabel(c.label)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${c.name}: ${n} marcados`}
                className={`min-h-12 flex-row items-center gap-3 px-3 ${i > 0 ? 'border-t border-line' : ''} ${active ? 'bg-surface' : 'bg-white web:hover:bg-surface'}`}
              >
                <View style={{ backgroundColor: active ? c.color : 'transparent' }} className="h-6 w-0.5" />
                <ClassSwatch label={c.label} size={12} />
                <Text className={`flex-1 text-[13px] ${active ? 'font-sans-medium text-ink' : 'font-sans text-ink-muted'}`}>{c.name}</Text>
                <Text className="font-mono text-xs text-ink-subtle">{c.key}</Text>
                <Text accessibilityLiveRegion="polite" className="w-14 text-right font-mono text-lg text-ink">{n}</Text>
              </Pressable>
            );
          })}
          <View className="flex-row items-center justify-between border-t border-line bg-surface px-3 py-2">
            <Text className="font-sans text-[13px] text-ink-muted">Total marcado</Text>
            <Text className="font-mono text-[13px] text-ink">{counts.total}</Text>
          </View>
        </View>
      </View>

      {!readOnly ? (
        <Pressable onPress={onPreAnnotate} accessibilityRole="button" className="min-h-10 flex-row items-center gap-2 self-start rounded-xs border border-line px-3 web:hover:bg-surface">
          <Sparkles size={14} color={colors.inkMuted} />
          <Text className="font-sans text-[13px] text-ink">Sugerir não reagentes</Text>
        </Pressable>
      ) : null}

      <View>
        <View className="mb-1.5 flex-row items-center justify-between">
          <Text className="font-sans-medium text-[13px] text-ink">Observação</Text>
          <Text className={`font-mono text-[11px] ${observation.length > 1900 ? 'text-danger' : 'text-ink-subtle'}`}>{observation.length}/2000</Text>
        </View>
        <TextField
          multiline
          maxLength={2000}
          editable={!readOnly}
          value={observation}
          onChangeText={onObservation}
          placeholder="Campo escolhido, qualidade da lâmina, o que foi excluído da contagem…"
          accessibilityLabel="Observação"
        />
      </View>

      <Pressable onPress={onHistory} className="min-h-11 flex-row items-center justify-between border-t border-line pt-3" accessibilityRole="button">
        <View className="flex-row items-center gap-1.5">
          <History size={14} color={colors.inkMuted} />
          <Text className="font-sans text-[13px] text-ink underline">Versões salvas</Text>
        </View>
        <Text className="font-mono text-xs text-ink-subtle">atual: {activeVersion}</Text>
      </Pressable>
    </View>
  );
}
