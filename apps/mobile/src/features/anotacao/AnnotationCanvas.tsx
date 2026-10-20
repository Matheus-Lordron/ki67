/**
 * Canvas interativo de anotação (RF-12 a RF-15, RNF-10).
 *
 * Gestos (iguais na web e no celular, via PanResponder):
 *  - Ponto: toque/clique marca; segurar e arrastar mostra a lupa 2,5x e solta no lugar certo.
 *  - Caixa: arrastar desenha; um toque simples cria uma caixa padrão.
 *  - Polígono: toques sucessivos criam vértices; tocar no 1º vértice (ou "Concluir") fecha, com 3 ou mais.
 *  - Mover/Selecionar: arrastar uma marcação a move; arrastar o fundo move a imagem; toque abre o menu.
 *  - Toque longo (ou clique direito na web) sobre uma marcação abre o menu: trocar label, aceitar, excluir.
 *  - Dois dedos: pinça dá zoom e o arrasto move. Web: roda do mouse dá zoom; espaço/Alt + arrastar move.
 */
import { Image } from 'expo-image';
import { Check, X } from 'lucide-react-native';
import { type ComponentRef, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, PanResponder, Platform, Pressable, Text, View } from 'react-native';

import {
  type Frame,
  hitTest,
  imageRect,
  moveMark,
  roundPct,
  toImagePct,
  toScreen,
  type Viewport,
  zoomAt,
} from '@/features/anotacao/geometry';
import { MarksLayer } from '@/features/anotacao/MarksLayer';
import type { Tool } from '@/state/editorStore';
import type { AnnotationMark, MarkLabel } from '@/types';

export interface CanvasHandle {
  zoomBy: (factor: number) => void;
  reset: () => void;
}

interface Props {
  uri: string;
  imageWidth: number;
  imageHeight: number;
  marks: AnnotationMark[];
  tool: Tool;
  activeLabel: MarkLabel;
  selectedId: string | null;
  readOnly?: boolean;
  darkBackground?: boolean;
  showGrid?: boolean;
  onAddMark: (mark: Omit<AnnotationMark, 'id' | 'createdAt' | 'isAutoSuggested'>) => void;
  onReplaceMark: (mark: AnnotationMark) => void;
  onSelect: (id: string | null) => void;
  /** Abre o menu da marcação na posição (x, y) da tela, relativa ao canvas. */
  onMarkMenu: (id: string, x: number, y: number) => void;
  onZoomChange?: (zoom: number) => void;
}

type Mode = 'none' | 'pan' | 'pinch' | 'point' | 'box' | 'polygon' | 'move';

const TAP_SLOP = 6;
const LONG_PRESS_MS = 500;
const LOUPE = 96;
const LOUPE_ZOOM = 2.5;

