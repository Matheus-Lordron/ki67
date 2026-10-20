/**
 * Pré-anotação por limiar de cor (RF-17, RF-18, Q3).
 *
 * Calculada UMA vez por imagem, no upload, e guardada em image_versions.pre_annotation
 * (D10): todos os avaliadores recebem a mesma sugestão.
 *
 * Algoritmo (simples de propósito, sem IA):
 *  1. reduz a imagem para no máximo 1024 px no maior lado;
 *  2. classifica cada pixel como hematoxilina (azul-claro → não reagente) ou DAB
 *     (marrom → reagente) por regras de cor no RGB;
 *  3. agrupa pixels vizinhos da mesma classe (componentes conectados);
 *  4. cada grupo com área compatível com um núcleo vira um ponto no centro dele.
 * As coordenadas saem em % da imagem, iguais às marcações manuais.
 *
 * Os limiares ficam em THRESHOLDS para a equipe calibrar com imagens reais.
 */
import { Platform } from 'react-native';

import type { AnnotationMark, MarkLabel } from '@/types';

export const THRESHOLDS = {
  maxSide: 1024,
  /** Hematoxilina: azul domina o vermelho e o pixel não é fundo branco. */
  hema: (r: number, g: number, b: number) => b > r + 12 && b >= g && r + g + b < 600 && r + g + b > 150,
  /** DAB: marrom, vermelho domina o azul e o pixel é escuro o bastante. */
  dab: (r: number, g: number, b: number) => r > b + 25 && r >= g && r + g + b < 480,
  /** Área de um núcleo, em fração da área da imagem reduzida. */
  minAreaFraction: 0.00002,
  maxAreaFraction: 0.004,
  maxPoints: 2000,
};

interface Rgba {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** Função pura (testável): pixels RGBA → pontos sugeridos. */
export function detectNuclei(img: Rgba, now = new Date().toISOString()): AnnotationMark[] {
  const { data, width, height } = img;
  const n = width * height;
  const cls = new Uint8Array(n); // 0 fundo, 1 hematoxilina, 2 DAB
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    cls[i] = THRESHOLDS.dab(r, g, b) ? 2 : THRESHOLDS.hema(r, g, b) ? 1 : 0;
  }

  const minArea = Math.max(4, THRESHOLDS.minAreaFraction * n);
  const maxArea = THRESHOLDS.maxAreaFraction * n;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const marks: AnnotationMark[] = [];

  for (let start = 0; start < n && marks.length < THRESHOLDS.maxPoints; start++) {
    const c = cls[start];
    if (!c || seen[start]) continue;
    // preenchimento por pilha (4 vizinhos)
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let area = 0;
    let sx = 0;
    let sy = 0;
    while (top) {
      const p = stack[--top];
      const x = p % width;
      const y = (p - x) / width;
      area++;
      sx += x;
      sy += y;
      const neighbors = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1];
      for (const q of neighbors) {
        if (q >= 0 && !seen[q] && cls[q] === c) {
          seen[q] = 1;
          stack[top++] = q;
        }
      }
    }
    if (area < minArea || area > maxArea) continue;
    const label: MarkLabel = c === 2 ? 'reagente' : 'nao_reagente';
    marks.push({
      id: `pre_${marks.length + 1}`,
      type: 'point',
      label,
      isAutoSuggested: true,
      origin: 'pre_anotacao',
      x: Math.round(((sx / area + 0.5) / width) * 10000) / 100,
      y: Math.round(((sy / area + 0.5) / height) * 10000) / 100,
      createdAt: now,
    });
  }
  return marks;
}

/**
 * Decodifica a imagem no navegador (canvas) e roda detectNuclei.
 * Devolve null quando não é possível (celular, ou TIFF, que o navegador não abre).
 */
export async function computePreAnnotationWeb(bytes: Uint8Array<ArrayBuffer>, mimeType: string): Promise<AnnotationMark[] | null> {
  if (Platform.OS !== 'web' || mimeType === 'image/tiff' || typeof createImageBitmap === 'undefined') return null;
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }));
  const scale = Math.min(1, THRESHOLDS.maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return detectNuclei({ data: ctx.getImageData(0, 0, width, height).data, width, height });
}
