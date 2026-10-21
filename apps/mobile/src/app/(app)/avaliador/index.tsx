import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge, EmptyState, PageHeader } from '@/components/ui/Card';
import { Segmented, TextField } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { useRefreshOnFocus } from '@/features/sessao/useRefreshOnFocus';
import { useAppStore } from '@/state/appStore';
import { countMarks } from '@/utils/ki67';

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null);

// Abas Pendentes e Avaliadas (RF-22, RF-24). Só aparecem imagens atribuídas ao usuário (RN-03).
export default function EvaluatorHome() {
  useRefreshOnFocus();
  const user = useAppStore((s) => s.currentUser);
  const images = useAppStore((s) => s.images);
  const analyses = useAppStore((s) => s.analyses);
  const [tab, setTab] = useState<'pendentes' | 'avaliadas'>('pendentes');
  const [search, setSearch] = useState('');
  const [batch, setBatch] = useState<string>('all');

  const mine = useMemo(() => images.filter((img) => img.assignedEvaluatorIds.includes(user?.id ?? '')), [images, user]);
  const analysisOf = (imageId: string) => analyses.find((a) => a.imageId === imageId && a.evaluatorId === user?.id);
  const pending = mine.filter((img) => analysisOf(img.id)?.status !== 'finalizada');
  const evaluated = mine.filter((img) => analysisOf(img.id)?.status === 'finalizada');
  const term = search.trim().toLowerCase();
  const shown = (tab === 'pendentes' ? pending : evaluated).filter(
    (img) =>
      (batch === 'all' || img.batchId === batch) &&
      (!term || [img.code, img.organ, img.batchName].some((t) => t.toLowerCase().includes(term))),
  );
  const batches = Array.from(new Map(mine.map((i) => [i.batchId, i.batchName])).entries());

  const open = (imageId: string, finalized: boolean) => {
    useAppStore.getState().setLastAnnotationImage(imageId);
    router.push(finalized ? `/avaliador/finalizada/${imageId}` : `/avaliador/anotacao/${imageId}`);
  };

  return (
    <Screen>
      <PageHeader
        title="Minhas imagens"
        description={`${pending.length} para anotar e ${evaluated.length} finalizadas. Você não vê as marcações dos outros avaliadores.`}
      />

      <View className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pendentes', label: `Para anotar (${pending.length})` },
            { value: 'avaliadas', label: `Finalizadas (${evaluated.length})` },
          ]}
        />
        <View className="flex-row items-center gap-2 sm:w-[420px]">
          <View className="flex-1">
            <TextField icon={Search} value={search} onChangeText={setSearch} placeholder="Buscar código ou lote" accessibilityLabel="Buscar" />
          </View>
          <Select
            compact
            label={undefined}
            value={batch}
            onChange={setBatch}
            options={[{ value: 'all', label: 'Todos os lotes' }, ...batches.map(([id, name]) => ({ value: id, label: name }))]}
          />
        </View>
      </View>

      {shown.length === 0 ? (
        <EmptyState
          title={tab === 'pendentes' ? 'Nada para anotar agora' : 'Nenhuma análise finalizada ainda'}
          description={
            tab === 'pendentes'
              ? 'Quando o gestor atribuir novas imagens a você, elas aparecem aqui.'
              : 'As análises que você finalizar ficam aqui para consulta, sem edição.'
          }
        />
      ) : (
        <Grid cols={{ base: 1, sm: 2, lg: 3 }}>
          {shown.map((img) => {
            const analysis = analysisOf(img.id);
            const finalized = analysis?.status === 'finalizada';
            const started = !!analysis;
            const c = countMarks(analysis?.marks ?? []);
            const saved = fmtDate(analysis?.lastSavedAt);
            return (
              <Pressable
                key={img.id}
                onPress={() => open(img.id, finalized)}
                accessibilityRole="button"
                accessibilityLabel={`${img.code}, ${finalized ? 'finalizada' : started ? 'em andamento' : 'não iniciada'}`}
                className="h-full overflow-hidden rounded-xs border border-line bg-white web:hover:border-ink-subtle"
              >
                <View className="h-36 bg-[#2a2b2e]">
                  <Image source={{ uri: img.imageUrl }} contentFit="cover" cachePolicy="none" style={{ width: '100%', height: '100%' }} />
                </View>
                <View className="gap-2 p-4">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="font-mono text-[13px] text-ink">{img.code}</Text>
                    {finalized ? <Badge label="Finalizada" tone="success" /> : started ? <Badge label="Em andamento" tone="warning" /> : <Badge label="Não iniciada" tone="neutral" />}
                  </View>
                  <View>
                    <Text numberOfLines={1} className="font-sans text-[13px] text-ink">{img.organ}</Text>
                    <Text numberOfLines={1} className="font-sans text-xs text-ink-subtle">{img.batchName} · {img.opticalMagnification}</Text>
                  </View>
                  <View className="flex-row items-center justify-between border-t border-line pt-2">
                    <Text className="font-sans text-xs text-ink-muted">
                      {started ? (
                        <>
                          <Text className="font-mono text-ink">{c.reagents}</Text> reag. · <Text className="font-mono text-ink">{c.nonReagents}</Text> não reag.
                        </>
                      ) : (
                        'Nenhuma marcação'
                      )}
                    </Text>
                    {saved ? <Text className="font-sans text-xs text-ink-subtle">{saved}</Text> : null}
                  </View>
                  <Text className="font-sans-medium text-[13px] text-ink underline">{finalized ? 'Ver análise' : started ? 'Continuar' : 'Começar'}</Text>
                </View>
              </Pressable>
            );
          })}
        </Grid>
      )}
    </Screen>
  );
}
