import { Redirect, router, useLocalSearchParams } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  AlertTriangle,
  ChevronUp,
  CircleDot,
  Contrast,
  Grid3x3,
  Hexagon,
  Lock,
  Maximize2,
  MousePointer2,
  Redo2,
  Send,
  Sliders,
  Square,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { KeyValue } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { AnnotationCanvas, type CanvasHandle } from '@/features/anotacao/AnnotationCanvas';
import { QuantPanel, SaveIndicator } from '@/features/anotacao/QuantPanel';
import { VersionHistoryDialog } from '@/features/anotacao/VersionHistoryDialog';
import { isDemo } from '@/data/mode';
import { useAppStore } from '@/state/appStore';
import { type Tool, useEditorStore } from '@/state/editorStore';
import { colors } from '@/theme/colors';
import { calculateKi67Index, countMarks, formatKi67 } from '@/utils/ki67';

const AUTOSAVE_MS = 5000; // salva 5 s depois da última alteração (RF-21: até 10 s)

const TOOLS: { tool: Tool; icon: LucideIcon; key: string; label: string }[] = [
  { tool: 'select', icon: MousePointer2, key: 'V', label: 'Mover / Selecionar' },
  { tool: 'point', icon: CircleDot, key: 'P', label: 'Ponto nuclear' },
  { tool: 'box', icon: Square, key: 'C', label: 'Caixa delimitadora' },
  { tool: 'polygon', icon: Hexagon, key: 'G', label: 'Polígono' },
];

