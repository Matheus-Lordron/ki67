import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, PageHeader, Section } from '@/components/ui/Card';
import { Cell, DataTable } from '@/components/ui/DataTable';
import { Screen } from '@/components/ui/Screen';
import { ProjectPicker, useManagerScope } from '@/features/gestor/useManagerScope';
import { useRefreshOnFocus } from '@/features/sessao/useRefreshOnFocus';
import { useAppStore } from '@/state/appStore';
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
        title="Progresso"
        description={<ProjectPicker />}
        actions={<Button label="Novo lote" icon={Plus} onPress={() => router.push('/gestor/lotes')} />}
      />

      <View className="flex-row flex-wrap gap-x-10 gap-y-4">
        <Figure value={images.length} label={`imagens em ${batches.length} ${batches.length === 1 ? 'lote' : 'lotes'}`} />
        <Figure value={pending} label="não iniciadas" />
        <Figure value={inProgress} label="em anotação" />
        <Figure value={ready} label="prontas para validar" />
        <Figure value={validated} label="com resultado" />
      </View>

      <Section title="Por lote" action={<TextLink label="Gerenciar lotes" onPress={() => router.push('/gestor/lotes')} />}>
        <DataTable<(typeof batchRows)[number]>
          rows={batchRows}
          keyOf={(r) => r.batch.id}
          empty="Nenhum lote neste projeto."
          columns={[
            { key: 'lote', title: 'Lote', width: 260, render: (r) => <Cell className="font-sans-medium text-[13px] text-ink">{r.batch.name}</Cell> },
            { key: 'n', title: 'Avaliadores por imagem', width: 170, render: (r: { batch: Batch }) => <Cell className="font-mono text-[13px] text-ink">{r.batch.evaluatorsPerImage}</Cell> },
            { key: 'img', title: 'Imagens', width: 80, render: (r) => <Cell className="font-mono text-[13px] text-ink">{r.total}</Cell> },
            { key: 'pend', title: 'Não iniciadas', width: 110, render: (r) => <Cell className="font-mono text-[13px] text-ink-muted">{r.pending}</Cell> },
            { key: 'and', title: 'Em anotação', width: 110, render: (r) => <Cell className="font-mono text-[13px] text-ink-muted">{r.inProgress}</Cell> },
            {
              key: 'prog',
              title: 'Concluídas',
              width: 200,
              render: (r) => {
                const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
                return (
                  <View className="flex-row items-center gap-2">
                    <View className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-alt">
                      <View style={{ width: `${pct}%` }} className="h-full bg-ink" />
                    </View>
                    <Text className="font-mono text-xs text-ink">{`${r.done}/${r.total}`}</Text>
                  </View>
                );
              },
            },
          ]}
        />
      </Section>

      <Section title="Por avaliador" action={<TextLink label="Atribuir imagens" onPress={() => router.push('/gestor/atribuicao')} />}>
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
                  <Cell className="font-sans-medium text-[13px] text-ink">{r.user.name}</Cell>
                  <Cell className="font-sans text-xs text-ink-subtle">{r.user.institution ?? r.user.email}</Cell>
                </View>
              ),
            },
            { key: 'atr', title: 'Atribuídas', width: 100, render: (r) => <Cell className="font-mono text-[13px] text-ink">{r.assigned}</Cell> },
            { key: 'pend', title: 'Não iniciadas', width: 110, render: (r) => <Cell className="font-mono text-[13px] text-ink-muted">{r.pending}</Cell> },
            { key: 'and', title: 'Em anotação', width: 110, render: (r) => <Cell className="font-mono text-[13px] text-ink-muted">{r.inProg}</Cell> },
            { key: 'fin', title: 'Finalizadas', width: 100, render: (r) => <Cell className="font-mono text-[13px] text-ink">{r.finalized}</Cell> },
            { key: 'st', title: 'Conta', width: 100, render: (r) => (r.user.isActive ? <Cell className="font-sans text-[13px] text-ink-muted">Ativa</Cell> : <Badge label="Desativada" tone="neutral" />) },
          ]}
        />
      </Section>
    </Screen>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <View>
      <Text className="font-mono text-2xl text-ink">{value}</Text>
      <Text className="font-sans text-[13px] text-ink-muted">{label}</Text>
    </View>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="min-h-9 justify-center">
      <Text className="font-sans text-[13px] text-ink underline">{label}</Text>
    </Pressable>
  );
}
