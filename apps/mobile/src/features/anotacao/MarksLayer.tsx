/**
 * Desenha as marcações sobre a lâmina, em coordenadas de tela.
 * Pontos têm tamanho fixo na tela (não crescem com o zoom), como no Labelme.
 * Rótulos usam cor E símbolo (RNF-12): reagente = disco cheio ●, não reagente = anel ○.
 * Sugestões automáticas ganham contorno tracejado (RF-18).
 *
 * Implementação em react-native-svg (web, Android e iOS, inclusive no Expo Go).
 * Se a prova de conceito de desempenho (D2/RNF-03) pedir, só este arquivo troca para Skia.
 */
import { memo } from 'react';
import Svg, { Circle, G, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { type Frame, imageRect, toScreen, type Viewport } from '@/features/anotacao/geometry';
import { colors } from '@/theme/colors';
import type { AnnotationMark } from '@/types';

const LABEL_COLOR = { reagente: colors.dab, nao_reagente: colors.hema } as const;
const DASH_COLOR = { reagente: colors.dabDashed, nao_reagente: colors.hemaDashed } as const;

interface MarksLayerProps {
  frame: Frame;
  viewport: Viewport;
  marks: AnnotationMark[];
  selectedId?: string | null;
  /** Cor de contorno por camada (comparação A/B/C). */
  tint?: string;
  showGrid?: boolean;
  darkBackground?: boolean;
  /** Polígono em construção (pontos em %). */
  draftPolygon?: { x: number; y: number }[];
  /** Caixa em construção (em %). */
  draftBox?: { x: number; y: number; width: number; height: number } | null;
  /** Áreas de divergência (mapa de calor da comparação), em %. */
  heat?: { x: number; y: number }[];
  pointRadius?: number;
}

function MarksLayerBase({ frame, viewport, marks, selectedId, tint, showGrid, darkBackground, draftPolygon, draftBox, heat, pointRadius = 7 }: MarksLayerProps) {
  const rect = imageRect(frame, viewport);
  const r = pointRadius;
  const gridLines: React.ReactNode[] = [];
  if (showGrid && rect.width > 0) {
    // grade de contagem a cada 10% da imagem
    for (let i = 1; i < 10; i++) {
      const x = rect.left + (rect.width * i) / 10;
      const y = rect.top + (rect.height * i) / 10;
      const stroke = darkBackground ? 'rgba(255,255,255,0.12)' : 'rgba(0,35,111,0.12)';
      gridLines.push(<Line key={`v${i}`} x1={x} y1={rect.top} x2={x} y2={rect.top + rect.height} stroke={stroke} strokeWidth={1} />);
      gridLines.push(<Line key={`h${i}`} x1={rect.left} y1={y} x2={rect.left + rect.width} y2={y} stroke={stroke} strokeWidth={1} />);
    }
  }

  return (
    <Svg width={frame.viewW} height={frame.viewH} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      {gridLines}
      {heat?.map((h, i) => {
        const p = toScreen(frame, viewport, h.x, h.y);
        return <Circle key={`heat${i}`} cx={p.x} cy={p.y} r={18} fill="rgba(245,158,11,0.28)" stroke="rgba(251,191,36,0.9)" strokeWidth={1} />;
      })}
      {marks.map((m) => {
        const color = LABEL_COLOR[m.label];
        const stroke = tint ?? color;
        const selected = m.id === selectedId;
        const dashed = m.isAutoSuggested;
        if (m.type === 'box') {
          const a = toScreen(frame, viewport, m.x, m.y);
          const b = toScreen(frame, viewport, m.x + (m.width ?? 8), m.y + (m.height ?? 8));
          return (
            <G key={m.id}>
              <Rect x={a.x} y={a.y} width={b.x - a.x} height={b.y - a.y} fill={color} fillOpacity={0.15} stroke={stroke} strokeWidth={2} strokeDasharray={dashed ? '5 3' : undefined} />
              {selected ? <Rect x={a.x - 3} y={a.y - 3} width={b.x - a.x + 6} height={b.y - a.y + 6} fill="none" stroke="#fbbf24" strokeWidth={2} /> : null}
              <Rect x={a.x} y={a.y - 14} width={m.label === 'reagente' ? 70 : 82} height={12} fill={color} />
              <SvgText x={a.x + 3} y={a.y - 5} fontSize={9} fill="#fff" fontFamily="IBMPlexMono_500Medium">
                {m.label === 'reagente' ? 'Caixa Reagente' : 'Caixa Não Reag.'}
              </SvgText>
            </G>
          );
        }
        if (m.type === 'polygon' && m.points?.length) {
          const pts = m.points.map((p) => toScreen(frame, viewport, p.x, p.y)).map((p) => `${p.x},${p.y}`).join(' ');
          return (
            <G key={m.id}>
              <Polygon points={pts} fill={color} fillOpacity={0.2} stroke={selected ? '#fbbf24' : stroke} strokeWidth={selected ? 2.5 : 1.5} strokeDasharray={dashed ? '4 3' : undefined} />
            </G>
          );
        }
        const p = toScreen(frame, viewport, m.x, m.y);
        return (
          <G key={m.id}>
            {dashed ? <Circle cx={p.x} cy={p.y} r={r + 4} fill="none" stroke={DASH_COLOR[m.label]} strokeWidth={2} strokeDasharray="3 2" /> : null}
            {selected ? <Circle cx={p.x} cy={p.y} r={r + 6} fill="none" stroke="#fbbf24" strokeWidth={2.5} /> : null}
            {m.label === 'reagente' ? (
              <>
                <Circle cx={p.x} cy={p.y} r={r} fill={colors.dab} stroke={tint ?? '#fff'} strokeWidth={tint ? 2.5 : 1.5} />
                <Circle cx={p.x} cy={p.y} r={1.8} fill="#fff" />
              </>
            ) : (
              <>
                <Circle cx={p.x} cy={p.y} r={r + 1.5} fill="none" stroke={tint ?? '#fff'} strokeWidth={tint ? 2 : 1.5} />
                <Circle cx={p.x} cy={p.y} r={r - 1} fill="rgba(224,242,254,0.4)" stroke={colors.hema} strokeWidth={2.2} />
              </>
            )}
          </G>
        );
      })}
      {draftBox ? (() => {
        const a = toScreen(frame, viewport, draftBox.x, draftBox.y);
        const b = toScreen(frame, viewport, draftBox.x + draftBox.width, draftBox.y + draftBox.height);
        return <Rect x={a.x} y={a.y} width={b.x - a.x} height={b.y - a.y} fill="rgba(251,191,36,0.12)" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 3" />;
      })() : null}
      {draftPolygon?.length ? (
        <G>
          <Polyline points={draftPolygon.map((p) => toScreen(frame, viewport, p.x, p.y)).map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 3" />
          {draftPolygon.map((pt, i) => {
            const p = toScreen(frame, viewport, pt.x, pt.y);
            return <Circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 6 : 4} fill={i === 0 ? '#fbbf24' : '#fff'} stroke="#b45309" strokeWidth={1.5} />;
          })}
        </G>
      ) : null}
    </Svg>
  );
}

export const MarksLayer = memo(MarksLayerBase);