function ToolButton({ icon: Icon, label, hint, active, disabled, onPress, color }: { icon: LucideIcon; label: string; hint: string; active?: boolean; disabled?: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label} [${hint}]`}
      accessibilityState={{ selected: active, disabled }}
      className={`h-11 w-11 items-center justify-center rounded-xs ${active ? 'bg-primary' : 'web:hover:bg-surface-alt'} ${disabled ? 'opacity-40' : ''}`}
    >
      <Icon size={16} color={active ? colors.white : (color ?? colors.inkMuted)} />
      <Text className={`mt-0.5 font-mono text-[9px] ${active ? 'text-white' : 'text-ink-muted'}`}>{hint}</Text>
    </Pressable>
  );
}

export default function AnnotationScreen() {
  const { imageId, historico } = useLocalSearchParams<{ imageId: string; historico?: string }>();
  const { width } = useWindowDimensions();
  const image = useAppStore((s) => s.images.find((i) => i.id === imageId));
  const user = useAppStore((s) => s.currentUser);
  const isOnline = useAppStore((s) => s.isOnline);
  const showToast = useAppStore((s) => s.showToast);
  const analysis = useAppStore((s) => s.analyses.find((a) => a.imageId === imageId && a.evaluatorId === s.currentUser?.id));

  const editor = useEditorStore();
  const canvas = useRef<CanvasHandle>(null);
  const [zoom, setZoom] = useState(1);
  const [dark, setDark] = useState(true);
  const [grid, setGrid] = useState(true);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [historyOpenLocal, setHistoryOpen] = useState(false);
  const historyOpen = historyOpenLocal || historico === '1';

  const allowed = !!image && !!user && image.assignedEvaluatorIds.includes(user.id);

  useEffect(() => {
    if (!allowed || !imageId) return;
    useAppStore.getState().setLastAnnotationImage(imageId);
    // Modo real: sempre reabre pelo servidor (URL assinada nova, versão atual e log ANALISE_ABERTA).
    if (!isDemo || useEditorStore.getState().imageId !== imageId) void useEditorStore.getState().load(imageId);
  }, [allowed, imageId]);

  useEffect(() => {
    if (editor.restoredDraft) showToast('Rascunho deste aparelho recuperado: as marcações ainda não salvas voltaram.');
  }, [editor.restoredDraft, showToast]);

  // Salvamento automático (RF-21). Sem rede, o rascunho espera a conexão voltar (RNF-05).
  useEffect(() => {
    if (!editor.dirty || editor.readOnly || !isOnline || editor.saveStatus === 'saving') return;
    const timer = setTimeout(() => useEditorStore.getState().save(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [editor.marks, editor.observation, editor.dirty, editor.readOnly, editor.saveStatus, isOnline]);

  // Atalhos de teclado na web (RNF-10): 1/2 label, V/P/C/G ferramenta, Z desfaz, Shift+Z refaz, +/-/0 zoom.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      const s = useEditorStore.getState();
      const k = e.key.toLowerCase();
      if (e.key === '1') s.setActiveLabel('reagente');
      else if (e.key === '2') s.setActiveLabel('nao_reagente');
      else if (k === 'v') s.setTool('select');
      else if (k === 'p') s.setTool('point');
      else if (k === 'c') s.setTool('box');
      else if (k === 'g') s.setTool('polygon');
      else if (k === 'z') (e.shiftKey ? s.redo : s.undo)();
      else if (e.key === '+' || e.key === '=') canvas.current?.zoomBy(1.25);
      else if (e.key === '-') canvas.current?.zoomBy(0.8);
      else if (e.key === '0') canvas.current?.reset();
      else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedMarkId) s.removeMark(s.selectedMarkId);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => countMarks(editor.marks), [editor.marks]);
  const ki67 = calculateKi67Index(counts.reagents, counts.nonReagents);

  if (!allowed || !image) return <Redirect href="/avaliador" />;
  if (analysis?.status === 'finalizada' && !finalizeOpen) return <Redirect href={`/avaliador/finalizada/${image.id}`} />;

  if (editor.loading || editor.imageId !== image.id || editor.loadError) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-slate-900 p-6">
        {editor.loadError ? (
          <>
            <Text className="text-center font-sans-semibold text-sm text-white">{editor.loadError}</Text>
            <Button label="Voltar para a fila" variant="outline" onPress={() => router.replace('/avaliador')} />
          </>
        ) : (
          <>
            <ActivityIndicator color="#fff" />
            <Text className="font-mono text-xs text-slate-300">Abrindo {image.code}...</Text>
          </>
        )}
      </View>
    );
  }

  const sidePanel = width >= 1024;
  const sideToolbar = width >= 768;
  const compact = width < 480; // celular: o botão do painel mostra só o índice
  const menuMark = menu ? editor.marks.find((m) => m.id === menu.id) : null;

  const preAnnotate = () => {
    const added = editor.preAnnotate();
    showToast(added ? `${added} núcleos não reagentes pré-marcados para revisão.` : 'Nenhum novo núcleo azul-claro encontrado.');
  };

  const finalize = async () => {
    const ok = await editor.finalize();
    setFinalizeOpen(false);
    if (ok) {
      showToast('Análise finalizada e enviada para a comparação.');
      router.replace(`/avaliador/finalizada/${image.id}`);
    }
  };

  const panel = (
    <QuantPanel
      counts={counts}
      ki67={ki67}
      activeLabel={editor.activeLabel}
      onLabel={editor.setActiveLabel}
      onPreAnnotate={preAnnotate}
      observation={editor.observation}
      onObservation={editor.setObservation}
      activeVersion={editor.activeVersion}
      onHistory={() => setHistoryOpen(true)}
    />
  );

  return (
    <View className="flex-1 bg-surface">
      {/* Faixa do protocolo cego */}
      <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-alt px-4 py-1.5 lg:px-6">
        <View className="flex-shrink flex-row items-center gap-2">
          <Lock size={16} color={colors.primary} />
          <Text className="flex-shrink font-sans text-xs text-ink">
            <Text className="font-sans-semibold text-primary">Modo cego ativo: </Text>
            marcações e anotações de outros avaliadores permanecem ocultas.
          </Text>
        </View>
        <View className="flex-shrink flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <View className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full bg-dab" />
            <Text className="font-mono-bold text-[11px] text-dab">{image.opticalMagnification}</Text>
          </View>
          <Text className="font-mono text-[11px] text-primary">Amostra: {image.code}</Text>
          {!sidePanel ? <SaveIndicator status={editor.saveStatus} version={editor.activeVersion} offline={!isOnline} /> : null}
        </View>
      </View>

      <View className="flex-1 flex-row">
        <View className="relative flex-1" onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          <AnnotationCanvas
            ref={canvas}
            uri={editor.imageUrl ?? image.imageUrl}
            imageWidth={image.width}
            imageHeight={image.height}
            marks={editor.marks}
            tool={editor.tool}
            activeLabel={editor.activeLabel}
            selectedId={editor.selectedMarkId}
            darkBackground={dark}
            showGrid={grid}
            onAddMark={editor.addMark}
            onReplaceMark={editor.replaceMark}
            onSelect={editor.selectMark}
            onMarkMenu={(id, x, y) => setMenu({ id, x, y })}
            onZoomChange={setZoom}
          />

          {/* Barra de ferramentas lateral (tablet e desktop), alvos de 44 px */}
          {sideToolbar ? (
            <View className="absolute left-4 top-4 z-30 gap-1 rounded-xs border border-line bg-white/95 p-1 shadow-md">
              {TOOLS.map((t) => (
                <ToolButton key={t.tool} icon={t.icon} label={t.label} hint={t.key} active={editor.tool === t.tool} onPress={() => editor.setTool(t.tool)} />
              ))}
              <View className="my-0.5 h-px bg-line" />
              <ToolButton icon={Undo2} label="Desfazer" hint="Z" disabled={!editor.undoStack.length} onPress={editor.undo} />
              <ToolButton icon={Redo2} label="Refazer" hint="⇧Z" disabled={!editor.redoStack.length} onPress={editor.redo} />
              <View className="my-0.5 h-px bg-line" />
              <ToolButton icon={ZoomIn} label="Aumentar zoom" hint="+" onPress={() => canvas.current?.zoomBy(1.25)} />
              <ToolButton icon={ZoomOut} label="Diminuir zoom" hint="-" onPress={() => canvas.current?.zoomBy(0.8)} />
              <ToolButton icon={Maximize2} label="Ajustar à tela" hint="0" color={colors.primary} onPress={() => canvas.current?.reset()} />
              <View className="my-0.5 h-px bg-line" />
              <ToolButton icon={Contrast} label="Alternar fundo claro/escuro" hint="Fundo" onPress={() => setDark((d) => !d)} />
              <ToolButton icon={Grid3x3} label="Grade de contagem" hint="Grade" active={grid} onPress={() => setGrid((g) => !g)} />
            </View>
          ) : null}

          {/* Barra de status */}
          <View pointerEvents="box-none" className={`absolute left-4 right-4 flex-row items-center justify-between md:left-20 ${sidePanel ? 'bottom-4' : 'bottom-20'}`}>
            <View className="flex-shrink flex-row flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xs border border-slate-700/60 bg-slate-950/85 px-3 py-1.5 shadow-md">
              <Text className="font-mono text-xs text-slate-200">Zoom: {(zoom * 100).toFixed(0)}%</Text>
              <Text className="font-mono text-xs text-slate-600">|</Text>
              <Text className="font-mono text-xs text-emerald-400">{editor.marks.length} marcações</Text>
              {Platform.OS === 'web' ? (
                <>
                  <Text className="font-mono text-xs text-slate-600">|</Text>
                  <Text className="font-mono text-[11px] text-amber-300">Espaço+arrastar move · roda dá zoom · botão direito abre o menu</Text>
                </>
              ) : (
                <Text className="font-mono text-[11px] text-amber-300">Pinça: zoom · 2 dedos: mover · toque longo: menu</Text>
              )}
            </View>
          </View>

          {/* Barra rápida (celular e tablet sem painel lateral) */}
          {!sidePanel ? (
            <View className="absolute bottom-2 left-2 right-2 z-30 flex-row items-center justify-between gap-1 rounded-xs border border-line bg-white/95 p-1.5 shadow-lg">
              {/* Em telas muito estreitas as ferramentas rolam de lado, em vez de empurrar a barra para fora da tela */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-shrink" contentContainerClassName="items-center">
                {(sideToolbar ? [] : TOOLS).map((t) => (
                  <ToolButton key={t.tool} icon={t.icon} label={t.label} hint={t.key} active={editor.tool === t.tool} onPress={() => editor.setTool(t.tool)} />
                ))}
                {!sideToolbar ? <ToolButton icon={Undo2} label="Desfazer" hint="Z" disabled={!editor.undoStack.length} onPress={editor.undo} /> : null}
              </ScrollView>
              <Pressable
                onPress={() => editor.setActiveLabel(editor.activeLabel === 'reagente' ? 'nao_reagente' : 'reagente')}
                accessibilityLabel="Trocar label ativa"
                className={`h-11 flex-row items-center gap-1 rounded-xs border px-2 ${editor.activeLabel === 'reagente' ? 'border-dab bg-warn-soft' : 'border-hema bg-hema-soft'}`}
              >
                <View className={`h-3 w-3 rounded-full ${editor.activeLabel === 'reagente' ? 'bg-dab' : 'border-2 border-hema'}`} />
                <Text className={`font-mono-bold text-[11px] ${editor.activeLabel === 'reagente' ? 'text-warn' : 'text-sky-700'}`}>
                  {editor.activeLabel === 'reagente' ? counts.reagents : counts.nonReagents}
                </Text>
              </Pressable>
              <Pressable onPress={() => setSheetOpen(true)} accessibilityLabel="Abrir painel de quantificação" className={`h-11 flex-row items-center gap-1 rounded-xs bg-primary ${compact ? 'px-2' : 'px-3'}`}>
                <Text className="font-sans-semibold text-xs text-white">{compact ? formatKi67(ki67) : `${formatKi67(ki67)} · Painel`}</Text>
                <ChevronUp size={14} color={colors.white} />
              </Pressable>
            </View>
          ) : null}

          {/* Menu da marcação (toque longo / clique direito / toque na ferramenta Mover) */}
          {menu && menuMark ? (
            <>
              <Pressable className="absolute inset-0 z-40" onPress={() => setMenu(null)} accessibilityLabel="Fechar menu" />
              <View style={{ left: Math.min(Math.max(8, menu.x - 104), Math.max(8, area.w - 216)), top: menu.y + 230 > area.h ? Math.max(8, menu.y - 220) : menu.y + 12 }} className="absolute z-50 w-52 rounded-xs border border-line bg-white py-1 shadow-lg">
                <Text className="border-b border-surface-alt px-3 py-1 font-mono text-[10px] text-ink-subtle">
                  Ações da marcação {menuMark.isAutoSuggested ? '· sugestão automática' : ''}
                </Text>
                {menuMark.isAutoSuggested ? (
                  <MenuItem label="Aceitar sugestão" color="#047857" icon={CircleDot} onPress={() => { editor.acceptSuggestion(menuMark.id); setMenu(null); }} />
                ) : null}
                <MenuItem label="Trocar para Reagente (●)" color={colors.dab} icon={CircleDot} onPress={() => { editor.setMarkLabel(menuMark.id, 'reagente'); setMenu(null); }} />
                <MenuItem label="Trocar para Não Reagente (○)" color={colors.hema} icon={CircleDot} onPress={() => { editor.setMarkLabel(menuMark.id, 'nao_reagente'); setMenu(null); }} />
                <View className="my-1 h-px bg-surface-alt" />
                <MenuItem label="Excluir marcação" color={colors.danger} icon={Trash2} onPress={() => { editor.removeMark(menuMark.id); setMenu(null); }} />
              </View>
            </>
          ) : null}
        </View>

        {/* Painel de quantificação (desktop) */}
        {sidePanel ? (
          <View className="w-96 border-l border-line bg-white shadow-xs">
            <View className="flex-row items-center justify-between border-b border-line bg-surface-alt p-3.5">
              <View className="flex-row items-center gap-2">
                <Sliders size={16} color={colors.primary} />
                <Text className="font-mono-bold text-xs uppercase tracking-wider text-primary">Quantificação Nuclear Ki-67</Text>
              </View>
              <SaveIndicator status={editor.saveStatus} version={editor.activeVersion} offline={!isOnline} />
            </View>
            <ScrollView contentContainerClassName="p-4">{panel}</ScrollView>
            <View className="gap-2 border-t border-line bg-surface-alt p-3.5">
              <Button label="Finalizar análise" icon={Send} size="lg" onPress={() => setFinalizeOpen(true)} />
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1">
                  <Lock size={12} color="#059669" />
                  <Text className="font-mono text-[10px] text-ink-subtle">Cada versão é selada com SHA-256</Text>
                </View>
                <Text className="font-mono text-[10px] text-ink-subtle">v{editor.activeVersion}</Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>

      <Dialog visible={sheetOpen} onClose={() => setSheetOpen(false)} variant="sheet" title="Painel de Quantificação Ki-67" footer={<Button label="Finalizar Análise" icon={Send} onPress={() => { setSheetOpen(false); setFinalizeOpen(true); }} />}>
        {panel}
      </Dialog>

      <Dialog
        visible={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        title="Confirmar finalização da análise?"
        subtitle={`${image.code} · versão final v${editor.activeVersion + 1}`}
        icon={AlertTriangle}
        iconTone="warning"
        footer={
          <>
            <Button label="Voltar e continuar editando" variant="outline" onPress={() => setFinalizeOpen(false)} />
            <Button label="Sim, submeter para validação" icon={Send} loading={editor.saveStatus === 'saving'} onPress={finalize} />
          </>
        }
      >
        <Text className="font-sans text-xs leading-5 text-ink-muted">
          Ao finalizar, suas marcações serão <Text className="font-sans-semibold text-ink">congeladas de forma irreversível</Text> e entram na comparação cega das N análises.
        </Text>
        <View className="gap-1 rounded-xs border border-line bg-surface-alt p-3">
          <KeyValue label="Índice Ki-67 final:" value={formatKi67(ki67)} valueClassName="text-primary" />
          <KeyValue label="Núcleos positivos (DAB ●):" value={counts.reagents} valueClassName="text-dab" />
          <KeyValue label="Núcleos negativos (HEM ○):" value={counts.nonReagents} valueClassName="text-hema" />
          <View className="mt-1 border-t border-line pt-1">
            <KeyValue label="Total de células:" value={counts.total} />
          </View>
        </View>
      </Dialog>

      {/* Outro aparelho salvou antes (02-arquitetura.md §6.4): o avaliador escolhe qual seguir */}
      <Dialog
        visible={!!editor.conflict}
        onClose={() => undefined}
        title="Esta análise foi salva em outro aparelho"
        subtitle={`Versão no servidor: v${editor.conflict?.serverVersion ?? ''} · sua base: v${editor.activeVersion}`}
        icon={AlertTriangle}
        iconTone="warning"
        footer={
          <>
            <Button label="Usar a versão do servidor" variant="outline" onPress={() => editor.resolveConflict('server')} />
            <Button label="Manter as minhas marcações" onPress={() => editor.resolveConflict('mine')} />
          </>
        }
      >
        <Text className="font-sans text-xs leading-5 text-ink-muted">
          Nada se perde: se você mantiver as suas marcações, elas viram uma versão nova e a versão do outro aparelho continua no histórico.
        </Text>
      </Dialog>

      <VersionHistoryDialog
        visible={historyOpen}
        onClose={() => {
          setHistoryOpen(false);
          if (historico) router.setParams({ historico: undefined });
        }}
        history={analysis?.history ?? []}
        canRestore={!editor.readOnly}
        onRestore={async (n) => {
          const ok = await editor.restore(n);
          if (ok) showToast(`Versão v${n} restaurada como nova versão.`);
          return ok;
        }}
      />
    </View>
  );
}

function MenuItem({ label, color, icon: Icon, onPress }: { label: string; color: string; icon: LucideIcon; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="min-h-10 flex-row items-center gap-1.5 px-3 py-1.5 web:hover:bg-surface-alt">
      <Icon size={14} color={color} />
      <Text style={{ color }} className="font-sans-medium text-xs">{label}</Text>
    </Pressable>
  );
}