export const AnnotationCanvas = forwardRef<CanvasHandle, Props>(function AnnotationCanvas(props, ref) {
  const { uri, imageWidth, imageHeight, marks, selectedId, darkBackground, showGrid, tool } = props;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null);
  const [draftBox, setDraftBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [draftPolygon, setDraftPolygon] = useState<{ x: number; y: number }[]>([]);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);

  const viewRef = useRef<ComponentRef<typeof View>>(null);
  const origin = useRef({ x: 0, y: 0 });
  const modifier = useRef({ pan: false });
  const frame: Frame = { viewW: size.w, viewH: size.h, imageW: imageWidth, imageH: imageHeight };

  // Os callbacks do PanResponder são criados uma vez: leem sempre o estado mais recente daqui.
  const latest = useRef({ props, frame, viewport, draftPolygon });
  latest.current = { props, frame, viewport, draftPolygon };

  useEffect(() => setDraftPolygon([]), [tool]);
  useEffect(() => props.onZoomChange?.(viewport.zoom), [viewport.zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    zoomBy: (factor) => setViewport((vp) => zoomAt(latest.current.frame, vp, vp.zoom * factor, latest.current.frame.viewW / 2, latest.current.frame.viewH / 2)),
    reset: () => setViewport({ zoom: 1, panX: 0, panY: 0 }),
  }));

  const measure = () => viewRef.current?.measureInWindow((x, y) => (origin.current = { x, y }));
  const local = (e: GestureResponderEvent) => ({ x: e.nativeEvent.pageX - origin.current.x, y: e.nativeEvent.pageY - origin.current.y });

  const finishPolygon = () => {
    const pts = latest.current.draftPolygon;
    if (pts.length >= 3) {
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      latest.current.props.onAddMark({ type: 'polygon', label: latest.current.props.activeLabel, x: roundPct(cx), y: roundPct(cy), points: pts });
    }
    setDraftPolygon([]);
  };

  // Estado do gesto em andamento (não precisa redesenhar a tela).
  const g = useRef({
    mode: 'none' as Mode,
    start: { x: 0, y: 0 },
    startVp: { zoom: 1, panX: 0, panY: 0 } as Viewport,
    startDist: 0,
    startMid: { x: 0, y: 0 },
    markId: null as string | null,
    moved: false,
    longPressed: false,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          measure();
          const { props: p, frame: f, viewport: vp } = latest.current;
          const s = g.current;
          const pt = local(e);
          const touches = e.nativeEvent.touches ?? [];
          s.start = pt;
          s.startVp = vp;
          s.moved = false;
          s.longPressed = false;
          s.markId = null;
          clearTimeout(s.timer);

          const middleButton = (e.nativeEvent as unknown as { button?: number }).button === 1;
          if (touches.length >= 2) {
            s.mode = 'pinch';
          } else if (modifier.current.pan || middleButton || p.readOnly) {
            s.mode = 'pan';
          } else if (p.tool === 'select') {
            const hit = hitTest(f, vp, p.marks, pt.x, pt.y);
            s.mode = hit ? 'move' : 'pan';
            s.markId = hit;
            if (hit) p.onSelect(hit);
          } else {
            s.mode = p.tool === 'point' ? 'point' : p.tool === 'box' ? 'box' : 'polygon';
            if (s.mode === 'point') setLoupe(pt);
          }

          // Toque longo sobre uma marcação abre o menu (celular).
          if (!p.readOnly) {
            s.timer = setTimeout(() => {
              const now = latest.current;
              const hit = hitTest(now.frame, now.viewport, now.props.marks, s.start.x, s.start.y);
              if (!s.moved && hit) {
                s.longPressed = true;
                s.mode = 'none';
                setLoupe(null);
                now.props.onSelect(hit);
                now.props.onMarkMenu(hit, s.start.x, s.start.y);
              }
            }, LONG_PRESS_MS);
          }
        },
        onPanResponderMove: (e, gs) => {
          const s = g.current;
          const { frame: f, viewport: vp } = latest.current;
          const touches = e.nativeEvent.touches ?? [];
          if (touches.length >= 2) {
            const [a, b] = touches;
            const mid = { x: (a.pageX + b.pageX) / 2 - origin.current.x, y: (a.pageY + b.pageY) / 2 - origin.current.y };
            const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            if (s.mode !== 'pinch' || !s.startDist) {
              s.mode = 'pinch';
              s.startDist = dist;
              s.startMid = mid;
              s.startVp = vp;
              setLoupe(null);
              setDraftBox(null);
              clearTimeout(s.timer);
              return;
            }
            const zoomed = zoomAt(f, s.startVp, s.startVp.zoom * (dist / s.startDist), s.startMid.x, s.startMid.y);
            setViewport({ ...zoomed, panX: zoomed.panX + mid.x - s.startMid.x, panY: zoomed.panY + mid.y - s.startMid.y });
            return;
          }
          if (Math.hypot(gs.dx, gs.dy) > TAP_SLOP) {
            s.moved = true;
            clearTimeout(s.timer);
          }
          const pt = local(e);
          switch (s.mode) {
            case 'pan':
              setViewport({ ...s.startVp, panX: s.startVp.panX + gs.dx, panY: s.startVp.panY + gs.dy });
              break;
            case 'point':
              setLoupe(pt);
              break;
            case 'box': {
              const a = toImagePct(f, vp, s.start.x, s.start.y);
              const b = toImagePct(f, vp, pt.x, pt.y);
              setDraftBox({ x: roundPct(Math.min(a.x, b.x)), y: roundPct(Math.min(a.y, b.y)), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) });
              break;
            }
            case 'move': {
              const r = imageRect(f, vp);
              if (s.markId && s.moved) setDragging({ id: s.markId, dx: (gs.dx / r.width) * 100, dy: (gs.dy / r.height) * 100 });
              break;
            }
          }
        },
        onPanResponderRelease: (e, gs) => {
          const s = g.current;
          clearTimeout(s.timer);
          const { props: p, frame: f, viewport: vp } = latest.current;
          const pt = local(e);
          setLoupe(null);
          if (s.longPressed || s.mode === 'pinch' || s.mode === 'none') {
            s.mode = 'none';
            s.startDist = 0;
            return;
          }
          const pct = toImagePct(f, vp, pt.x, pt.y);
          switch (s.mode) {
            case 'pan':
              if (!s.moved && p.tool === 'select') p.onSelect(null);
              break;
            case 'point': {
              const hit = !s.moved ? hitTest(f, vp, p.marks, pt.x, pt.y, 10) : null;
              if (hit) p.onSelect(hit); // tocar numa marcação existente seleciona, não duplica
              else if (pct.inside) p.onAddMark({ type: 'point', label: p.activeLabel, x: roundPct(pct.x), y: roundPct(pct.y) });
              break;
            }
            case 'box': {
              const a = toImagePct(f, vp, s.start.x, s.start.y);
              if (s.moved && Math.abs(pct.x - a.x) > 0.8 && Math.abs(pct.y - a.y) > 0.8) {
                p.onAddMark({ type: 'box', label: p.activeLabel, x: roundPct(Math.min(a.x, pct.x)), y: roundPct(Math.min(a.y, pct.y)), width: roundPct(Math.abs(pct.x - a.x)), height: roundPct(Math.abs(pct.y - a.y)) });
              } else if (!s.moved && pct.inside) {
                p.onAddMark({ type: 'box', label: p.activeLabel, x: roundPct(pct.x - 4), y: roundPct(pct.y - 4), width: 8, height: 8 });
              }
              setDraftBox(null);
              break;
            }
            case 'polygon': {
              if (s.moved || !pct.inside) break;
              const draft = latest.current.draftPolygon;
              const first = draft[0] && toScreen(f, vp, draft[0].x, draft[0].y);
              if (draft.length >= 3 && first && Math.hypot(first.x - pt.x, first.y - pt.y) < 16) finishPolygon();
              else setDraftPolygon([...draft, { x: roundPct(pct.x), y: roundPct(pct.y) }]);
              break;
            }
            case 'move': {
              const mark = p.marks.find((m) => m.id === s.markId);
              if (mark && s.moved) {
                const r = imageRect(f, vp);
                p.onReplaceMark(moveMark(mark, (gs.dx / r.width) * 100, (gs.dy / r.height) * 100));
              } else if (mark) {
                p.onMarkMenu(mark.id, pt.x, pt.y);
              }
              setDragging(null);
              break;
            }
          }
          s.mode = 'none';
        },
        onPanResponderTerminate: () => {
          clearTimeout(g.current.timer);
          g.current.mode = 'none';
          setLoupe(null);
          setDraftBox(null);
          setDragging(null);
        },
      }),
    [],
  );

  // Web: roda do mouse = zoom no cursor; clique direito = menu; espaço/Alt seguram o modo "mover imagem".
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = viewRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = node.getBoundingClientRect();
      const factor = Math.exp(-ev.deltaY * 0.0015);
      setViewport((vp) => zoomAt(latest.current.frame, vp, vp.zoom * factor, ev.clientX - rect.left, ev.clientY - rect.top));
    };
    const onContext = (ev: MouseEvent) => {
      ev.preventDefault();
      const rect = node.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const { props: p, frame: f, viewport: vp } = latest.current;
      const hit = hitTest(f, vp, p.marks, x, y);
      if (hit && !p.readOnly) {
        p.onSelect(hit);
        p.onMarkMenu(hit, x, y);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === ' ' || ev.key === 'Alt') {
        const target = ev.target as HTMLElement | null;
        if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
        modifier.current.pan = ev.type === 'keydown';
        if (ev.key === ' ') ev.preventDefault();
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('contextmenu', onContext);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('contextmenu', onContext);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  const rect = imageRect(frame, viewport);
  const shownMarks = dragging
    ? marks.map((m) => (m.id === dragging.id ? moveMark(m, dragging.dx, dragging.dy) : m))
    : marks;

  // Lupa: recorte 2,5x da imagem sob o dedo, desenhado acima dele (RNF-10).
  let loupeView = null;
  if (loupe && rect.width > 0) {
    const ix = loupe.x - rect.left;
    const iy = loupe.y - rect.top;
    const top = loupe.y - LOUPE - 30 < 0 ? loupe.y + 30 : loupe.y - LOUPE - 30;
    loupeView = (
      <View pointerEvents="none" style={{ left: loupe.x - LOUPE / 2, top, width: LOUPE, height: LOUPE }} className="absolute z-40 overflow-hidden rounded-full border-2 border-white bg-slate-900 shadow-xl">
        <Image
          source={{ uri }}
          contentFit="fill"
          cachePolicy="none"
          style={{ position: 'absolute', width: rect.width * LOUPE_ZOOM, height: rect.height * LOUPE_ZOOM, left: LOUPE / 2 - ix * LOUPE_ZOOM, top: LOUPE / 2 - iy * LOUPE_ZOOM }}
        />
        <View className="absolute inset-0 items-center justify-center">
          <View className="h-5 w-5 items-center justify-center rounded-full border border-amber-300">
            <View className="h-1 w-1 rounded-full bg-amber-400" />
          </View>
        </View>
        <View className="absolute bottom-1 w-full bg-black/60">
          <Text className="text-center font-mono text-[8px] text-white">2.5x LUPA</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      ref={viewRef}
      onLayout={(e) => {
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
        measure();
      }}
      className={`flex-1 overflow-hidden ${darkBackground ? 'bg-slate-900' : 'bg-slate-100'} web:cursor-crosshair`}
      accessibilityLabel={`Lâmina em anotação. ${marks.length} marcações.`}
      {...responder.panHandlers}
    >
      {size.w > 0 ? (
        <View pointerEvents="none" className="absolute inset-0">
          <Image
            source={{ uri }}
            contentFit="fill"
            cachePolicy="none"
            style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height, opacity: 0.95 }}
          />
          <MarksLayer frame={frame} viewport={viewport} marks={shownMarks} selectedId={selectedId} showGrid={showGrid} darkBackground={darkBackground} draftBox={draftBox} draftPolygon={draftPolygon} />
        </View>
      ) : null}
      {loupeView}
      {tool === 'polygon' && draftPolygon.length > 0 ? (
        <View className="absolute left-0 right-0 top-3 z-30 items-center">
          <View className="flex-row items-center gap-2 rounded-xs border border-line bg-white/95 px-3 py-1.5 shadow-md">
            <Text className="font-mono text-[11px] text-ink">{draftPolygon.length} vértice(s)</Text>
            <Pressable onPress={finishPolygon} disabled={draftPolygon.length < 3} className={`min-h-8 flex-row items-center gap-1 rounded-xs bg-primary px-2 ${draftPolygon.length < 3 ? 'opacity-40' : ''}`}>
              <Check size={14} color="#fff" />
              <Text className="font-sans-semibold text-[11px] text-white">Concluir polígono</Text>
            </Pressable>
            <Pressable onPress={() => setDraftPolygon([])} accessibilityLabel="Cancelar polígono" className="min-h-8 justify-center rounded-xs px-1">
              <X size={16} color="#757682" />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
});
