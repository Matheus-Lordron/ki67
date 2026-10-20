// Regras de negócio do índice Ki-67, migradas sem alteração do protótipo do
// AI Studio. O banco recalcula contagens e índice com a mesma fórmula
// (private.ki67_index em supabase/schema.sql); mantenha os dois em sincronia.
import type { AnnotationMark } from '@/types';

/**
 * Calculates Ki-67 index as:
 * [Reagentes / (Reagentes + Não Reagentes)] * 100
 * Rounded to 1 decimal place.
 * Returns null if there are no marks (0 total), allowing display of "—".
 */
export function calculateKi67Index(reagents: number, nonReagents: number): number | null {
  const total = reagents + nonReagents;
  if (total <= 0) {
    return null;
  }
  const raw = (reagents / total) * 100;
  return Math.round(raw * 10) / 10;
}

/**
 * Formats Ki-67 index for display.
 * Returns "—" if null/no marks, otherwise "X.X%".
 */
export function formatKi67(index: number | null | undefined): string {
  if (index === null || index === undefined || isNaN(index)) {
    return '—';
  }
  return `${index.toFixed(1)}%`;
}

/**
 * Ki-67 stratification according to St. Gallen International Consensus:
 * - Baixo: < 10%
 * - Intermediário: 10% a 20%
 * - Alto / Hotspot: > 20%
 */
export function getKi67Stratification(index: number | null | undefined): {
  label: string;
  badgeClass: string;
  level: 'none' | 'low' | 'intermediate' | 'high';
} {
  if (index === null || index === undefined || isNaN(index)) {
    return {
      label: 'Não calculado',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      level: 'none',
    };
  }
  if (index < 10.0) {
    return {
      label: 'Baixo (< 10%)',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      level: 'low',
    };
  }
  if (index <= 20.0) {
    return {
      label: 'Intermediário (10% - 20%)',
      badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
      level: 'intermediate',
    };
  }
  return {
    label: 'Alto / Hotspot (> 20%)',
    badgeClass: 'bg-rose-50 text-rose-900 border-rose-200',
    level: 'high',
  };
}

/**
 * Count marks by label
 */
export function countMarks(marks: AnnotationMark[]): { reagents: number; nonReagents: number; total: number } {
  let reagents = 0;
  let nonReagents = 0;
  for (const m of marks) {
    if (m.label === 'reagente') {
      reagents += 1;
    } else {
      nonReagents += 1;
    }
  }
  return { reagents, nonReagents, total: reagents + nonReagents };
}

/**
 * Calculates spatial coincidence between two sets of marks within a percentage tolerance.
 * Returns percentage (0 to 100) of marks that coincide spatially.
 */
export function calculateSpatialCoincidence(
  marksA: AnnotationMark[],
  marksB: AnnotationMark[],
  tolerancePct: number = 3.5 // percentage of canvas coordinates
): number {
  if (marksA.length === 0 || marksB.length === 0) return 0;

  let matches = 0;
  for (const a of marksA) {
    const foundMatch = marksB.some((b) => {
      if (a.label !== b.label) return false;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist <= tolerancePct;
    });
    if (foundMatch) matches += 1;
  }

  const rate = (matches / Math.max(marksA.length, marksB.length)) * 100;
  return Math.round(rate * 10) / 10;
}

/**
 * Evaluates divergence among N analyses.
 * Returns min, max, delta in percentage points (p.p.), and consensus median index.
 */
export function calculateInterObserverMetrics(indices: number[]): {
  min: number;
  max: number;
  deltaPP: number;
  median: number;
  iccEstimate: number;
} {
  if (indices.length === 0) {
    return { min: 0, max: 0, deltaPP: 0, median: 0, iccEstimate: 1.0 };
  }
  const sorted = [...indices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const deltaPP = Math.round((max - min) * 10) / 10;

  // Median
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;

  // ICC estimate based on inter-rater variance
  const penalty = Math.min(deltaPP * 0.04, 0.45);
  const iccEstimate = Math.max(0.5, Math.round((0.98 - penalty) * 100) / 100);

  return { min, max, deltaPP, median, iccEstimate };
}

/**
 * Generates Labelme JSON export structure for an image's annotations
 */
export function generateLabelmeJson(
  imageCode: string,
  imageWidth: number,
  imageHeight: number,
  marks: AnnotationMark[]
): string {
  const shapes = marks.map((m) => {
    let shapeType = 'point';
    let points: number[][] = [];

    if (m.type === 'point') {
      shapeType = 'point';
      points = [[Math.round((m.x / 100) * imageWidth), Math.round((m.y / 100) * imageHeight)]];
    } else if (m.type === 'box') {
      shapeType = 'rectangle';
      const x1 = Math.round((m.x / 100) * imageWidth);
      const y1 = Math.round((m.y / 100) * imageHeight);
      const x2 = x1 + Math.round(((m.width || 5) / 100) * imageWidth);
      const y2 = y1 + Math.round(((m.height || 5) / 100) * imageHeight);
      points = [
        [x1, y1],
        [x2, y2],
      ];
    } else if (m.type === 'polygon' && m.points) {
      shapeType = 'polygon';
      points = m.points.map((p) => [Math.round((p.x / 100) * imageWidth), Math.round((p.y / 100) * imageHeight)]);
    }

    return {
      label: m.label === 'reagente' ? 'Ki67_Positive_DAB' : 'Ki67_Negative_Hematoxylin',
      points,
      group_id: null,
      description: m.isAutoSuggested ? 'auto_suggested' : 'manual',
      shape_type: shapeType,
      flags: {},
    };
  });

  const labelmeData = {
    version: '5.2.1',
    flags: {},
    shapes,
    imagePath: `${imageCode}.jpg`,
    imageData: null,
    imageHeight,
    imageWidth,
  };

  return JSON.stringify(labelmeData, null, 2);
}

/**
 * Generates CSV export content for batch analyses
 */
export function generateCsvExport(
  batchName: string,
  records: Array<{
    imageCode: string;
    evaluatorCode: string;
    reagents: number;
    nonReagents: number;
    total: number;
    ki67Index: number | null;
    status: string;
    lastSavedAt: string;
    observation: string;
  }>
): string {
  const headers = [
    'Lote',
    'Codigo_Imagem',
    'Avaliador_Anonimizado',
    'Reagentes_DAB',
    'Nao_Reagentes_HEM',
    'Total_Nucleos',
    'Indice_Ki67_Pct',
    'Status',
    'Data_Hora',
    'Observacoes',
  ];

  const rows = records.map((r) => [
    `"${batchName}"`,
    `"${r.imageCode}"`,
    `"${r.evaluatorCode}"`,
    r.reagents,
    r.nonReagents,
    r.total,
    r.ki67Index !== null ? r.ki67Index.toFixed(1) : '—',
    `"${r.status}"`,
    `"${r.lastSavedAt}"`,
    `"${(r.observation || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
}
