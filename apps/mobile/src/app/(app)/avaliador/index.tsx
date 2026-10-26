import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowRight, CheckCircle, CheckCircle2, Clock, Layers, Microscope, Search, Tag } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, KeyValue, PageHeader } from '@/components/ui/Card';
import { Segmented, TextField } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { useRefreshOnFocus } from '@/features/sessao/useRefreshOnFocus';
import { useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';
import { formatKi67 } from '@/utils/ki67';

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Ainda não iniciado';

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
        title="Minha Fila de Anotação Ki-67"
        badge="PROTOCOLO CEGO ATIVO"
        description="Quantificação nuclear de proliferação celular. Cada análise fica isolada até a comparação das N análises."
        actions={
          <View className="flex-row gap-4 border-l border-surface-alt pl-4">
            <View className="items-end">
              <Text className="font-mono text-[11px] uppercase text-ink-subtle">Pendentes</Text>
              <Text className="font-mono-bold text-lg text-primary">{pending.length}</Text>
            </View>
            <View className="items-end">
              <Text className="font-mono text-[11px] uppercase text-ink-subtle">Avaliadas</Text>
              <Text className="font-mono-bold text-lg text-emerald-700">{evaluated.length}</Text>
            </View>
          </View>
        }
      />

      <View className="gap-3 border-b border-line pb-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pendentes', label: `Pendentes (${pending.length})`, icon: Clock },
            { value: 'avaliadas', label: `Avaliadas (${evaluated.length})`, icon: CheckCircle2 },
          ]}
        />
        <View className="flex-row items-center gap-2 sm:w-[420px]">
          <View className="flex-1">
            <TextField icon={Search} value={search} onChangeText={setSearch} placeholder="Buscar por código ou lote..." />
          </View>
          <Select
            compact
            value={batch}
            onChange={setBatch}
            options={[{ value: 'all', label: 'Todos os lotes' }, ...batches.map(([id, name]) => ({ value: id, label: name }))]}
          />
        </View>
      </View>

      {shown.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={tab === 'pendentes' ? 'Nenhuma imagem pendente no momento' : 'Nenhuma imagem avaliada ainda'}
          description={
            tab === 'pendentes'
              ? 'Você concluiu todas as análises atribuídas. Novos lotes aparecem aqui quando o gestor atribuir.'
              : 'Ao finalizar uma análise na tela de anotação, ela fica arquivada nesta aba para consulta.'
          }
        />
      ) : (
        <Grid>
          {shown.map((img) => {
            const analysis = analysisOf(img.id);
            const finalized = analysis?.status === 'finalizada';
            const started = !!analysis;
            return (
              <Card key={img.id} className="h-full justify-between p-4">
                <View>
                  <View className="mb-2 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1.5">
                      <Tag size={14} color={colors.primary} />
                      <Text className="font-mono-bold text-sm text-primary">{img.code}</Text>
                    </View>
                    {finalized ? (
                      <Badge label="Finalizada" tone="success" icon={CheckCircle} />
                    ) : started ? (
                      <Badge label="Em andamento" tone="warning" icon={Clock} />
                    ) : (
                      <Badge label="Pendente" tone="neutral" />
                    )}
                  </View>
                  <Text numberOfLines={1} className="font-sans-semibold text-xs text-ink">{img.batchName}</Text>
                  <Text numberOfLines={1} className="mb-3 font-sans text-[11px] text-ink-subtle">{img.organ}</Text>
                  <View className="relative mb-3 h-32 overflow-hidden rounded-xs border border-line bg-slate-800">
                    <Image source={{ uri: img.imageUrl }} contentFit="cover" cachePolicy="none" style={{ width: '100%', height: '100%', opacity: 0.9 }} />
                    <View className="absolute bottom-1.5 right-1.5 rounded-xs bg-ink/80 px-1.5 py-0.5">
                      <Text className="font-mono text-[10px] text-white">{img.opticalMagnification}</Text>
                    </View>
                  </View>
                  <View className="mb-3 gap-1">
                    <KeyValue label="Núcleos anotados:" value={analysis ? `${analysis.marks.length} núcleos` : '0 núcleos (novo)'} />
                    <KeyValue label="Último salvamento:" value={fmtDate(analysis?.lastSavedAt)} />
                    {finalized ? <KeyValue label="Índice Ki-67:" value={formatKi67(analysis?.history[0]?.ki67Index)} valueClassName="text-primary" /> : null}
                  </View>
                </View>
                <Button
                  label={finalized ? 'Visualizar Análise Finalizada' : started ? 'Continuar Anotação' : 'Iniciar Anotação'}
                  icon={Microscope}
                  iconRight={ArrowRight}
                  onPress={() => open(img.id, finalized)}
                />
              </Card>
            );
          })}
        </Grid>
      )}
    </Screen>
  );
}
