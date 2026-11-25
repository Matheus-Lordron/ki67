import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PageHeader, StatusDot } from '@/components/ui/Card';
import { Cell, DataTable, PaginationBar } from '@/components/ui/DataTable';
import { TextField } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { ProjectPicker, useManagerScope } from '@/features/gestor/useManagerScope';
import { saveTextFile } from '@/services/download';
import { useAppStore } from '@/state/appStore';
import type { EvaluatorAnalysis, ImageItem } from '@/types';
import { calculateKi67Index, countMarks, formatKi67, generateCsvExport, generateLabelmeJson } from '@/utils/ki67';

interface Row {
  analysis: EvaluatorAnalysis;
  image: ImageItem;
  reagents: number;
  nonReagents: number;
  ki67: number | null;
}

const PAGE_SIZE = 10;

// Todas as análises do projeto e exportação LabelMe/CSV (RF-40). Toda exportação vai para o log.
export default function AnalysesExportScreen() {
  const { batches, images, analyses } = useManagerScope();
  const addAuditLog = useAppStore((s) => s.addAuditLog);
  const showToast = useAppStore((s) => s.showToast);
  const [batchId, setBatchId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const term = search.trim().toLowerCase();
  const rows: Row[] = analyses
    .map((analysis) => {
      const image = images.find((i) => i.id === analysis.imageId)!;
      const c = countMarks(analysis.marks);
      return {
        analysis,
        image,
        reagents: c.reagents,
        nonReagents: c.nonReagents,
        ki67: analysis.marks.length ? calculateKi67Index(c.reagents, c.nonReagents) : null,
      };
    })
    .filter((r) => r.image && (batchId === 'all' || r.image.batchId === batchId))
    .filter((r) => !term || r.image.code.toLowerCase().includes(term) || r.analysis.evaluatorCode.toLowerCase().includes(term));

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pagedRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const batchName = batchId === 'all' ? 'Todos os lotes' : (batches.find((b) => b.id === batchId)?.name ?? batchId);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  const exportCsv = async () => {
    const csv = generateCsvExport(
      batchName,
      rows.map((r) => ({
        imageCode: r.image.code,
        evaluatorCode: r.analysis.evaluatorCode, // anonimizado: nunca o nome
        reagents: r.reagents,
        nonReagents: r.nonReagents,
        total: r.reagents + r.nonReagents,
        ki67Index: r.ki67,
        status: r.analysis.status,
        lastSavedAt: r.analysis.lastSavedAt,
        observation: r.analysis.observation,
      })),
    );
    await saveTextFile(`segmenta_ki67_${stamp}.csv`, `\uFEFF${csv}`, 'text/csv');
    addAuditLog('EXPORTACAO', 'export', `CSV · ${batchName} · ${rows.length} análises.`);
    showToast(`Exportação CSV concluída: ${rows.length} análise(s).`);
  };

  const exportLabelme = async (list: Row[]) => {
    if (!list.length) {
      showToast('Nenhuma análise para exportar.');
      return;
    }
    for (const r of list) {
      const json = generateLabelmeJson(r.image.code, r.image.width, r.image.height, r.analysis.marks);
      await saveTextFile(`${r.image.code}_${r.analysis.evaluatorCode.replace(/\s+/g, '_')}.json`, json, 'application/json');
    }
    addAuditLog('EXPORTACAO', 'export', `Labelme JSON · ${list.length} arquivo(s).`);
    showToast(`Exportação concluída: ${list.length} arquivo(s) LabelMe.`);
  };

  return (
    <Screen maxWidth={1120}>
      <PageHeader
        title="Análises"
        description="Consulte as análises e exporte os dados do projeto."
        actions={
          <>
            <Button label="Exportar CSV" variant="outline" onPress={exportCsv} disabled={!rows.length} />
            {Platform.OS === 'web' ? (
              <Button label="Exportar LabelMe JSON" onPress={() => exportLabelme(rows)} disabled={!rows.length} />
            ) : null}
          </>
        }
      />

      <View className="flex-row flex-wrap items-end gap-4">
        <View className="min-w-[260px] flex-1">
          <TextField
            label="Buscar"
            icon={Search}
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Lâmina ou análise"
          />
        </View>
        <ProjectPicker />
        <View className="min-w-[220px]">
          <Select
            label="Lote"
            value={batchId}
            onChange={(v) => {
              setBatchId(v);
              setPage(1);
            }}
            options={[{ value: 'all', label: 'Todos os lotes' }, ...batches.map((b) => ({ value: b.id, label: b.name }))]}
          />
        </View>
      </View>

      <DataTable<Row>
        rows={pagedRows}
        keyOf={(r) => r.analysis.id}
        empty="Nenhuma análise encontrada."
        columns={[
          {
            key: 'img',
            title: 'Lâmina',
            width: 140,
            render: (r) => (
              <View className="gap-0.5">
                <Cell className="font-sans-bold text-[14px] text-ink">{r.image.code}</Cell>
                <Cell className="font-sans text-[13px] text-ink-muted" lines={1}>
                  {r.image.batchName}
                </Cell>
              </View>
            ),
          },
          {
            key: 'av',
            title: 'Análise',
            width: 130,
            render: (r) => (
              <View className="gap-0.5">
                <Cell className="font-sans-bold text-[14px] text-ink">{r.analysis.evaluatorCode}</Cell>
                <Cell className="font-sans text-[13px] text-ink-muted">Versão {r.analysis.currentVersion}</Cell>
              </View>
            ),
          },
          {
            key: 'k',
            title: 'Ki-67',
            width: 95,
            render: (r) => (
              <Cell className={`font-sans-black text-[18px] ${r.ki67 === null ? 'text-ink-subtle' : 'text-ink'}`}>
                {r.ki67 === null ? '—' : formatKi67(r.ki67)}
              </Cell>
            ),
          },
          { key: 'r', title: 'Reagentes', width: 95, render: (r) => <Cell className="font-sans-semibold text-[14px] text-ink">{r.reagents}</Cell> },
          { key: 'nr', title: 'Não reagentes', width: 115, render: (r) => <Cell className="font-sans-semibold text-[14px] text-ink">{r.nonReagents}</Cell> },
          {
            key: 'st',
            title: 'Status',
            width: 130,
            render: (r) => (
              <StatusDot
                label={r.analysis.status === 'finalizada' ? 'Finalizada' : 'Em andamento'}
                active={r.analysis.status === 'finalizada'}
              />
            ),
          },
          {
            key: 'dt',
            title: 'Último salvamento',
            width: 165,
            render: (r) => (
              <View className="gap-0.5">
                <Text className="font-sans-semibold text-[14px] text-ink">
                  {new Date(r.analysis.lastSavedAt).toLocaleDateString('pt-BR')},{' '}
                  {new Date(r.analysis.lastSavedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {r.analysis.hashSHA256 ? (
                  <Text numberOfLines={1} className="font-sans text-[12px] text-ink-muted">
                    {r.analysis.hashSHA256.length > 16 ? `${r.analysis.hashSHA256.slice(0, 16)}…` : r.analysis.hashSHA256}
                  </Text>
                ) : null}
              </View>
            ),
          },
          {
            key: 'lm',
            title: 'LabelMe',
            width: 110,
            align: 'right',
            render: (r) => (
              <Pressable
                onPress={() => exportLabelme([r])}
                accessibilityRole="button"
                className="h-9 items-center justify-center rounded-[8px] border border-primary bg-white px-3.5 web:hover:bg-surface-alt"
              >
                <Text className="font-sans-bold text-[13px] text-primary">Exportar</Text>
              </Pressable>
            ),
          },
        ]}
      />

      <PaginationBar page={current} pages={pages} onPageChange={setPage} />
    </Screen>
  );
}
