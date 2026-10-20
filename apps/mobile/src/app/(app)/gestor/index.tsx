import { router } from 'expo-router';
import { ArrowRight, FolderKanban, Plus, Users } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, Card, PageHeader } from '@/components/ui/Card';
import { Cell, DataTable } from '@/components/ui/DataTable';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { ProjectPicker, useManagerScope } from '@/features/gestor/useManagerScope';
import { useRefreshOnFocus } from '@/features/sessao/useRefreshOnFocus';
import { useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';
import type { Batch, User } from '@/types';

// Painel do gestor (RF-25): progresso por lote e por avaliador do projeto.
export default function ManagerDashboard() {
  useRefreshOnFocus();
  const { batches, images, analyses } = useManagerScope();
  const users = useAppStore((s) => s.users);

  const ready = images.filter((i) => i.status === 'pronta_para_validacao').length;
  const validated = images.filter((i) => i.status === 'validada').length;
  const inProgress = images.filter((i) => i.status === 'em_andamento').length;
  const pending = images.filter((i) => i.status === 'pendente').length;
  const evaluatorIds = Array.from(new Set(images.flatMap((i) => i.assignedEvaluatorIds)));
  const evaluators = users.filter((u) => evaluatorIds.includes(u.id));

  const batchRows = batches.map((b) => {
    const imgs = images.filter((i) => i.batchId === b.id);
    const done = imgs.filter((i) => i.status === 'pronta_para_validacao' || i.status === 'validada').length;
    return { batch: b, total: imgs.length, done, pending: imgs.filter((i) => i.status === 'pendente').length, inProgress: imgs.filter((i) => i.status === 'em_andamento').length };
  });

  const evaluatorRows = evaluators.map((u) => {
    const assigned = images.filter((i) => i.assignedEvaluatorIds.includes(u.id)).length;
    const mine = analyses.filter((a) => a.evaluatorId === u.id);
    const finalized = mine.filter((a) => a.status === 'finalizada').length;
    const inProg = mine.filter((a) => a.status === 'em_andamento').length;
    return { user: u, assigned, finalized, inProg, pending: Math.max(0, assigned - finalized - inProg) };
  });

  return (
    <Screen>
      <PageHeader
        title="Dashboard de Progresso do Gestor"
        badge="SUPERVISÃO DO PROJETO"
        description={<ProjectPicker />}
        actions={<Button label="Criar Lote / Upload Imagens" icon={Plus} onPress={() => router.push('/gestor/lotes')} />}
      />

      <Grid cols={{ base: 2, lg: 4 }}>
        <Kpi title="Total de imagens" value={images.length} note={`Distribuídas em ${batches.length} lotes`} />
        <Kpi title="Prontas para validação" value={ready} note={`${validated} resultados já congelados`} tone="primary" />
        <Kpi title="Em andamento" value={inProgress} note="Marcações em execução" tone="warning" />
        <Kpi title="Pendentes de início" value={pending} note="Aguardando avaliadores" />
      </Grid>

      <Card className="gap-4">
        <SectionTitle icon={FolderKanban} title="Progresso por lote" linkLabel="Gerenciar lotes" onLink={() => router.push('/gestor/lotes')} />
        <DataTable<(typeof batchRows)[number]>
          rows={batchRows}
          keyOf={(r) => r.batch.id}
          empty="Nenhum lote neste projeto."
          columns={[
            { key: 'lote', title: 'Lote', width: 260, render: (r) => <Cell className="font-sans-semibold text-xs text-primary">{r.batch.name}</Cell> },
            { key: 'n', title: 'N (aval./img)', width: 100, render: (r: { batch: Batch }) => <Cell className="font-mono-bold text-xs text-ink">{r.batch.evaluatorsPerImage}</Cell> },
            { key: 'img', title: 'Imagens', width: 80, render: (r) => <Cell className="font-mono text-xs text-ink">{r.total}</Cell> },
            { key: 'pend', title: 'Pendentes', width: 90, render: (r) => <Cell className="font-mono text-xs text-slate-500">{r.pending}</Cell> },
            { key: 'and', title: 'Em andamento', width: 110, render: (r) => <Cell className="font-mono-bold text-xs text-amber-800">{r.inProgress}</Cell> },
            { key: 'fin', title: 'Prontas / validadas', width: 140, render: (r) => <Cell className="font-mono-bold text-xs text-emerald-700">{`${r.done} / ${r.total}`}</Cell> },
            {
              key: 'prog',
              title: 'Progresso geral',
              width: 170,
              render: (r) => {
                const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
                return (
                  <View className="flex-row items-center gap-2">
                    <View className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                      <View style={{ width: `${pct}%` }} className="h-full bg-primary" />
                    </View>
                    <Text className="font-mono text-[11px] text-ink">{pct}%</Text>
                  </View>
                );
              },
            },
          ]}
        />
      </Card>

      <Card className="gap-4">
        <SectionTitle icon={Users} title="Desempenho por avaliador" linkLabel="Atribuir lotes/imagens" onLink={() => router.push('/gestor/atribuicao')} />
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
                <View>
                  <Cell className="font-sans-semibold text-xs text-ink">{r.user.name}</Cell>
                  <Cell className="font-mono text-[10px] text-ink-subtle">{r.user.email}</Cell>
                </View>
              ),
            },
            { key: 'inst', title: 'Instituição', width: 220, render: (r) => <Cell className="font-sans text-xs text-ink-muted">{r.user.institution ?? '—'}</Cell> },
            { key: 'atr', title: 'Atribuídas', width: 90, render: (r) => <Cell className="font-mono-bold text-xs text-primary">{r.assigned}</Cell> },
            { key: 'pend', title: 'Pendentes', width: 90, render: (r) => <Cell className="font-mono text-xs text-slate-500">{r.pending}</Cell> },
            { key: 'and', title: 'Em andamento', width: 110, render: (r) => <Cell className="font-mono-bold text-xs text-amber-800">{r.inProg}</Cell> },
            { key: 'fin', title: 'Finalizadas', width: 100, render: (r) => <Cell className="font-mono-bold text-xs text-emerald-700">{r.finalized}</Cell> },
            { key: 'st', title: 'Status', width: 100, render: (r) => <Badge label={r.user.isActive ? 'Ativo' : 'Inativo'} tone={r.user.isActive ? 'success' : 'neutral'} /> },
          ]}
        />
      </Card>
    </Screen>
  );
}

