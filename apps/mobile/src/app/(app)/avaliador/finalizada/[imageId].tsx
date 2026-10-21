import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, History } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { KeyValue } from '@/components/ui/Card';
import { isDemo } from '@/data/mode';
import * as repo from '@/data/repo';
import { ClassSwatch } from '@/features/anotacao/QuantPanel';
import { SlideView } from '@/features/anotacao/SlideView';
import { useImageUrl } from '@/features/anotacao/useImageUrl';
import { VersionHistoryDialog } from '@/features/anotacao/VersionHistoryDialog';
import { useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';
import { countMarks } from '@/utils/ki67';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

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
  const wide = width >= 1024;

  const info = (
    <View className="gap-6">
      <View className="gap-0.5">
        <Text className="font-mono text-base text-ink">{image.code}</Text>
        <Text className="font-sans text-[13px] text-ink-muted">{image.organ}</Text>
        <Text className="font-sans text-xs text-ink-subtle">Finalizada em {fmt(analysis.finalizedAt)}</Text>
      </View>

      <View className="overflow-hidden rounded-xs border border-line">
        {([['reagente', 'Reagentes', counts.reagents], ['nao_reagente', 'Não reagentes', counts.nonReagents]] as const).map(([label, name, n], i) => (
          <View key={label} className={`min-h-11 flex-row items-center gap-3 px-3 ${i ? 'border-t border-line' : ''}`}>
            <ClassSwatch label={label} size={12} />
            <Text className="flex-1 font-sans text-[13px] text-ink">{name}</Text>
            <Text className="font-mono text-lg text-ink">{n}</Text>
          </View>
        ))}
        <View className="border-t border-line bg-surface px-3 py-2">
          <KeyValue label="Total marcado" value={counts.total} />
        </View>
      </View>

      <View className="gap-1.5">
        <Text className="font-sans-medium text-[13px] text-ink">Observação</Text>
        <Text className="font-sans text-[13px] leading-5 text-ink-muted">{analysis.observation || 'Sem observação.'}</Text>
      </View>

      <View className="gap-2 border-t border-line pt-4">
        <Button label="Ver versões salvas" icon={History} variant="outline" onPress={() => setHistoryOpen(true)} />
        <Button label="Voltar para minhas imagens" onPress={() => router.replace('/avaliador')} />
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-4 py-2 lg:px-6">
        <Pressable onPress={() => router.replace('/avaliador')} className="min-h-11 flex-row items-center gap-1.5">
          <ArrowLeft size={16} color={colors.ink} />
          <Text className="font-sans text-[13px] text-ink">Minhas imagens</Text>
        </Pressable>
        <Text className="font-sans text-xs text-ink-subtle">Somente leitura · {analysis.marks.length} marcações travadas</Text>
      </View>

      <View className={`flex-1 ${wide ? 'flex-row' : ''}`}>
        <View className={`bg-[#2a2b2e] ${wide ? 'flex-1' : 'h-80'}`}>
          <SlideView uri={imageUri ?? image.imageUrl} imageWidth={image.width} imageHeight={image.height} layers={[{ marks: analysis.marks }]} className="flex-1" />
        </View>
        <ScrollView className={wide ? 'w-80 flex-none border-l border-line bg-white' : 'flex-1 bg-white'} contentContainerClassName="p-5">
          {info}
        </ScrollView>
      </View>

      <VersionHistoryDialog visible={historyOpen} onClose={() => setHistoryOpen(false)} history={analysis.history} canRestore={false} onRestore={async () => false} />
    </View>
  );
}
