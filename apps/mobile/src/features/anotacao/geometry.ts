/**
 * Matemática do visor da lâmina, compartilhada pelo canvas interativo e pelas
 * visualizações somente leitura.
 *
 * As marcações guardam x/y em PERCENTUAL da imagem original (0–100), o mesmo
 * formato do protótipo e de src/utils/ki67.ts. Para o Labelme, generateLabelmeJson
 * converte para pixels da imagem original (D5).
 */
import type { AnnotationMark } from '@/types';

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface Frame {
  /** Tamanho da área visível (px de tela). */
  viewW: number;
  viewH: number;
  /** Tamanho da imagem original (px). */
  imageW: number;
  imageH: number;
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 8;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Retângulo da imagem na tela (encaixada por inteiro com zoom 1, depois zoom/pan). */
export function imageRect(frame: Frame, vp: Viewport) {
  const fit = Math.min(frame.viewW / frame.imageW, frame.viewH / frame.imageH) || 0;
  const width = frame.imageW * fit * vp.zoom;
  const height = frame.imageH * fit * vp.zoom;
  return {
    left: frame.viewW / 2 + vp.panX - width / 2,
    top: frame.viewH / 2 + vp.panY - height / 2,
    width,
    height,
  };
}

export function toScreen(frame: Frame, vp: Viewport, pctX: number, pctY: number) {
  const r = imageRect(frame, vp);
  return { x: r.left + (pctX / 100) * r.width, y: r.top + (pctY / 100) * r.height };
}

export function toImagePct(frame: Frame, vp: Viewport, screenX: number, screenY: number) {
  const r = imageRect(frame, vp);
  if (!r.width || !r.height) return { x: 0, y: 0, inside: false };
  const x = ((screenX - r.left) / r.width) * 100;
  const y = ((screenY - r.top) / r.height) * 100;
  return { x, y, inside: x >= 0 && x <= 100 && y >= 0 && y <= 100 };
}

/** Zoom mantendo fixo o ponto da tela (cx, cy), como na roda do mouse e na pinça. */
export function zoomAt(frame: Frame, vp: Viewport, nextZoom: number, cx: number, cy: number): Viewport {
  const zoom = clampZoom(nextZoom);
  const k = zoom / vp.zoom;
  const ox = cx - frame.viewW / 2;
  const oy = cy - frame.viewH / 2;
  return { zoom, panX: ox - (ox - vp.panX) * k, panY: oy - (oy - vp.panY) * k };
}

const round1 = (v: number) => Math.round(v * 10) / 10;
export const roundPct = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 100) / 100;
export { round1 };

function pointInPolygon(x: number, y: number, pts: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Marcação sob o dedo/cursor (tolerância em px de tela). Pontos têm prioridade. */
export function hitTest(frame: Frame, vp: Viewport, marks: AnnotationMark[], sx: number, sy: number, tolerance = 16) {
  let best: { id: string; dist: number } | null = null;
  for (const m of marks) {
    if (m.type !== 'point') continue;
    const p = toScreen(frame, vp, m.x, m.y);
    const dist = Math.hypot(p.x - sx, p.y - sy);
    if (dist <= tolerance && (!best || dist < best.dist)) best = { id: m.id, dist };
  }
  if (best) return best.id;
  const pct = toImagePct(frame, vp, sx, sy);
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    if (m.type === 'box' && pct.x >= m.x && pct.x <= m.x + (m.width ?? 0) && pct.y >= m.y && pct.y <= m.y + (m.height ?? 0)) return m.id;
    if (m.type === 'polygon' && m.points && pointInPolygon(pct.x, pct.y, m.points)) return m.id;
  }
  return null;
}

/** Desloca uma marcação inteira (em %), sem sair da imagem. */
export function moveMark(mark: AnnotationMark, dx: number, dy: number): AnnotationMark {
  if (mark.type === 'polygon' && mark.points) {
    return { ...mark, x: roundPct(mark.x + dx), y: roundPct(mark.y + dy), points: mark.points.map((p) => ({ x: roundPct(p.x + dx), y: roundPct(p.y + dy) })) };
  }
  return { ...mark, x: roundPct(mark.x + dx), y: roundPct(mark.y + dy) };
}