function Kpi({ title, value, note, tone }: { title: string; value: number; note: string; tone?: 'primary' | 'warning' }) {
  const box = tone === 'primary' ? 'border-primary bg-surface-alt' : tone === 'warning' ? 'border-amber-300 bg-warn-soft' : 'border-line bg-white';
  const fg = tone === 'primary' ? 'text-primary' : tone === 'warning' ? 'text-warn' : 'text-ink';
  return (
    <View className={`h-full rounded-xs border p-4 shadow-2xs ${box}`}>
      <Text className={`text-xs uppercase ${tone ? `font-mono-bold ${fg}` : 'font-mono text-ink-subtle'}`}>{title}</Text>
      <Text className={`my-1 font-mono-bold text-3xl ${fg}`}>{value}</Text>
      <Text className={`text-[11px] ${tone === 'primary' ? 'font-sans-semibold text-emerald-700' : tone === 'warning' ? 'font-sans text-warn' : 'font-sans text-ink-subtle'}`}>{note}</Text>
    </View>
  );
}

function SectionTitle({ icon: Icon, title, linkLabel, onLink }: { icon: typeof Users; title: string; linkLabel: string; onLink: () => void }) {
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-2">
      <View className="flex-row items-center gap-2">
        <Icon size={20} color={colors.primary} />
        <Text className="font-sans-bold text-sm text-ink">{title}</Text>
      </View>
      <Pressable onPress={onLink} className="min-h-11 flex-row items-center gap-1">
        <Text className="font-sans-semibold text-xs text-primary">{linkLabel}</Text>
        <ArrowRight size={14} color={colors.primary} />
      </Pressable>
    </View>
  );
}
