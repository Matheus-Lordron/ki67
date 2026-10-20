/**
 * Pré-anotação de DEMONSTRAÇÃO (Fase 3).
 *
 * A pré-anotação real (núcleos azul-claros por limiar de cor, RF-17/RF-18) é
 * calculada uma vez por imagem e guardada em image_versions.pre_annotation
 * (D10). Aqui geramos pontos pseudoaleatórios, mas determinísticos por imagem,
 * para que todos os avaliadores recebam a mesma sugestão, como no sistema real.
 */
import type { AnnotationMark, MarkLabel } from '@/types';

function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function generate(seed: string, count: number, labels: MarkLabel[], prefix: string): AnnotationMark[] {
  const random = seededRandom(seed);
  const now = new Date().toISOString();
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}_${i + 1}`,
    type: 'point' as const,
    label: labels[Math.floor(random() * labels.length)],
    isAutoSuggested: true,
    origin: 'pre_anotacao' as const,
    x: Math.round((8 + random() * 84) * 10) / 10,
    y: Math.round((8 + random() * 84) * 10) / 10,
    createdAt: now,
  }));
}

/** Sugestão inicial ao abrir uma análise pendente (RF-18). */
export function initialPreAnnotation(imageId: string): AnnotationMark[] {
  return generate(`${imageId}:inicial`, 6, ['reagente', 'nao_reagente', 'nao_reagente'], `auto_${imageId}`);
}

/** Botão "Pré-marcar não reagentes" (RF-17): só núcleos azul-claros. */
export function preMarkNonReagents(imageId: string, existing: AnnotationMark[]): AnnotationMark[] {
  const candidates = generate(`${imageId}:nao_reagentes`, 12, ['nao_reagente'], `auto_nr_${imageId}`);
  // não repete pontos já marcados (tolerância de 2% da imagem)
  return candidates.filter(
    (c) => !existing.some((m) => m.id === c.id || Math.hypot(m.x - c.x, m.y - c.y) < 2),
  );
}
