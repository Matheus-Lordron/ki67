import { router } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PageHeader, StatusDot } from '@/components/ui/Card';
import { Cell, DataTable } from '@/components/ui/DataTable';
import { Screen } from '@/components/ui/Screen';
import { ProjectPicker, useManagerScope } from '@/features/gestor/useManagerScope';
import { useRefreshOnFocus } from '@/features/sessao/useRefreshOnFocus';
import { useAppStore } from '@/state/appStore';
import type { Batch, User } from '@/types';

// Painel do gestor (RF-25): progresso por lote e por avaliador do projeto.
export default function ManagerDashboard() {
  useRefreshOnFocus();
  const { width } = useWindowDimensions();
  const { batches, images, analyses } = useManagerScope();
  const users = useAppStore((s) => s.users);

  const ready = images.filter((i) => i.status === 'pronta_para_validacao').length;
  const validated = images.filter((i) => i.status === 'validada').length;
  const inProgress = images.filter((i) => i.status === 'em_andamento').length;
  const pending = images.filter((i) => i.status === 'pendente').length;
  const completedTotal = ready + validated;
  const overallPct = images.length ? Math.round((completedTotal / images.length) * 100) : 0;

  const evaluatorIds = Array.from(new Set(images.flatMap((i) => i.assignedEvaluatorIds)));
  const evaluators = users.filter((u) => evaluatorIds.includes(u.id));

  const batchRows = batches.map((b) => {
    const imgs = images.filter((i) => i.batchId === b.id);
    const done = imgs.filter((i) => i.status === 'pronta_para_validacao' || i.status === 'validada').length;
    return {
      batch: b,
      total: imgs.length,
      done,
      pending: imgs.filter((i) => i.status === 'pendente').length,
      inProgress: imgs.filter((i) => i.status === 'em_andamento').length,
    };
  });

  const evaluatorRows = evaluators.map((u) => {
    const assigned = images.filter((i) => i.assignedEvaluatorIds.includes(u.id)).length;
    const mine = analyses.filter((a) => a.evaluatorId === u.id);
    const finalized = mine.filter((a) => a.status === 'finalizada').length;
    const inProg = mine.filter((a) => a.status === 'em_andamento').length;
    return { user: u, assigned, finalized, inProg, pending: Math.max(0, assigned - finalized - inProg) };
  });

  const desktop = width >= 900;

  return (
    <Screen maxWidth={1240}>
      <PageHeader
        title="Progresso"
        description="Acompanhe o andamento das análises do projeto."
        actions={
          <>
            <ProjectPicker />
            <Button label="Novo lote" onPress={() => router.push('/gestor/lotes')} />
          </>
        }
      />

      {/* Faixa de resumo unificada (Section - Resumo do progresso no Figma) */}
      <View className={`rounded-[14px] border border-line-card bg-white py-6 ${desktop ? 'flex-row items-stretch' : 'gap-5'}`}>
        <View className={`justify-center gap-2.5 px-7 ${desktop ? 'flex-[1.4]' : ''}`}>
          <View className="flex-row items-baseline justify-between gap-2">
            <Text className="font-sans-semibold text-[13px] text-ink-muted">Progresso geral</Text>
            <Text className="font-sans-semibold text-[13px] text-ink-muted">
              {completedTotal} de {images.length} {images.length === 1 ? 'imagem' : 'imagens'}
            </Text>
          </View>
          <Text className="font-sans-black text-[28px] leading-[32px] tracking-[-0.56px] text-ink">{overallPct}%</Text>
          <View className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <View style={{ width: `${overallPct}%` }} className="h-full rounded-full bg-primary" />
          </View>
        </View>

        <KpiCell title="Pendentes" value={pending} desktop={desktop} />
        <KpiCell title="Em andamento" value={inProgress} desktop={desktop} />
        <KpiCell title="Prontas p/ validação" value={ready} desktop={desktop} />
        <KpiCell title="Congeladas" value={validated} desktop={desktop} />
      </View>

      <View className="gap-6 pt-2">
        <SectionTitle title="Progresso por lote" linkLabel="Gerenciar lotes" onLink={() => router.push('/gestor/lotes')} />
        <DataTable<(typeof batchRows)[number]>
          rows={batchRows}
          keyOf={(r) => r.batch.id}
          empty="Nenhum lote neste projeto."
          columns={[
            { key: 'lote', title: 'Lote', width: 220, render: (r) => <Cell className="font-sans-bold text-[14px] text-ink">{r.batch.name}</Cell> },
            {
              key: 'n',
              title: 'Avaliadores por imagem',
              width: 140,
              render: (r: { batch: Batch }) => <Cell className="font-sans-semibold text-[14px] text-ink">{r.batch.evaluatorsPerImage}</Cell>,
            },
            { key: 'img', title: 'Imagens', width: 90, render: (r) => <Cell className="font-sans-semibold text-[14px] text-ink">{r.total}</Cell> },
            { key: 'pend', title: 'Pendentes', width: 100, render: (r) => <Cell className="font-sans-semibold text-[14px] text-ink">{r.pending}</Cell> },
            { key: 'and', title: 'Em andamento', width: 120, render: (r) => <Cell className="font-sans-semibold text-[14px] text-ink">{r.inProgress}</Cell> },
            {
              key: 'fin',
              title: 'Validadas',
              width: 120,
              render: (r) => <Cell className="font-sans-semibold text-[14px] text-ink">{`${r.done} de ${r.total}`}</Cell>,
            },
            {
              key: 'prog',
              title: 'Progresso',
              width: 180,
              render: (r) => {
                const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
                return (
                  <View className="w-full flex-row items-center gap-3">
                    <View className="h-2 min-w-[80px] flex-1 overflow-hidden rounded-full bg-line">
                      <View style={{ width: `${pct}%` }} className="h-full rounded-full bg-primary" />
                    </View>
                    <Text className="font-sans-bold text-[13px] text-ink">{pct}%</Text>
                  </View>
                );
              },
            },
          ]}
        />
      </View>

      <View className="gap-6 pt-2">
        <SectionTitle title="Desempenho por avaliador" linkLabel="Atribuir lotes" onLink={() => router.push('/gestor/atribuicao')} />
        <DataTable<(typeof evaluatorRows)[number]>
          rows={evaluatorRows}
          keyOf={(r) => r.user.id}
          empty="Nenhum avaliador atribuído ainda."
          columns={[
            {
              key: 'nome',
              title: 'Avaliador',
              width: 240,
              render: (r: { user: User }) => (
                <View className="gap-0.5">
                  <Cell className="font-sans-bold text-[14px] text-ink">{r.user.name}</Cell>
                  <Cell className="font-sans text-[13px] text-ink-muted">{r.user.email}</Cell>
                </View>
              ),
            },
            { key: 'inst', title: 'Instituição', width: 180, render: (r) => <Cell className="font-sans text-[14px] text-ink-muted">{r.user.institution || '—'}</Cell> },
            { key: 'atr', title: 'Atribuídas', width: 100, render: (r) => <Cell className="font-sans-semibold text-[14px] text-ink">{r.assigned}</Cell> },
            { key: 'pend', title: 'Pendentes', width: 100, render: (r) => <Cell className="font-sans-semibold text-[14px] text-ink">{r.pending}</Cell> },
            { key: 'and', title: 'Em andamento', width: 120, render: (r) => <Cell className="font-sans-semibold text-[14px] text-ink">{r.inProg}</Cell> },
            { key: 'fin', title: 'Finalizadas', width: 110, render: (r) => <Cell className="font-sans-semibold text-[14px] text-ink">{r.finalized}</Cell> },
            { key: 'st', title: 'Status', width: 110, render: (r) => <StatusDot label={r.user.isActive ? 'Ativo' : 'Inativo'} active={r.user.isActive} /> },
          ]}
        />
      </View>
    </Screen>
  );
}

function KpiCell({ title, value, desktop }: { title: string; value: number; desktop: boolean }) {
  return (
    <View
      className={`justify-center gap-2 px-7 ${
        desktop ? 'flex-1 border-l border-line py-2' : 'border-t border-line-soft pt-4'
      }`}
    >
      <Text className="font-sans-semibold text-[13px] text-ink-muted">{title}</Text>
      <Text className={`font-sans-black text-[28px] leading-[32px] tracking-[-0.56px] ${value > 0 ? 'text-ink' : 'text-ink-subtle'}`}>
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({ title, linkLabel, onLink }: { title: string; linkLabel: string; onLink: () => void }) {
  return (
    <View className="flex-row flex-wrap items-baseline justify-between gap-2">
      <Text className="font-sans-black text-[22px] leading-[26.4px] tracking-[-0.44px] text-ink">{title}</Text>
      <Pressable onPress={onLink} accessibilityRole="link" className="min-h-9 justify-center">
        <Text className="font-sans-bold text-[14px] text-primary">{linkLabel}</Text>
      </Pressable>
    </View>
  );
}
