import { Redirect, router, useLocalSearchParams } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
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
import { Dialog } from '@/components/ui/Dialog';
import { isDemo } from '@/data/mode';
import { AnnotationCanvas, type CanvasHandle } from '@/features/anotacao/AnnotationCanvas';
import { QuantPanel, SaveIndicator } from '@/features/anotacao/QuantPanel';
import { VersionHistoryDialog } from '@/features/anotacao/VersionHistoryDialog';
import { useAppStore } from '@/state/appStore';
import { type Tool, useEditorStore } from '@/state/editorStore';
import { colors } from '@/theme/colors';
import { calculateKi67Index, countMarks, formatKi67 } from '@/utils/ki67';

const AUTOSAVE_MS = 5000; // salva 5 s depois da última alteração (RF-21: até 10 s)

const TOOLS: { tool: Tool; icon: LucideIcon; key: string; label: string }[] = [
  { tool: 'select', icon: MousePointer2, key: 'V', label: 'Selecionar' },
  { tool: 'point', icon: CircleDot, key: 'P', label: 'Ponto' },
  { tool: 'box', icon: Square, key: 'C', label: 'Retângulo' },
  { tool: 'polygon', icon: Hexagon, key: 'G', label: 'Polígono' },
];

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      className={`h-[54px] w-[56px] items-center justify-center rounded-[10px] ${
        active ? 'bg-primary' : 'web:hover:bg-surface-alt'
      } ${disabled ? 'opacity-35' : ''}`}
    >
      <Icon size={18} color={active ? colors.white : colors.ink} />
      <Text numberOfLines={1} className={`mt-1 font-sans-semibold text-[10px] ${active ? 'text-white' : 'text-ink-muted'}`}>
        {label}
      </Text>
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
    if (!isDemo || useEditorStore.getState().imageId !== imageId) void useEditorStore.getState().load(imageId);
  }, [allowed, imageId]);

  useEffect(() => {
    if (editor.restoredDraft) showToast('Rascunho recuperado: marcações locais restauradas.');
  }, [editor.restoredDraft, showToast]);

  // Salvamento automático (RF-21).
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
      <View className="flex-1 items-center justify-center gap-3 bg-surface-canvas p-6">
        {editor.loadError ? (
          <>
            <Text className="text-center font-sans-semibold text-sm text-white">{editor.loadError}</Text>
            <Button label="Voltar para minha fila" variant="outline" onPress={() => router.replace('/avaliador')} />
          </>
        ) : (
          <>
            <ActivityIndicator color="#fff" />
            <Text className="font-sans text-[13px] text-primary-muted">Abrindo {image.code}...</Text>
          </>
        )}
      </View>
    );
  }

  const sidePanel = width >= 1024;
  const sideToolbar = width >= 768;
  const compact = width < 480;
  const menuMark = menu ? editor.marks.find((m) => m.id === menu.id) : null;

  const preAnnotate = () => {
    const added = editor.preAnnotate();
    showToast(added ? `Pré-marcação concluída: ${added} núcleos adicionados.` : 'Nenhum novo núcleo azul-claro encontrado.');
  };

  const finalize = async () => {
    const ok = await editor.finalize();
    setFinalizeOpen(false);
    if (ok) {
      showToast('Análise finalizada: Enviada para a comparação cega.');
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
    <View className="flex-1 flex-row bg-surface-canvas">
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

        {/* Pílula flutuante da amostra e modo cego (Overlay 14:740 no Figma) */}
        <View className="absolute left-6 top-5 z-30 flex-row items-center gap-2 rounded-full bg-black/55 px-3.5 py-1.5">
          <Text className="font-sans-semibold text-[12px] text-white">
            Amostra {image.code} · Modo cego
          </Text>
          {!sidePanel ? (
            <Text className="font-sans text-[12px] text-primary-muted">· {(zoom * 100).toFixed(0)}%</Text>
          ) : null}
        </View>

        {/* Barra de ferramentas flutuante à esquerda (Toolbar 14:698 no Figma) */}
        {sideToolbar ? (
          <View className="absolute left-6 top-16 z-30 gap-1 rounded-[14px] border border-line bg-white p-2 shadow-lg">
            {TOOLS.map((t) => (
              <ToolButton key={t.tool} icon={t.icon} label={t.label} active={editor.tool === t.tool} onPress={() => editor.setTool(t.tool)} />
            ))}
            <View className="mx-2 my-1 h-px bg-line" />
            <ToolButton icon={Undo2} label="Desfazer" disabled={!editor.undoStack.length} onPress={editor.undo} />
            <ToolButton icon={Redo2} label="Refazer" disabled={!editor.redoStack.length} onPress={editor.redo} />
            <View className="mx-2 my-1 h-px bg-line" />
            <ToolButton icon={ZoomIn} label="Zoom +" onPress={() => canvas.current?.zoomBy(1.25)} />
            <ToolButton icon={ZoomOut} label="Zoom -" onPress={() => canvas.current?.zoomBy(0.8)} />
            <ToolButton icon={Maximize2} label="Ajustar" onPress={() => canvas.current?.reset()} />
            <View className="mx-2 my-1 h-px bg-line" />
            <ToolButton icon={Contrast} label="Fundo" active={!dark} onPress={() => setDark((d) => !d)} />
            <ToolButton icon={Grid3x3} label="Grade" active={grid} onPress={() => setGrid((g) => !g)} />
          </View>
        ) : null}

        {/* Barra rápida no celular e tablet */}
        {!sidePanel ? (
          <View className="absolute bottom-3 left-3 right-3 z-30 flex-row items-center justify-between gap-2 rounded-[14px] border border-line bg-white/95 p-2 shadow-lg">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-shrink" contentContainerClassName="items-center gap-1">
              {(sideToolbar ? [] : TOOLS).map((t) => (
                <ToolButton key={t.tool} icon={t.icon} label={t.label} active={editor.tool === t.tool} onPress={() => editor.setTool(t.tool)} />
              ))}
              {!sideToolbar ? <ToolButton icon={Undo2} label="Desfazer" disabled={!editor.undoStack.length} onPress={editor.undo} /> : null}
            </ScrollView>
            <Pressable
              onPress={() => editor.setActiveLabel(editor.activeLabel === 'reagente' ? 'nao_reagente' : 'reagente')}
              accessibilityLabel="Trocar rótulo ativo"
              className="h-11 flex-row items-center gap-1.5 rounded-[10px] border border-line-input bg-white px-3"
            >
              <View className={`h-2.5 w-2.5 rounded-full ${editor.activeLabel === 'reagente' ? 'bg-dab' : 'border-2 border-hema'}`} />
              <Text className="font-sans-bold text-[13px] text-ink">
                {editor.activeLabel === 'reagente' ? counts.reagents : counts.nonReagents}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSheetOpen(true)}
              accessibilityLabel="Abrir painel de anotação"
              className={`h-11 flex-row items-center gap-1.5 rounded-[10px] bg-primary ${compact ? 'px-3' : 'px-4'}`}
            >
              <Text className="font-sans-bold text-[13px] text-white">
                {compact ? formatKi67(ki67) : `${formatKi67(ki67)} · Painel`}
              </Text>
              <ChevronUp size={14} color={colors.white} />
            </Pressable>
          </View>
        ) : null}

        {/* Menu contextual da marcação */}
        {menu && menuMark ? (
          <>
            <Pressable className="absolute inset-0 z-40" onPress={() => setMenu(null)} accessibilityLabel="Fechar menu" />
            <View
              style={{
                left: Math.min(Math.max(8, menu.x - 104), Math.max(8, area.w - 224)),
                top: menu.y + 230 > area.h ? Math.max(8, menu.y - 220) : menu.y + 12,
              }}
              className="absolute z-50 w-56 rounded-[12px] border border-line bg-white py-1.5 shadow-xl"
            >
              <Text className="border-b border-line-soft px-3.5 py-1.5 font-sans-semibold text-[11px] text-ink-muted">
                Marcação {menuMark.isAutoSuggested ? '· sugestão automática' : ''}
              </Text>
              {menuMark.isAutoSuggested ? (
                <MenuItem
                  label="Aceitar sugestão"
                  color="#047857"
                  icon={CircleDot}
                  onPress={() => {
                    editor.acceptSuggestion(menuMark.id);
                    setMenu(null);
                  }}
                />
              ) : null}
              <MenuItem
                label="Trocar para Reagente"
                color={colors.dab}
                icon={CircleDot}
                onPress={() => {
                  editor.setMarkLabel(menuMark.id, 'reagente');
                  setMenu(null);
                }}
              />
              <MenuItem
                label="Trocar para Não reagente"
                color={colors.hema}
                icon={CircleDot}
                onPress={() => {
                  editor.setMarkLabel(menuMark.id, 'nao_reagente');
                  setMenu(null);
                }}
              />
              <View className="my-1 h-px bg-line-soft" />
              <MenuItem
                label="Excluir marcação"
                color={colors.danger}
                icon={Trash2}
                onPress={() => {
                  editor.removeMark(menuMark.id);
                  setMenu(null);
                }}
              />
            </View>
          </>
        ) : null}
      </View>

      {/* Aside de anotação no desktop (node 14:742 no Figma) */}
      {sidePanel ? (
        <View className="w-[310px] border-l border-line bg-white">
          <View className="flex-row items-baseline justify-between border-b border-line-soft px-5 py-4">
            <Text className="font-sans-black text-[20px] text-ink">Anotação</Text>
            <SaveIndicator status={editor.saveStatus} version={editor.activeVersion} offline={!isOnline} />
          </View>
          <ScrollView contentContainerClassName="p-5">{panel}</ScrollView>
          <View className="flex-row gap-2.5 border-t border-line-soft px-5 py-4">
            <Button label="Salvar versão" variant="outline" size="sm" className="min-h-[44px] flex-1" onPress={() => editor.save()} />
            <Button label="Finalizar" size="sm" className="min-h-[44px] flex-1" onPress={() => setFinalizeOpen(true)} />
          </View>
        </View>
      ) : null}

      <Dialog
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        variant="sheet"
        title="Anotação"
        footer={
          <>
            <Button label="Salvar versão" variant="outline" onPress={() => editor.save()} />
            <Button
              label="Finalizar"
              onPress={() => {
                setSheetOpen(false);
                setFinalizeOpen(true);
              }}
            />
          </>
        }
      >
        {panel}
      </Dialog>

      {/* Dialog Finalizar análise? (node 14:4646 no Figma) */}
      <Dialog
        visible={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        title="Finalizar análise?"
        subtitle={`${image.code} · versão final ${editor.activeVersion + 1}`}
        maxWidth={560}
        footer={
          <>
            <Button label="Voltar e editar" variant="neutral" onPress={() => setFinalizeOpen(false)} />
            <Button label="Finalizar e enviar" loading={editor.saveStatus === 'saving'} onPress={finalize} />
          </>
        }
      >
        <Text className="font-sans text-[14px] leading-[21px] text-ink-muted">
          Suas marcações serão congeladas e entram na comparação cega. Depois disso, não é possível editar.
        </Text>
        <View className="flex-row flex-wrap gap-6 rounded-[12px] border border-line bg-surface-subtle p-4">
          <View className="min-w-[80px] gap-1">
            <Text className="font-sans text-[12px] text-ink-muted">Ki-67</Text>
            <Text className="font-sans-black text-[20px] text-ink">{formatKi67(ki67)}</Text>
          </View>
          <View className="min-w-[80px] gap-1">
            <Text className="font-sans text-[12px] text-ink-muted">Reagentes</Text>
            <Text className="font-sans-bold text-[18px] text-ink">{counts.reagents}</Text>
          </View>
          <View className="min-w-[80px] gap-1">
            <Text className="font-sans text-[12px] text-ink-muted">Não reag.</Text>
            <Text className="font-sans-bold text-[18px] text-ink">{counts.nonReagents}</Text>
          </View>
          <View className="min-w-[80px] gap-1">
            <Text className="font-sans text-[12px] text-ink-muted">Total</Text>
            <Text className="font-sans-bold text-[18px] text-ink">{counts.total}</Text>
          </View>
        </View>
      </Dialog>

      {/* Conflito entre aparelhos (02-arquitetura.md §6.4) */}
      <Dialog
        visible={!!editor.conflict}
        onClose={() => undefined}
        title="Esta análise foi salva em outro aparelho"
        subtitle={`Versão no servidor: ${editor.conflict?.serverVersion ?? ''} · sua base: ${editor.activeVersion}`}
        footer={
          <>
            <Button label="Usar versão do servidor" variant="neutral" onPress={() => editor.resolveConflict('server')} />
            <Button label="Manter minhas marcações" onPress={() => editor.resolveConflict('mine')} />
          </>
        }
      >
        <Text className="font-sans text-[14px] leading-5 text-ink-muted">
          Nada se perde: se você mantiver suas marcações, elas viram uma nova versão e a versão do outro aparelho continua no histórico.
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
          if (ok) showToast(`Versão restaurada: Nova versão criada a partir da versão ${n}.`);
          return ok;
        }}
      />
    </View>
  );
}

function MenuItem({ label, color, icon: Icon, onPress }: { label: string; color: string; icon: LucideIcon; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="min-h-10 flex-row items-center gap-2 px-3.5 py-2 web:hover:bg-surface-subtle">
      <Icon size={14} color={color} />
      <Text style={{ color }} className="font-sans-semibold text-[13px]">
        {label}
      </Text>
    </Pressable>
  );
}
