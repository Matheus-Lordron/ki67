import { Redirect, router, useLocalSearchParams } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  AlertTriangle,
  ChevronUp,
  CircleDot,
  Contrast,
  Grid3x3,
  Hexagon,
  Maximize2,
  MousePointer2,
  Redo2,
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
import { ClassSwatch, QuantPanel, SaveIndicator } from '@/features/anotacao/QuantPanel';
import { VersionHistoryDialog } from '@/features/anotacao/VersionHistoryDialog';
import { isDemo } from '@/data/mode';
import { useAppStore } from '@/state/appStore';
import { type Tool, useEditorStore } from '@/state/editorStore';
import { colors } from '@/theme/colors';
import { countMarks } from '@/utils/ki67';

const AUTOSAVE_MS = 5000; // salva 5 s depois da última alteração (RF-21: até 10 s)

const TOOLS: { tool: Tool; icon: LucideIcon; key: string; label: string }[] = [
  { tool: 'select', icon: MousePointer2, key: 'V', label: 'Selecionar e mover' },
  { tool: 'point', icon: CircleDot, key: 'P', label: 'Ponto' },
  { tool: 'box', icon: Square, key: 'C', label: 'Caixa' },
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
      <Text className={`mt-0.5 font-mono text-[9px] ${active ? 'text-white' : 'text-ink-subtle'}`}>{hint}</Text>
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

  if (!allowed || !image) return <Redirect href="/avaliador" />;
  if (analysis?.status === 'finalizada' && !finalizeOpen) return <Redirect href={`/avaliador/finalizada/${image.id}`} />;

  if (editor.loading || editor.imageId !== image.id || editor.loadError) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-[#2a2b2e] p-6">
        {editor.loadError ? (
          <>
            <Text className="text-center font-sans-semibold text-sm text-white">{editor.loadError}</Text>
            <Button label="Voltar para a fila" variant="outline" onPress={() => router.replace('/avaliador')} />
          </>
        ) : (
          <>
            <ActivityIndicator color="#fff" />
            <Text className="font-sans text-[13px] text-[#c9c9c4]">Abrindo {image.code}…</Text>
          </>
        )}
      </View>
    );
  }

  const sidePanel = width >= 1024;
  const sideToolbar = width >= 768;
  const compact = width < 480; // celular: o botão do painel mostra só o total
  const menuMark = menu ? editor.marks.find((m) => m.id === menu.id) : null;

  const preAnnotate = () => {
    const added = editor.preAnnotate();
    showToast(added ? `${added} sugestões de não reagentes adicionadas. Revise antes de finalizar.` : 'Nenhuma sugestão nova nesta imagem.');
  };

  const finalize = async () => {
    const ok = await editor.finalize();
    setFinalizeOpen(false);
    if (ok) {
      showToast('Análise finalizada.');
      router.replace(`/avaliador/finalizada/${image.id}`);
    }
  };

  const panel = (
    <QuantPanel
      counts={counts}
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
      {/* Contexto da imagem; o trabalho dos outros avaliadores nunca aparece aqui */}
      <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-4 py-2 lg:px-6">
        <View className="flex-shrink flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
          <Text className="font-mono text-[13px] text-ink">{image.code}</Text>
          <Text numberOfLines={1} className="flex-shrink font-sans text-[13px] text-ink-muted">{image.organ}</Text>
          <Text className="font-sans text-xs text-ink-subtle">{image.opticalMagnification}</Text>
        </View>
        {!sidePanel ? <SaveIndicator status={editor.saveStatus} version={editor.activeVersion} offline={!isOnline} /> : <Text className="font-sans text-xs text-ink-subtle">Análise cega: você não vê as marcações dos outros avaliadores.</Text>}
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
            <View className="absolute left-4 top-4 z-30 gap-1 rounded-xs border border-line bg-white p-1">
              {TOOLS.map((t) => (
                <ToolButton key={t.tool} icon={t.icon} label={t.label} hint={t.key} active={editor.tool === t.tool} onPress={() => editor.setTool(t.tool)} />
              ))}
              <View className="my-0.5 h-px bg-line" />
              <ToolButton icon={Undo2} label="Desfazer" hint="Z" disabled={!editor.undoStack.length} onPress={editor.undo} />
              <ToolButton icon={Redo2} label="Refazer" hint="⇧Z" disabled={!editor.redoStack.length} onPress={editor.redo} />
              <View className="my-0.5 h-px bg-line" />
              <ToolButton icon={ZoomIn} label="Aumentar zoom" hint="+" onPress={() => canvas.current?.zoomBy(1.25)} />
              <ToolButton icon={ZoomOut} label="Diminuir zoom" hint="-" onPress={() => canvas.current?.zoomBy(0.8)} />
              <ToolButton icon={Maximize2} label="Ajustar à tela" hint="0" onPress={() => canvas.current?.reset()} />
              <View className="my-0.5 h-px bg-line" />
              <ToolButton icon={Contrast} label="Fundo claro ou escuro" hint="fundo" onPress={() => setDark((d) => !d)} />
              <ToolButton icon={Grid3x3} label="Grade de contagem" hint="grade" active={grid} onPress={() => setGrid((g) => !g)} />
            </View>
          ) : null}

          {/* Barra de status */}
          <View pointerEvents="box-none" className={`absolute left-4 right-4 flex-row items-center justify-between md:left-20 ${sidePanel ? 'bottom-4' : 'bottom-20'}`}>
            <View className="flex-shrink flex-row flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xs bg-black/70 px-3 py-1.5">
              <Text className="font-mono text-xs text-white">{(zoom * 100).toFixed(0)}%</Text>
              <Text className="font-sans text-xs text-[#c9c9c4]">
                {Platform.OS === 'web' ? 'Espaço + arrastar move · roda do mouse aproxima · botão direito abre o menu' : 'Pinça aproxima · dois dedos movem · toque longo abre o menu'}
              </Text>
            </View>
          </View>

          {/* Barra rápida (celular e tablet sem painel lateral) */}
          {!sidePanel ? (
            <View className="absolute bottom-2 left-2 right-2 z-30 flex-row items-center justify-between gap-1 rounded-xs border border-line bg-white p-1.5">
              {/* Em telas muito estreitas as ferramentas rolam de lado, em vez de empurrar a barra para fora da tela */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-shrink" contentContainerClassName="items-center">
                {(sideToolbar ? [] : TOOLS).map((t) => (
                  <ToolButton key={t.tool} icon={t.icon} label={t.label} hint={t.key} active={editor.tool === t.tool} onPress={() => editor.setTool(t.tool)} />
                ))}
                {!sideToolbar ? <ToolButton icon={Undo2} label="Desfazer" hint="Z" disabled={!editor.undoStack.length} onPress={editor.undo} /> : null}
              </ScrollView>
              <Pressable
                onPress={() => editor.setActiveLabel(editor.activeLabel === 'reagente' ? 'nao_reagente' : 'reagente')}
                accessibilityLabel={`Classe ativa: ${editor.activeLabel === 'reagente' ? 'reagente' : 'não reagente'}. Toque para trocar.`}
                className="h-11 flex-row items-center gap-1.5 rounded-xs border border-line px-2.5"
              >
                <ClassSwatch label={editor.activeLabel} size={12} />
                <Text className="font-mono text-[13px] text-ink">{editor.activeLabel === 'reagente' ? counts.reagents : counts.nonReagents}</Text>
              </Pressable>
              <Pressable onPress={() => setSheetOpen(true)} accessibilityLabel="Abrir painel" className={`h-11 flex-row items-center gap-1 rounded-xs bg-primary ${compact ? 'px-2.5' : 'px-3'}`}>
                <Text className="font-sans-medium text-xs text-white">{compact ? 'Painel' : `Painel · ${counts.total} marcados`}</Text>
                <ChevronUp size={14} color={colors.white} />
              </Pressable>
            </View>
          ) : null}

          {/* Menu da marcação (toque longo / clique direito / toque na ferramenta Mover) */}
          {menu && menuMark ? (
            <>
              <Pressable className="absolute inset-0 z-40" onPress={() => setMenu(null)} accessibilityLabel="Fechar menu" />
              <View style={{ left: Math.min(Math.max(8, menu.x - 104), Math.max(8, area.w - 216)), top: menu.y + 230 > area.h ? Math.max(8, menu.y - 220) : menu.y + 12 }} className="absolute z-50 w-52 rounded-xs border border-line bg-white py-1 shadow-lg">
                {menuMark.isAutoSuggested ? <Text className="border-b border-line px-3 py-1.5 font-sans text-xs text-ink-subtle">Sugestão automática</Text> : null}
                {menuMark.isAutoSuggested ? (
                  <MenuItem label="Aceitar sugestão" color={colors.success} icon={CircleDot} onPress={() => { editor.acceptSuggestion(menuMark.id); setMenu(null); }} />
                ) : null}
                <MenuItem label="Mudar para reagente" color={colors.dab} icon={CircleDot} onPress={() => { editor.setMarkLabel(menuMark.id, 'reagente'); setMenu(null); }} />
                <MenuItem label="Mudar para não reagente" color={colors.hema} icon={CircleDot} onPress={() => { editor.setMarkLabel(menuMark.id, 'nao_reagente'); setMenu(null); }} />
                <View className="my-1 h-px bg-line" />
                <MenuItem label="Apagar marcação" color={colors.danger} icon={Trash2} onPress={() => { editor.removeMark(menuMark.id); setMenu(null); }} />
              </View>
            </>
          ) : null}
        </View>

        {/* Painel de quantificação (desktop) */}
        {sidePanel ? (
          <View className="w-80 border-l border-line bg-white">
            <View className="flex-row items-center justify-between border-b border-line px-4 py-3">
              <Text className="font-sans-semibold text-sm text-ink">Contagem</Text>
              <SaveIndicator status={editor.saveStatus} version={editor.activeVersion} offline={!isOnline} />
            </View>
            <ScrollView contentContainerClassName="p-4">{panel}</ScrollView>
            <View className="gap-2 border-t border-line p-4">
              <Button label="Finalizar análise" size="lg" onPress={() => setFinalizeOpen(true)} />
              <Text className="font-sans text-xs leading-4 text-ink-subtle">Depois de finalizada, a análise não pode mais ser editada.</Text>
            </View>
          </View>
        ) : null}
      </View>

      <Dialog visible={sheetOpen} onClose={() => setSheetOpen(false)} variant="sheet" title="Contagem" footer={<Button label="Finalizar análise" onPress={() => { setSheetOpen(false); setFinalizeOpen(true); }} />}>
        {panel}
      </Dialog>

      <Dialog
        visible={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        title="Finalizar a análise?"
        subtitle={`${image.code} · versão ${editor.activeVersion + 1}`}
        icon={AlertTriangle}
        iconTone="warning"
        footer={
          <>
            <Button label="Continuar editando" variant="outline" onPress={() => setFinalizeOpen(false)} />
            <Button label="Finalizar" loading={editor.saveStatus === 'saving'} onPress={finalize} />
          </>
        }
      >
        <Text className="font-sans text-xs leading-5 text-ink-muted">
          As marcações ficam travadas e a análise passa a contar para a comparação com os outros avaliadores. Não dá para desfazer.
        </Text>
        <View className="gap-1.5 rounded-xs bg-surface p-3">
          <KeyValue label="Reagentes" value={counts.reagents} />
          <KeyValue label="Não reagentes" value={counts.nonReagents} />
          <View className="border-t border-line pt-1.5">
            <KeyValue label="Total" value={counts.total} />
          </View>
        </View>
      </Dialog>

      {/* Outro aparelho salvou antes (02-arquitetura.md §6.4): o avaliador escolhe qual seguir */}
      <Dialog
        visible={!!editor.conflict}
        onClose={() => undefined}
        title="Esta análise foi salva em outro aparelho"
        subtitle={`Versão no servidor: ${editor.conflict?.serverVersion ?? ''} · a sua partiu da ${editor.activeVersion}`}
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
          if (ok) showToast(`A versão ${n} foi restaurada como uma versão nova.`);
          return ok;
        }}
      />
    </View>
  );
}

function MenuItem({ label, color, icon: Icon, onPress }: { label: string; color: string; icon: LucideIcon; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="min-h-10 flex-row items-center gap-2 px-3 py-1.5 web:hover:bg-surface">
      <Icon size={14} color={color} />
      <Text className="font-sans text-[13px] text-ink">{label}</Text>
    </Pressable>
  );
}
