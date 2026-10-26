import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, History, Lock, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { KeyValue } from '@/components/ui/Card';
import { StratBadge } from '@/features/anotacao/QuantPanel';
import { isDemo } from '@/data/mode';
import * as repo from '@/data/repo';
import { SlideView } from '@/features/anotacao/SlideView';
import { useImageUrl } from '@/features/anotacao/useImageUrl';
import { VersionHistoryDialog } from '@/features/anotacao/VersionHistoryDialog';
import { useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';
import { calculateKi67Index, countMarks, formatKi67 } from '@/utils/ki67';

// Análise finalizada em modo somente leitura (RF-24).
export default function FinalizedReadOnlyView() {
  const { imageId } = useLocalSearchParams<{ imageId: string }>();
  const { width } = useWindowDimensions();
  const image = useAppStore((s) => s.images.find((i) => i.id === imageId));
  const analysis = useAppStore((s) => s.analyses.find((a) => a.imageId === imageId && a.evaluatorId === s.currentUser?.id));
  const [historyOpen, setHistoryOpen] = useState(false);

  const imageUri = useImageUrl(imageId, image?.imageUrl);

  useEffect(() => {
    if (imageId) useAppStore.getState().setLastAnnotationImage(imageId);
  }, [imageId]);

  // Modo real: o histórico vem do servidor na primeira vez que a tela abre.
  const analysisId = analysis?.id;
  const needsHistory = !isDemo && !!analysisId && !analysis?.history.length;
  useEffect(() => {
    if (!needsHistory || !analysisId) return;
    repo.loadHistory(analysisId).then((history) =>
      useAppStore.setState((s) => ({ analyses: s.analyses.map((a) => (a.id === analysisId ? { ...a, history } : a)) })),
    ).catch(() => undefined);
  }, [needsHistory, analysisId]);

  if (!image || !analysis) return <Redirect href="/avaliador" />;
  if (analysis.status !== 'finalizada') return <Redirect href={`/avaliador/anotacao/${image.id}`} />;

  const counts = countMarks(analysis.marks);
  const ki67 = analysis.history[0]?.ki67Index ?? calculateKi67Index(counts.reagents, counts.nonReagents);
  const wide = width >= 1024;

  const info = (
    <View className="gap-4">
      <View>
        <Text className="font-mono text-[10px] uppercase text-ink-subtle">Identificação da amostra</Text>
        <Text className="font-mono-bold text-lg text-primary">{image.code}</Text>
        <Text className="font-sans text-xs text-ink-muted">{image.organ}</Text>
      </View>
      <View className="gap-1 rounded-xs border border-line bg-surface-alt p-4">
        <Text className="font-mono text-[10px] uppercase text-ink-subtle">Índice final</Text>
        <Text className="font-mono-bold text-3xl text-primary">{formatKi67(ki67)}</Text>
        <StratBadge index={ki67} />
      </View>
      <View className="gap-2 rounded-xs border border-surface-alt bg-white p-3">
        <KeyValue label="● Reagentes (DAB):" value={counts.reagents} valueClassName="text-warn" />
        <KeyValue label="○ Não reagentes (HEM):" value={counts.nonReagents} valueClassName="text-sky-700" />
        <View className="border-t border-surface-alt pt-1">
          <KeyValue label="Total de células:" value={counts.total} />
        </View>
      </View>
      <View>
        <Text className="mb-1 font-sans-semibold text-[11px] text-ink">Observação clínica registrada:</Text>
        <Text className="rounded-xs border border-line bg-surface p-2.5 font-sans text-xs italic text-ink-muted">“{analysis.observation || 'Sem observações registradas.'}”</Text>
      </View>
      <View className="gap-2 border-t border-line pt-4">
        <Button label="Ver histórico de versões" icon={History} variant="outline" onPress={() => setHistoryOpen(true)} />
        <Button label="Voltar à fila de imagens" onPress={() => router.replace('/avaliador')} />
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-emerald-300 bg-emerald-50 px-6 py-2.5">
        <View className="flex-shrink flex-row flex-wrap items-center gap-2">
          <ShieldCheck size={20} color="#047857" />
          <Text className="font-sans-bold text-sm text-emerald-900">Análise finalizada (somente leitura)</Text>
          <Text className="font-mono text-xs text-emerald-700">· enviada em {analysis.finalizedAt ? new Date(analysis.finalizedAt).toLocaleString('pt-BR') : '—'}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text numberOfLines={1} className="max-w-[220px] rounded-xs border border-emerald-300 bg-white px-2 py-0.5 font-mono text-[11px] text-ink">
            SHA-256: {analysis.hashSHA256}
          </Text>
          <Pressable onPress={() => router.replace('/avaliador')} className="min-h-11 flex-row items-center gap-1">
            <ArrowLeft size={16} color={colors.primary} />
            <Text className="font-sans-semibold text-xs text-primary">Voltar para lista</Text>
          </Pressable>
        </View>
      </View>

      <View className={`flex-1 ${wide ? 'flex-row' : ''}`}>
        <View className={`items-center justify-center bg-slate-900 p-4 ${wide ? 'flex-1' : 'h-80'}`}>
          <View className="relative h-full w-full max-w-4xl overflow-hidden rounded-xs border border-slate-700">
            <SlideView uri={imageUri ?? image.imageUrl} imageWidth={image.width} imageHeight={image.height} layers={[{ marks: analysis.marks }]} className="flex-1" />
            <View className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-xs border border-slate-700 bg-slate-950/80 px-2 py-1">
              <Lock size={14} color="#34d399" />
              <Text className="font-mono text-xs text-white">Lâmina bloqueada · {analysis.marks.length} marcações seladas</Text>
            </View>
          </View>
        </View>
        {wide ? (
          <ScrollView className="w-80 flex-none border-l border-line bg-white" contentContainerClassName="p-5">
            {info}
          </ScrollView>
        ) : (
          <ScrollView className="flex-1 bg-white" contentContainerClassName="p-5">
            {info}
          </ScrollView>
        )}
      </View>

      <VersionHistoryDialog visible={historyOpen} onClose={() => setHistoryOpen(false)} history={analysis.history} canRestore={false} onRestore={async () => false} />
    </View>
  );
}
