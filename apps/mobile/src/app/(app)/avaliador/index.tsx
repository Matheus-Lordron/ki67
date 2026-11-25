import { router } from 'expo-router';
import { Layers, Search } from 'lucide-react-native';
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
import { formatKi67 } from '@/utils/ki67';

const fmtDate = (iso?: string) =>
  iso
    ? `${new Date(iso).toLocaleDateString('pt-BR')}, ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Ainda não iniciado';

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
    <Screen maxWidth={1160}>
      <PageHeader
        title="Minha fila"
        description="Lâminas atribuídas a você. Cada análise fica isolada até a comparação."
      />

      <View className="flex-row flex-wrap items-center justify-between gap-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pendentes', label: 'Pendentes', count: pending.length },
            { value: 'avaliadas', label: 'Avaliadas', count: evaluated.length },
          ]}
        />

        <View className="flex-row flex-wrap items-center gap-3">
          <View className="w-[260px] sm:w-[300px]">
            <TextField icon={Search} value={search} onChangeText={setSearch} placeholder="Código ou lote" />
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
          title={tab === 'pendentes' ? 'Nenhuma lâmina pendente no momento' : 'Nenhuma lâmina avaliada ainda'}
          description={
            tab === 'pendentes'
              ? 'Você concluiu todas as análises atribuídas. Novos lotes aparecerão aqui quando atribuídos pelo gestor.'
              : 'Ao finalizar uma análise na tela de anotação, ela fica disponível nesta aba para consulta.'
          }
        />
      ) : (
        <Grid cols={{ base: 1, md: 2, lg: 3 }} gap={20}>
          {shown.map((img) => {
            const analysis = analysisOf(img.id);
            const finalized = analysis?.status === 'finalizada';
            const started = !!analysis;
            return (
              <Card key={img.id} className="h-full justify-between gap-5 p-7">
                <View className="gap-5">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1 gap-1">
                      <Text className="font-sans-black text-[22px] leading-[26.4px] tracking-[-0.44px] text-ink">
                        {img.code}
                      </Text>
                      <Text numberOfLines={1} className="font-sans text-[14px] text-ink-muted">
                        {img.batchName}
                      </Text>
                    </View>
                    {finalized ? (
                      <Badge label="Finalizada" tone="primary" dot="solid" />
                    ) : started ? (
                      <Badge label="Em andamento" tone="warning" dot="hollow" />
                    ) : (
                      <Badge label="Pendente" tone="warning" dot="hollow" />
                    )}
                  </View>

                  <View>
                    <KeyValue label="Núcleos anotados" value={analysis ? analysis.marks.length : 0} bordered />
                    <KeyValue label="Último salvamento" value={fmtDate(analysis?.lastSavedAt)} bordered={finalized} />
                    {finalized ? <KeyValue label="Índice Ki-67" value={formatKi67(analysis?.history[0]?.ki67Index)} /> : null}
                  </View>
                </View>

                <Button
                  label={finalized ? 'Ver análise finalizada' : started ? 'Continuar anotação' : 'Iniciar anotação'}
                  className="w-full"
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
