/**
 * Estado do editor de anotação (02-arquitetura.md §2: "Zustand: sessão e editor").
 * Guarda as marcações abertas, ferramenta e label ativas, desfazer/refazer, o
 * status de salvamento e o rascunho local (RNF-05).
 *
 * Modo real: abre pela RPC open_analysis (que barra análises de outros e grava
 * ANALISE_ABERTA), salva com a "versão base" para detectar outro aparelho
 * salvando ao mesmo tempo (§6.4) e guarda o rascunho no aparelho até o servidor
 * confirmar. Modo demo: usa o appStore em memória.
 */
import { create } from 'zustand';

import { DATA_MODE } from '@/data/mode';
import * as repo from '@/data/repo';
import { initialPreAnnotation, preMarkNonReagents } from '@/features/anotacao/preAnnotation';
import { getSignedImageUrl } from '@/services/cloudflare';
import { isNetworkError } from '@/services/supabase';
import { useAppStore } from '@/state/appStore';
import { clearDraft, readDraft, writeDraft } from '@/storage/drafts';
import type { AnnotationMark, MarkLabel, MarkType, RpcFailure, SaveVersionResult } from '@/types';

export type Tool = MarkType | 'select';
export type SaveStatus = 'saved' | 'saving' | 'unsaved';

const UNDO_LIMIT = 100; // RF-15 pede pelo menos 50
const real = DATA_MODE === 'supabase';

interface EditorState {
  imageId: string | null;
  analysisId: string | null;
  imageUrl: string | null;
  loading: boolean;
  loadError: string | null;
  marks: AnnotationMark[];
  observation: string;
  activeVersion: number;
  readOnly: boolean;
  /** Pré-anotação guardada da imagem (fonte do botão "pré-marcar não reagentes"). */
  preAnnotation: AnnotationMark[];
  undoStack: AnnotationMark[][];
  redoStack: AnnotationMark[][];
  saveStatus: SaveStatus;
  dirty: boolean;
  restoredDraft: boolean;
  /** Outro aparelho salvou antes (VERSION_CONFLICT). */
  conflict: { serverVersion: number } | null;
  tool: Tool;
  activeLabel: MarkLabel;
  selectedMarkId: string | null;

  load: (imageId: string) => Promise<void>;
  setTool: (tool: Tool) => void;
  setActiveLabel: (label: MarkLabel) => void;
  selectMark: (id: string | null) => void;
  addMark: (mark: Omit<AnnotationMark, 'id' | 'createdAt' | 'isAutoSuggested'>) => void;
  replaceMark: (mark: AnnotationMark) => void;
  setMarkLabel: (id: string, label: MarkLabel) => void;
  acceptSuggestion: (id: string) => void;
  removeMark: (id: string) => void;
  setObservation: (text: string) => void;
  preAnnotate: () => number;
  undo: () => void;
  redo: () => void;
  save: () => Promise<boolean>;
  finalize: () => Promise<boolean>;
  restore: (versionNumber: number) => Promise<boolean>;
  resolveConflict: (keep: 'mine' | 'server') => Promise<void>;
}

let markCounter = 0;
const newMarkId = () => `mk_${Date.now().toString(36)}_${(markCounter++).toString(36)}`;
let draftTimer: ReturnType<typeof setTimeout> | undefined;

const userId = () => useAppStore.getState().currentUser?.id ?? '';
const isFailure = (r: SaveVersionResult | RpcFailure): r is RpcFailure => r.ok === false;

