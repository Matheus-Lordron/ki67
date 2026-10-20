import { FileCode, FileSpreadsheet, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, PageHeader } from '@/components/ui/Card';
import { Cell, DataTable } from '@/components/ui/DataTable';
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

// Todas as análises do projeto e exportação Labelme/CSV (RF-40). Toda exportação vai para o log.
export default function AnalysesExportScreen() {
  const { batches, images, analyses } = useManagerScope();
  const addAuditLog = useAppStore((s) => s.addAuditLog);
  const showToast = useAppStore((s) => s.showToast);
  const [batchId, setBatchId] = useState<string>('all');
  const [search, setSearch] = useState('');

  const term = search.trim().toLowerCase();
  const rows: Row[] = analyses
    .map((analysis) => {
      const image = images.find((i) => i.id === analysis.imageId)!;
      const c = countMarks(analysis.marks);
      return { analysis, image, reagents: c.reagents, nonReagents: c.nonReagents, ki67: calculateKi67Index(c.reagents, c.nonReagents) };
    })
    .filter((r) => r.image && (batchId === 'all' || r.image.batchId === batchId))
    .filter((r) => !term || r.image.code.toLowerCase().includes(term) || r.analysis.evaluatorCode.toLowerCase().includes(term));

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
    await saveTextFile(`segmenta_ki67_${stamp}.csv`, `﻿${csv}`, 'text/csv');
    addAuditLog('EXPORTACAO', 'export', `CSV · ${batchName} · ${rows.length} análises.`);
    showToast('Exportação CSV gerada.');
  };

  const exportLabelme = async (list: Row[]) => {
    if (!list.length) {
      showToast('Nenhuma análise para exportar.');
      return;
    }
    // Um JSON por imagem e análise, no formato do Labelme (abre direto no Labelme).
    for (const r of list) {
      const json = generateLabelmeJson(r.image.code, r.image.width, r.image.height, r.analysis.marks);
      await saveTextFile(`${r.image.code}_${r.analysis.evaluatorCode.replace(/\s+/g, '_')}.json`, json, 'application/json');
    }
    addAuditLog('EXPORTACAO', 'export', `Labelme JSON · ${list.length} arquivo(s).`);
    showToast(`${list.length} arquivo(s) Labelme exportado(s).`);
  };

  return (
    <Screen>
      <PageHeader
        title="Todas as Análises & Exportação de Dados"
        badge="LABELME JSON & CSV"
        description={<ProjectPicker />}
        actions={
          <>
            <Button label="Exportar CSV" icon={FileSpreadsheet} variant="outline" onPress={exportCsv} disabled={!rows.length} />
            {Platform.OS === 'web' ? <Button label="Exportar Labelme JSON" icon={FileCode} onPress={() => exportLabelme(rows)} disabled={!rows.length} /> : null}
          </>
        }
      />

      <View className="gap-3 border-b border-line pb-3 sm:flex-row sm:items-center sm:justify-between">
        <View className="sm:w-80">
          <TextField icon={Search} value={search} onChangeText={setSearch} placeholder="Buscar por lâmina ou análise..." />
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="font-sans text-xs text-ink-subtle">Filtrar lote:</Text>
          <Select compact value={batchId} onChange={setBatchId} options={[{ value: 'all', label: 'Todos os lotes' }, ...batches.map((b) => ({ value: b.id, label: b.name }))]} />
        </View>
      </View>

      <DataTable<Row>
        rows={rows}
        keyOf={(r) => r.analysis.id}
        empty="Nenhuma análise encontrada."
        columns={[
          { key: 'img', title: 'Lâmina', width: 110, render: (r) => <Cell className="font-mono-bold text-xs text-primary">{r.image.code}</Cell> },
          { key: 'lote', title: 'Lote', width: 200, render: (r) => <Cell className="font-sans text-xs text-ink-muted" lines={1}>{r.image.batchName}</Cell> },
          { key: 'av', title: 'Análise (anonimizada)', width: 150, render: (r) => <Cell className="font-sans-semibold text-xs text-ink">{r.analysis.evaluatorCode}</Cell> },
          { key: 'v', title: 'Versão', width: 70, render: (r) => <Cell className="font-mono text-xs text-slate-600">v{r.analysis.currentVersion}</Cell> },
          { key: 'k', title: 'Ki-67', width: 80, render: (r) => <Cell className="font-mono-bold text-sm text-primary">{formatKi67(r.ki67)}</Cell> },
          { key: 'r', title: 'Reagentes', width: 90, render: (r) => <Cell className="font-mono-bold text-xs text-warn">{r.reagents}</Cell> },
          { key: 'nr', title: 'Não reag.', width: 90, render: (r) => <Cell className="font-mono text-xs text-sky-700">{r.nonReagents}</Cell> },
          { key: 'st', title: 'Status', width: 120, render: (r) => <Badge label={r.analysis.status === 'finalizada' ? 'Finalizada' : 'Em andamento'} tone={r.analysis.status === 'finalizada' ? 'success' : 'warning'} /> },
          { key: 'dt', title: 'Último salvamento', width: 150, render: (r) => <Cell className="font-mono text-[11px] text-ink-subtle">{new Date(r.analysis.lastSavedAt).toLocaleString('pt-BR')}</Cell> },
          { key: 'h', title: 'Hash SHA-256', width: 130, render: (r) => <Cell className="font-mono text-[10px] text-slate-500" lines={1}>{r.analysis.hashSHA256}</Cell> },
          {
            key: 'lm',
            title: 'Labelme',
            width: 90,
            render: (r) => (
              <Pressable onPress={() => exportLabelme([r])} className="min-h-9 justify-center">
                <Text className="font-sans-semibold text-xs text-primary">Exportar</Text>
              </Pressable>
            ),
          },
        ]}
      />
    </Screen>
  );
}
