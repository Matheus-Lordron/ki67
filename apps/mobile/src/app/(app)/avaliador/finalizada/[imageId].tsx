import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, KeyValue } from '@/components/ui/Card';
import { isDemo } from '@/data/mode';
import * as repo from '@/data/repo';
import { StratBadge } from '@/features/anotacao/QuantPanel';
import { SlideView } from '@/features/anotacao/SlideView';
import { useImageUrl } from '@/features/anotacao/useImageUrl';
import { VersionHistoryDialog } from '@/features/anotacao/VersionHistoryDialog';
import { useAppStore } from '@/state/appStore';
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

  const analysisId = analysis?.id;
  const needsHistory = !isDemo && !!analysisId && !analysis?.history.length;
  useEffect(() => {
    if (!needsHistory || !analysisId) return;
    repo
      .loadHistory(analysisId)
      .then((history) =>
        useAppStore.setState((s) => ({ analyses: s.analyses.map((a) => (a.id === analysisId ? { ...a, history } : a)) })),
      )
      .catch(() => undefined);
  }, [needsHistory, analysisId]);

  if (!image || !analysis) return <Redirect href="/avaliador" />;
  if (analysis.status !== 'finalizada') return <Redirect href={`/avaliador/anotacao/${image.id}`} />;

  const counts = countMarks(analysis.marks);
  const ki67 = analysis.history[0]?.ki67Index ?? calculateKi67Index(counts.reagents, counts.nonReagents);
  const wide = width >= 1024;

  const info = (
    <View className="gap-5">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans-black text-[20px] text-ink">{image.code}</Text>
        <Badge label="Finalizada" tone="primary" dot="solid" />
      </View>

      <Text className="font-sans text-[13px] text-ink-muted">
        {image.batchName} · {image.organ}
      </Text>

      <View className="gap-2 rounded-[12px] border border-line bg-surface-subtle p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-sans-semibold text-[12px] text-ink-muted">Índice Ki-67 final</Text>
          <StratBadge index={ki67} />
        </View>
        <Text className="font-sans-black text-[30px] leading-[34px] text-ink">{formatKi67(ki67)}</Text>
      </View>

      <View>
        <KeyValue label="Reagentes" value={counts.reagents} bordered />
        <KeyValue label="Não reagentes" value={counts.nonReagents} bordered />
        <KeyValue label="Total de núcleos" value={counts.total} />
      </View>

      <View className="gap-1.5">
        <Text className="font-sans-semibold text-[13px] text-ink">Observação clínica</Text>
        <View className="rounded-[10px] border border-line bg-surface-subtle p-3">
          <Text className="font-sans text-[13px] italic text-ink-muted">
            “{analysis.observation || 'Sem observações registradas.'}”
          </Text>
        </View>
      </View>

      <View className="gap-1">
        <Text className="font-sans text-[12px] text-ink-muted">
          Enviada em {analysis.finalizedAt ? new Date(analysis.finalizedAt).toLocaleString('pt-BR') : '—'}
        </Text>
        <Text numberOfLines={1} className="font-mono text-[11px] text-ink-subtle">
          SHA-256: {analysis.hashSHA256}
        </Text>
      </View>

      <View className="gap-2.5 border-t border-line-soft pt-4">
        <Button label="Histórico de versões" variant="outline" className="w-full" onPress={() => setHistoryOpen(true)} />
        <Button label="Voltar para minha fila" className="w-full" onPress={() => router.replace('/avaliador')} />
      </View>
    </View>
  );

  return (
    <View className={`flex-1 bg-surface-canvas ${wide ? 'flex-row' : ''}`}>
      <View className={`relative items-center justify-center p-4 ${wide ? 'flex-1' : 'h-80'}`}>
        <View className="relative h-full w-full overflow-hidden rounded-[12px]">
          <SlideView
            uri={imageUri ?? image.imageUrl}
            imageWidth={image.width}
            imageHeight={image.height}
            layers={[{ marks: analysis.marks }]}
            className="flex-1 bg-surface-canvas"
          />
        </View>
        <View className="absolute left-6 top-5 rounded-full bg-black/55 px-3.5 py-1.5">
          <Text className="font-sans-semibold text-[12px] text-white">
            Amostra {image.code} · Somente leitura ({analysis.marks.length} marcações)
          </Text>
        </View>
      </View>

      {wide ? (
        <ScrollView className="w-[320px] flex-none border-l border-line bg-white" contentContainerClassName="p-6">
          {info}
        </ScrollView>
      ) : (
        <ScrollView className="flex-1 bg-white" contentContainerClassName="p-6">
          {info}
        </ScrollView>
      )}

      <VersionHistoryDialog
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={analysis.history}
        canRestore={false}
        onRestore={async () => false}
      />
    </View>
  );
}