export const useEditorStore = create<EditorState>()((set, get) => {
  // Grava o rascunho no aparelho logo depois de cada mudança (RNF-05).
  const persistDraft = () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const { imageId, marks, observation, activeVersion, readOnly, dirty } = get();
      if (imageId && !readOnly && dirty) void writeDraft(userId(), imageId, { baseVersion: activeVersion, marks, observation });
    }, 400);
  };

  // Toda mudança nas marcações passa por aqui: entra na pilha de desfazer.
  const commit = (marks: AnnotationMark[]) => {
    const { marks: previous, undoStack, readOnly } = get();
    if (readOnly) return;
    set({ marks, undoStack: [...undoStack, previous].slice(-UNDO_LIMIT), redoStack: [], dirty: true, saveStatus: 'unsaved' });
    persistDraft();
  };

  // Atualiza a análise na lista do appStore depois de um salvamento real.
  const patchAnalysis = async (version: number, finalized = false) => {
    const { analysisId, marks, observation } = get();
    if (!analysisId) return;
    const history = await repo.loadHistory(analysisId).catch(() => null);
    useAppStore.setState((s) => ({
      analyses: s.analyses.map((a) =>
        a.id === analysisId
          ? { ...a, currentVersion: version, marks, observation, lastSavedAt: new Date().toISOString(), status: finalized ? 'finalizada' : 'em_andamento', finalizedAt: finalized ? new Date().toISOString() : a.finalizedAt, history: history ?? a.history }
          : a,
      ),
    }));
  };

  const afterServerResult = async (res: SaveVersionResult | RpcFailure, finalized = false): Promise<boolean> => {
    const { imageId } = get();
    if (isFailure(res)) {
      if (res.error === 'VERSION_CONFLICT') set({ conflict: { serverVersion: res.current_version ?? 0 }, saveStatus: 'unsaved' });
      else {
        set({ saveStatus: 'unsaved' });
        useAppStore.getState().showToast('Análise não encontrada para este usuário.');
      }
      return false;
    }
    set({ activeVersion: res.version_number, saveStatus: 'saved', dirty: false, conflict: null, readOnly: finalized || get().readOnly });
    if (imageId) await clearDraft(userId(), imageId);
    await patchAnalysis(res.version_number, finalized);
    return true;
  };

  const networkAware = async (fn: () => Promise<boolean>): Promise<boolean> => {
    try {
      return await fn();
    } catch (e) {
      set({ saveStatus: 'unsaved' });
      // Sem rede: o rascunho já está no aparelho e o autosave tenta de novo quando a conexão voltar.
      if (!isNetworkError(e)) useAppStore.getState().showToast(e instanceof Error ? e.message : 'Erro ao salvar.');
      return false;
    }
  };

  return {
    imageId: null,
    analysisId: null,
    imageUrl: null,
    loading: false,
    loadError: null,
    marks: [],
    observation: '',
    activeVersion: 0,
    readOnly: false,
    preAnnotation: [],
    undoStack: [],
    redoStack: [],
    saveStatus: 'saved',
    dirty: false,
    restoredDraft: false,
    conflict: null,
    tool: 'point',
    activeLabel: 'reagente',
    selectedMarkId: null,

    load: async (imageId) => {
      const app = useAppStore.getState();
      const analysis = app.analyses.find((a) => a.imageId === imageId && a.evaluatorId === app.currentUser?.id);
      const image = app.images.find((i) => i.id === imageId);
      const base = { imageId, undoStack: [], redoStack: [], saveStatus: 'saved' as SaveStatus, dirty: false, selectedMarkId: null, conflict: null, restoredDraft: false, loadError: null };

      if (!real) {
        set({
          ...base,
          analysisId: analysis?.id ?? null,
          imageUrl: image?.imageUrl ?? null,
          marks: analysis ? analysis.marks : initialPreAnnotation(imageId), // RF-18
          observation: analysis?.observation ?? '',
          activeVersion: analysis?.currentVersion ?? 0,
          readOnly: analysis?.status === 'finalizada',
          preAnnotation: [],
          loading: false,
        });
      } else {
        if (!analysis) {
          set({ ...base, loading: false, loadError: 'Análise não encontrada.' });
          return;
        }
        set({ ...base, analysisId: analysis.id, loading: true, marks: [], imageUrl: null });
        try {
          const res = await repo.openAnalysis(analysis.id);
          if (!res.ok) {
            set({ loading: false, loadError: 'Análise não encontrada.' });
            return;
          }
          const [url, pre, history] = await Promise.all([
            getSignedImageUrl(res.image.image_version_id, 'preview').catch(() => null),
            res.pre_annotation ? Promise.resolve(res.pre_annotation as unknown as AnnotationMark[]) : repo.loadPreAnnotation(res.image.image_version_id).catch(() => []),
            repo.loadHistory(analysis.id).catch(() => analysis.history),
          ]);
          useAppStore.setState((s) => ({ analyses: s.analyses.map((a) => (a.id === analysis.id ? { ...a, history } : a)) }));
          set({
            imageUrl: url,
            marks: (res.latest_version?.marks as unknown as AnnotationMark[] | undefined) ?? pre, // RF-18: abre pré-anotada
            observation: res.latest_version?.observation ?? '',
            activeVersion: res.analysis.current_version,
            readOnly: res.analysis.read_only,
            preAnnotation: pre,
            loading: false,
          });
        } catch (e) {
          set({ loading: false, loadError: isNetworkError(e) ? 'Sem conexão: abrir uma imagem exige rede (RNF-05).' : e instanceof Error ? e.message : 'Erro ao abrir a análise.' });
          return;
        }
      }

      // Rascunho guardado no aparelho e ainda não confirmado pelo servidor.
      const draft = await readDraft(userId(), imageId);
      if (draft && !get().readOnly && draft.baseVersion === get().activeVersion) {
        set({ marks: draft.marks, observation: draft.observation, dirty: true, saveStatus: 'unsaved', restoredDraft: true });
      }
    },

    setTool: (tool) => set({ tool, selectedMarkId: null }),
    setActiveLabel: (activeLabel) => set({ activeLabel }),
    selectMark: (selectedMarkId) => set({ selectedMarkId }),

    addMark: (mark) =>
      commit([...get().marks, { ...mark, id: newMarkId(), isAutoSuggested: false, origin: 'manual', createdAt: new Date().toISOString() }]),
    replaceMark: (mark) =>
      commit(get().marks.map((m) => (m.id === mark.id ? (m.isAutoSuggested || m.origin === 'pre_anotacao' ? { ...mark, isAutoSuggested: false, origin: 'pre_anotacao_editada' } : mark) : m))),
    setMarkLabel: (id, label) =>
      commit(get().marks.map((m) => (m.id !== id ? m : { ...m, label, ...(m.origin?.startsWith('pre_') ? { isAutoSuggested: false, origin: 'pre_anotacao_editada' as const } : {}) }))),
    acceptSuggestion: (id) => commit(get().marks.map((m) => (m.id === id ? { ...m, isAutoSuggested: false } : m))),
    removeMark: (id) => {
      commit(get().marks.filter((m) => m.id !== id));
      set({ selectedMarkId: null });
    },
    setObservation: (observation) => {
      if (get().readOnly) return;
      set({ observation: observation.slice(0, 2000), dirty: true, saveStatus: 'unsaved' });
      persistDraft();
    },
    preAnnotate: () => {
      const { imageId, marks, preAnnotation } = get();
      if (!imageId) return 0;
      const added = real
        ? preAnnotation.filter((p) => p.label === 'nao_reagente' && !marks.some((m) => m.id === p.id || Math.hypot(m.x - p.x, m.y - p.y) < 1))
            .map((p) => ({ ...p, isAutoSuggested: true, origin: 'pre_anotacao' as const }))
        : preMarkNonReagents(imageId, marks);
      if (added.length) commit([...marks, ...added]);
      return added.length;
    },
    undo: () => {
      const { undoStack, redoStack, marks } = get();
      const previous = undoStack[undoStack.length - 1];
      if (!previous) return;
      set({ marks: previous, undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, marks], dirty: true, saveStatus: 'unsaved' });
      persistDraft();
    },
    redo: () => {
      const { undoStack, redoStack, marks } = get();
      const next = redoStack[redoStack.length - 1];
      if (!next) return;
      set({ marks: next, redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, marks], dirty: true, saveStatus: 'unsaved' });
      persistDraft();
    },

    save: async () => {
      const { imageId, analysisId, marks, observation, readOnly, activeVersion, conflict } = get();
      if (!imageId || readOnly || conflict) return false;
      set({ saveStatus: 'saving' });
      if (real) {
        if (!analysisId) return false;
        return networkAware(async () => {
          const ok = await afterServerResult(await repo.saveVersion(analysisId, activeVersion, marks, observation));
          // Se mudou algo durante o salvamento, continua "não salvo" para o próximo autosave.
          if (ok && (get().marks !== marks || get().observation !== observation)) set({ dirty: true, saveStatus: 'unsaved' });
          return ok;
        });
      }
      const result = await useAppStore.getState().saveAnalysis(imageId, marks, observation);
      const changed = get().marks !== marks || get().observation !== observation;
      set(result.ok ? { activeVersion: result.version, saveStatus: changed ? 'unsaved' : 'saved', dirty: changed } : { saveStatus: 'unsaved' });
      if (!result.ok) useAppStore.getState().showToast(result.error);
      return result.ok;
    },
    finalize: async () => {
      const { imageId, analysisId, marks, observation, activeVersion } = get();
      if (!imageId) return false;
      set({ saveStatus: 'saving' });
      if (real) {
        if (!analysisId) return false;
        return networkAware(async () => {
          const ok = await afterServerResult(await repo.finalizeVersion(analysisId, activeVersion, marks, observation), true);
          if (ok) await useAppStore.getState().refresh();
          return ok;
        });
      }
      const result = await useAppStore.getState().finalizeAnalysis(imageId, marks, observation);
      if (!result.ok) {
        set({ saveStatus: 'unsaved' });
        useAppStore.getState().showToast(result.error);
        return false;
      }
      set({ activeVersion: result.version, saveStatus: 'saved', dirty: false, readOnly: true });
      return true;
    },
    restore: async (versionNumber) => {
      const { imageId, analysisId, activeVersion } = get();
      if (!imageId) return false;
      if (real) {
        if (!analysisId) return false;
        return networkAware(async () => {
          const res = await repo.restoreVersion(analysisId, versionNumber, activeVersion);
          if (isFailure(res)) {
            useAppStore.getState().showToast(res.error === 'VERSION_CONFLICT' ? 'Outro aparelho salvou antes. Recarregue a análise.' : 'Versão não encontrada.');
            return false;
          }
          await clearDraft(userId(), imageId);
          await get().load(imageId);
          return true;
        });
      }
      const result = await useAppStore.getState().restoreVersion(imageId, versionNumber);
      if (!result.ok) {
        useAppStore.getState().showToast(result.error);
        return false;
      }
      set({ marks: result.marks, observation: result.observation, activeVersion: result.version, undoStack: [], redoStack: [], saveStatus: 'saved', dirty: false });
      return true;
    },
    resolveConflict: async (keep) => {
      const { conflict, imageId } = get();
      if (!conflict || !imageId) return;
      if (keep === 'mine') {
        // Salva as minhas marcações como nova versão por cima da versão do outro aparelho (nada é perdido: ela fica no histórico).
        set({ conflict: null, activeVersion: conflict.serverVersion });
        await get().save();
      } else {
        await clearDraft(userId(), imageId);
        await get().load(imageId);
      }
    },
  };
});
