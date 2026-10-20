/**
 * Monta a comparação cega das N análises finalizadas de uma imagem (RF-30, RF-31),
 * usando as fórmulas de src/utils/ki67.ts. Os avaliadores aparecem só como A, B, C...
 */
import type { AnnotationMark, ComparisonResult, EvaluatorAnalysis, ImageItem } from '@/types';
import { calculateInterObserverMetrics, calculateKi67Index, calculateSpatialCoincidence, countMarks } from '@/utils/ki67';

export const LAYER_COLORS = ['#00236f', '#0284c7', '#8e4d2d', '#047857', '#7c3aed', '#be123c'];
const TOLERANCE_PCT = 3.5;

export interface BlindAnalysis {
  code: string; // A, B, C...
  color: string;
  version: number;
  ki67: number | null;
  reagents: number;
  nonReagents: number;
  total: number;
  finalizedAt?: string;
  hash: string;
  marks: AnnotationMark[];
  observation: string;
}

/** Métricas de concordância e mapa de calor a partir das análises anônimas. */
export function analyzeBlind(blind: BlindAnalysis[], tolerancePct = TOLERANCE_PCT) {
  const indices = blind.map((b) => b.ki67).filter((v): v is number => v !== null);
  const metrics = calculateInterObserverMetrics(indices);

  // Concordância espacial: média das coincidências entre todos os pares (RF-31).
  let pairs = 0;
  let sum = 0;
  for (let i = 0; i < blind.length; i++) {
    for (let j = i + 1; j < blind.length; j++) {
      sum += calculateSpatialCoincidence(blind[i].marks, blind[j].marks, tolerancePct);
      pairs += 1;
    }
  }
  const spatialAgreementPct = pairs ? Math.round((sum / pairs) * 10) / 10 : 100;

  // Mapa de calor: marcações que não têm par (mesma label, dentro da tolerância) em TODAS as outras análises.
  const heat: { x: number; y: number }[] = [];
  blind.forEach((a, i) => {
    a.marks.forEach((m) => {
      const agreed = blind.every((b, j) => j === i || b.marks.some((o) => o.label === m.label && Math.hypot(o.x - m.x, o.y - m.y) <= tolerancePct));
      if (!agreed && !heat.some((h) => Math.hypot(h.x - m.x, h.y - m.y) < tolerancePct)) heat.push({ x: m.x, y: m.y });
    });
  });

  return { metrics, spatialAgreementPct, heat };
}

/** Modo demo: monta as análises anônimas a partir do appStore. */
export function buildComparison(image: ImageItem, analyses: EvaluatorAnalysis[]) {
  const finalized = analyses
    .filter((a) => a.imageId === image.id && a.status === 'finalizada')
    .sort((a, b) => image.assignedEvaluatorIds.indexOf(a.evaluatorId) - image.assignedEvaluatorIds.indexOf(b.evaluatorId));

  const blind: BlindAnalysis[] = finalized.map((a, i) => {
    const counts = countMarks(a.marks);
    return {
      code: String.fromCharCode(65 + i),
      color: LAYER_COLORS[i % LAYER_COLORS.length],
      version: a.currentVersion,
      ki67: calculateKi67Index(counts.reagents, counts.nonReagents),
      reagents: counts.reagents,
      nonReagents: counts.nonReagents,
      total: counts.total,
      finalizedAt: a.finalizedAt,
      hash: a.hashSHA256,
      marks: a.marks,
      observation: a.observation,
    };
  });
  return { blind, ...analyzeBlind(blind), ready: blind.length >= image.requiredEvaluatorsCount };
}

/** Modo real: converte a resposta da RPC get_comparison (já anônima). */
export function blindFromServer(res: ComparisonResult): BlindAnalysis[] {
  return res.analyses.map((a, i) => ({
    code: a.blind_code,
    color: LAYER_COLORS[i % LAYER_COLORS.length],
    version: a.version_number,
    ki67: a.ki67_index === null ? null : Number(a.ki67_index),
    reagents: a.reagents,
    nonReagents: a.non_reagents,
    total: a.reagents + a.non_reagents,
    finalizedAt: a.finalized_at,
    hash: a.content_sha256,
    marks: a.marks as unknown as AnnotationMark[],
    observation: a.observation,
  }));
}

export const iccLabel = (icc: number) => (icc >= 0.9 ? 'Excelente' : icc >= 0.75 ? 'Boa' : icc >= 0.5 ? 'Moderada' : 'Fraca');
