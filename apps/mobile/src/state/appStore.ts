/**
 * Estado global do app (porte do AppContext do protótipo para Zustand).
 *
 * Dois modos (src/data/mode.ts):
 *  - 'supabase': cada ação chama o banco (RPCs de supabase/migrations) ou uma
 *    Edge Function e depois recarrega os dados do papel ativo (refresh). O banco
 *    aplica o RLS e grava o log de auditoria com hash SHA-256 encadeado.
 *  - 'demo': dados de src/data/mockData.ts só na memória (sem backend).
 * As telas não mudam entre os modos.
 *
 * No modo demo, as regras (RN-07, RN-08, RF-29...) são repetidas aqui só para
 * dar retorno na tela; no modo real quem garante é o banco.
 */
import type { DocumentPickerAsset } from 'expo-document-picker';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { toDbRoles } from '@/data/mappers';
import {
  INITIAL_ANALYSES,
  INITIAL_AUDIT_LOGS,
  INITIAL_BATCHES,
  INITIAL_IMAGES,
  INITIAL_PROJECTS,
  INITIAL_USERS,
} from '@/data/mockData';
import { DATA_MODE } from '@/data/mode';
import * as repo from '@/data/repo';
import { computePreAnnotationWeb } from '@/features/anotacao/colorThreshold';
import { sha256Hex, uploadImagesToBatch } from '@/services/cloudflare';
import { deviceLabel } from '@/services/device';
import { readAssetBytes } from '@/services/files';
import { invokeFunction, rpc, supabase } from '@/services/supabase';
import { clearAllDrafts } from '@/storage/drafts';
import { ImageFormatError, sanitizeImage } from '@/utils/imageMetadata';
import { env } from '@/config/env';
import type {
  AnalysisVersion,
  AnnotationMark,
  AuditLog,
  Batch,
  ConsensusResult,
  EvaluatorAnalysis,
  ImageItem,
  Project,
  User,
  UserRole,
} from '@/types';
import { calculateKi67Index, countMarks } from '@/utils/ki67';

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export const ROLE_ORDER: UserRole[] = ['Admin', 'Gestor', 'Avaliador', 'Validador'];

/** Rota inicial de cada papel (Expo Router). */
export function roleHome(role: UserRole) {
  switch (role) {
    case 'Avaliador':
      return '/avaliador' as const;
    case 'Validador':
      return '/validador' as const;
    case 'Gestor':
      return '/gestor' as const;
    case 'Admin':
      return '/admin/usuarios' as const;
  }
}

// Hash de demonstração (FNV-1a). Na Fase 4 o hash SHA-256 real vem do banco.
function demoHash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 ^ text.charCodeAt(text.length - 1 - i), 2246822519) >>> 0;
  }
  return `0x${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export interface NewImageInput {
  code?: string;
  imageUrl: string;
  width: number;
  height: number;
  sha256: string;
  organ?: string;
  opticalMagnification?: string;
}

export interface UploadSummary {
  uploaded: string[];
  duplicates: string[];
  rejected: { filename: string; reason: string }[];
  sanitized: number;
}

const real = DATA_MODE === 'supabase';
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Erro inesperado.');

const TWO_FACTOR_ERRORS: Record<string, string> = {
  INVALID_CODE: 'Código incorreto.',
  EXPIRED: 'O código expirou. Toque em "Reenviar código".',
  TOO_MANY_ATTEMPTS: 'Muitas tentativas com este código. Peça um novo.',
  NO_CHALLENGE: 'Nenhum código ativo para esta sessão. Toque em "Reenviar código".',
  INACTIVE: 'Usuário desativado.',
};

interface AppState {
  // Sessão
  booting: boolean;
  currentUser: User | null;
  pendingUserId: string | null; // senha conferida, aguardando o código 2FA
  activeRole: UserRole;
  activeProjectId: string | null; // projeto em foco do gestor
  isOnline: boolean;
  toastMessage: string | null;

  // Dados
  users: User[];
  projects: Project[];
  batches: Batch[];
  images: ImageItem[];
  analyses: EvaluatorAnalysis[];
  auditLogs: AuditLog[];
  imageHashes: Record<string, string>; // sha256 → imageId (detecção de duplicadas)
  validationIndices: Record<string, number[]>; // imageId → índices finais (fila do validador)
  imageVersions: Record<string, string>; // imageId → imageVersionId
  loading: boolean;

  // Navegação auxiliar
  lastAnnotationImageId: string | null;
  lastComparisonImageId: string | null;

  // Sessão e utilidades
  showToast: (message: string) => void;
  setIsOnline: (online: boolean) => void;
  setActiveRole: (role: UserRole) => void;
  setActiveProjectId: (projectId: string) => void;
  setLastAnnotationImage: (imageId: string) => void;
  setLastComparisonImage: (imageId: string) => void;
  addAuditLog: (action: string, category: AuditLog['category'], details?: string, imageId?: string, batchId?: string) => void;

  /** Recarrega os dados do papel ativo (modo real). */
  refresh: () => Promise<void>;
  /** Ao abrir o app: retoma a sessão salva se o 2FA dela já foi confirmado. */
  restoreSession: () => Promise<void>;

  // Autenticação (RF-01 a RF-03)
  login: (email: string, password: string) => Promise<Result<{ twoFactorRequired: boolean; role?: UserRole }>>;
  verify2FA: (code: string) => Promise<Result<{ role: UserRole }>>;
  resend2FA: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (password: string) => Promise<Result>;
  logout: () => Promise<void>;

  // Avaliador (RF-21, RF-33, RF-34)
  saveAnalysis: (imageId: string, marks: AnnotationMark[], observation: string) => Promise<Result<{ version: number }>>;
  finalizeAnalysis: (imageId: string, marks: AnnotationMark[], observation: string) => Promise<Result<{ version: number }>>;
  restoreVersion: (imageId: string, versionNumber: number) => Promise<Result<{ version: number; marks: AnnotationMark[]; observation: string }>>;

  // Validador (RF-32)
  submitConsensus: (data: {
    imageId: string;
    adoptedAnalysisCode: string;
    /** Letra da análise adotada; ausente = consenso (mediana). */
    adoptedBlindCode?: string;
    justification: string;
    consensusKi67: number;
    reagentsCount: number;
    nonReagentsCount: number;
    iccScore: number;
    divergenceDeltaPP: number;
    spatialAgreementPct: number;
  }) => Promise<Result>;

  // Gestor (RF-08 a RF-10, RF-29, RF-40)
  /** `requestId`: chave gerada ao abrir o formulário; reenviar com a mesma chave não duplica. */
  createBatch: (projectId: string, name: string, evaluatorsPerImage: number, description: string, requestId: string) => Promise<Result>;
  registerImages: (batchId: string, files: NewImageInput[]) => Promise<{ uploaded: string[]; duplicates: string[] }>;
  /** Higieniza, calcula o SHA-256 e envia (modo real: R2 + register_image + pré-anotação). */
  uploadImages: (batchId: string, assets: DocumentPickerAsset[], onProgress?: (text: string) => void) => Promise<UploadSummary>;
  assignEvaluators: (imageIds: string[], evaluatorIds: string[]) => Promise<Result<{ created: number }>>;

  // Admin (RF-04, RF-06, RF-07, RF-09)
  createUser: (data: { name: string; email: string; institution?: string; roles: UserRole[] }) => Promise<Result>;
  toggleUserActive: (userId: string) => Promise<Result>;
  updateUserRoles: (userId: string, roles: UserRole[]) => Promise<Result>;
  createProject: (name: string, description: string, managerId: string, requestId: string) => Promise<Result>;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useAppStore = create<AppState>()((set, get) => {
  const me = () => get().currentUser;

  const versionFrom = (number: number, marks: AnnotationMark[], observation: string): AnalysisVersion => {
    const counts = countMarks(marks);
    return {
      versionNumber: number,
      createdAt: new Date().toISOString(),
      savedBy: deviceLabel(),
      reagentsCount: counts.reagents,
      nonReagentsCount: counts.nonReagents,
      ki67Index: calculateKi67Index(counts.reagents, counts.nonReagents),
      marks,
      observation,
    };
  };

  // Grava uma nova versão na análise do usuário (cria a análise se preciso).
  const appendVersion = (imageId: string, marks: AnnotationMark[], observation: string, finalize: boolean) => {
    const user = me();
    if (!user) return { ok: false as const, error: 'Sessão expirada.' };
    const image = get().images.find((i) => i.id === imageId);
    if (!image || !image.assignedEvaluatorIds.includes(user.id)) {
      get().addAuditLog('ACESSO_NEGADO', 'security', `Tentativa de salvar análise da imagem ${imageId}.`, imageId);
      return { ok: false as const, error: 'Imagem não encontrada.' };
    }
    const existing = get().analyses.find((a) => a.imageId === imageId && a.evaluatorId === user.id);
    if (existing?.status === 'finalizada') return { ok: false as const, error: 'Análise finalizada não aceita edição.' };

    const number = (existing?.currentVersion ?? 0) + 1;
    const now = new Date().toISOString();
    const version = versionFrom(number, marks, observation);
    const letter = String.fromCharCode(65 + image.assignedEvaluatorIds.indexOf(user.id));
    const analysis: EvaluatorAnalysis = {
      id: existing?.id ?? newId('an'),
      imageId,
      evaluatorId: user.id,
      evaluatorCode: existing?.evaluatorCode ?? `Análise ${letter}`,
      status: finalize ? 'finalizada' : 'em_andamento',
      currentVersion: number,
      lastSavedAt: now,
      finalizedAt: finalize ? now : undefined,
      marks,
      observation,
      history: [version, ...(existing?.history ?? [])],
      hashSHA256: demoHash(JSON.stringify(marks) + observation + number),
    };

    set((s) => ({
      analyses: existing ? s.analyses.map((a) => (a.id === existing.id ? analysis : a)) : [...s.analyses, analysis],
      images: s.images.map((img) => {
        if (img.id !== imageId) return img;
        if (!finalize) return img.status === 'pendente' ? { ...img, status: 'em_andamento' } : img;
        const finalized = s.analyses.filter((a) => a.imageId === imageId && a.status === 'finalizada' && a.evaluatorId !== user.id).length + 1;
        if (finalized < img.requiredEvaluatorsCount) return img;
        // RN-05: só vai para comparação com as N análises finalizadas. Com N = 1 a imagem já termina.
        return { ...img, status: img.requiredEvaluatorsCount >= 2 ? 'pronta_para_validacao' : 'validada' };
      }),
    }));
    get().addAuditLog(
      finalize ? 'ANALISE_FINALIZADA' : 'ANALISE_SALVA',
      'annotation',
      `${image.code} · versão v${number}.`,
      imageId,
      image.batchId,
    );
    return { ok: true as const, version: number };
  };

  // Modo real: depois do 2FA (ou ao retomar a sessão), carrega o perfil e os dados.
  const finishLogin = async (): Promise<Result<{ role: UserRole }>> => {
    const session = await repo.loadMySession();
    if (!session.authenticated || !session.user_id || !session.is_active) {
      await supabase.auth.signOut();
      return { ok: false, error: 'Usuário desativado ou sessão inválida.' };
    }
    const user = (await repo.loadProfile(session.user_id)) ?? {
      id: session.user_id,
      name: session.name ?? '',
      email: session.email ?? '',
      roles: [],
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    if (!user.roles.length) {
      await supabase.auth.signOut();
      return { ok: false, error: 'Sua conta ainda não tem papel atribuído. Fale com o administrador.' };
    }
    const role = ROLE_ORDER.find((r) => user.roles.includes(r)) ?? user.roles[0];
    set({ currentUser: user, pendingUserId: null, activeRole: role, activeProjectId: null });
    await get().refresh();
    return { ok: true, role };
  };

  const emptyData = { users: [], projects: [], batches: [], images: [], analyses: [], auditLogs: [], validationIndices: {}, imageVersions: {} };

  /** Modo real: executa a ação no banco, recarrega os dados e traduz erros em { ok: false }. */
  const remote = async <T extends object = object>(fn: () => Promise<T | { ok: false; error?: string } | void>): Promise<Result<T>> => {
    try {
      const res = await fn();
      if (res && 'ok' in res && res.ok === false) {
        return { ok: false, error: res.error === 'NOT_FOUND' || res.error === 'FORBIDDEN' ? 'Acesso negado ou registro inexistente.' : (res.error ?? 'Operação recusada.') };
      }
      await get().refresh();
      return { ok: true, ...((res ?? {}) as T) };
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  };

  return {
    booting: real,
    currentUser: null,
    pendingUserId: null,
    activeRole: 'Avaliador',
    activeProjectId: null,
    isOnline: true,
    toastMessage: null,
    users: real ? [] : INITIAL_USERS,
    projects: real ? [] : INITIAL_PROJECTS,
    batches: real ? [] : INITIAL_BATCHES,
    images: real ? [] : INITIAL_IMAGES,
    analyses: real ? [] : INITIAL_ANALYSES,
    auditLogs: real ? [] : INITIAL_AUDIT_LOGS,
    imageHashes: {},
    validationIndices: {},
    imageVersions: {},
    loading: false,
    lastAnnotationImageId: null,
    lastComparisonImageId: null,

    refresh: async () => {
      const user = me();
      if (!real || !user) return;
      set({ loading: true });
      try {
        const data = await repo.loadRoleData(get().activeRole, user);
        set({ ...data, loading: false });
      } catch (e) {
        set({ loading: false });
        get().showToast(`Não foi possível carregar os dados: ${errorText(e)}`);
      }
    },
    restoreSession: async () => {
      if (!real) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const session = await repo.loadMySession();
        // Sessão com 2FA pendente não é retomada: volta para o login.
        if (session.authenticated && session.is_active && session.two_factor_verified !== false) await finishLogin();
      } catch {
        // sem rede ou sessão expirada: segue para o login
      } finally {
        set({ booting: false });
      }
    },

    showToast: (message) => {
      clearTimeout(toastTimer);
      set({ toastMessage: message });
      toastTimer = setTimeout(() => set({ toastMessage: null }), 4000);
    },
    setIsOnline: (isOnline) => set({ isOnline }),
    setActiveRole: (activeRole) => {
      set({ activeRole, ...(real ? emptyData : {}) });
      get().addAuditLog('PERFIL_TROCADO', 'auth', `Papel ativo: ${activeRole}.`);
      void get().refresh();
    },
    setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
    setLastAnnotationImage: (lastAnnotationImageId) => set({ lastAnnotationImageId }),
    setLastComparisonImage: (lastComparisonImageId) => set({ lastComparisonImageId }),

    addAuditLog: (action, category, details, imageId, batchId) => {
      if (real) {
        // Ações críticas já são registradas pelas RPCs; aqui só as do próprio app.
        const projectId = action === 'EXPORTACAO' ? (get().activeProjectId ?? get().projects.find((p) => p.managerId === me()?.id)?.id) : undefined;
        void repo.logEvent(action, category, details, { imageId, batchId, projectId });
        return;
      }
      const user = me();
      const previous = get().auditLogs[0]?.hashSHA256 ?? '';
      const timestamp = new Date().toISOString();
      const log: AuditLog = {
        id: newId('log'),
        userId: user?.id ?? 'system',
        userName: user?.name ?? 'Sistema',
        action,
        category,
        timestamp,
        ipAddress: '—', // o banco registra o IP real (Fase 4)
        device: deviceLabel(),
        imageId,
        batchId,
        details,
        hashSHA256: demoHash(previous + action + timestamp + (details ?? '')),
      };
      set((s) => ({ auditLogs: [log, ...s.auditLogs] }));
    },

    // --- Autenticação -----------------------------------------------------------
    login: async (email, password) => {
      if (real) {
        try {
          // A Edge Function confere a senha, limita tentativas e envia o código 2FA.
          const res = await invokeFunction<{ access_token: string; refresh_token: string; two_factor_required: boolean }>('auth-login', {
            email,
            password,
            device: deviceLabel(),
          });
          const { data, error } = await supabase.auth.setSession({ access_token: res.access_token, refresh_token: res.refresh_token });
          if (error || !data.user) return { ok: false, error: 'Não foi possível iniciar a sessão.' };
          set({ pendingUserId: data.user.id });
          if (!res.two_factor_required) {
            await rpc('register_login', { p_device: deviceLabel() });
            const done = await finishLogin();
            return done.ok ? { ok: true, twoFactorRequired: false, role: done.role } : done;
          }
          return { ok: true, twoFactorRequired: true };
        } catch (e) {
          return { ok: false, error: errorText(e) };
        }
      }
      const user = get().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      // Mensagem genérica: não revela se o e-mail existe (RF-01)
      if (!user || !user.isActive || !password) return { ok: false, error: 'E-mail ou senha inválidos' };
      set({ pendingUserId: user.id });
      return { ok: true, twoFactorRequired: true };
    },
    verify2FA: async (code) => {
      if (real) {
        try {
          const res = await rpc<{ ok: boolean; error?: string; attempts_left?: number }>('verify_two_factor_code', { p_code: code, p_device: deviceLabel() });
          if (!res.ok) {
            const base = TWO_FACTOR_ERRORS[res.error ?? ''] ?? 'Código de verificação incorreto ou expirado.';
            return { ok: false, error: res.attempts_left !== undefined ? `${base} Restam ${res.attempts_left} tentativa(s).` : base };
          }
          return await finishLogin();
        } catch (e) {
          return { ok: false, error: errorText(e) };
        }
      }
      const user = get().users.find((u) => u.id === get().pendingUserId);
      if (!user) return { ok: false, error: 'Sessão de login expirada. Entre novamente.' };
      if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Código de verificação incorreto ou expirado.' };
      const role = ROLE_ORDER.find((r) => user.roles.includes(r)) ?? user.roles[0];
      const managed = get().projects.find((p) => p.managerId === user.id);
      set({
        currentUser: { ...user, lastLogin: new Date().toISOString() },
        pendingUserId: null,
        activeRole: role,
        activeProjectId: managed?.id ?? null,
      });
      get().addAuditLog('LOGIN_OK', 'auth', '2FA validado com sucesso.');
      return { ok: true, role };
    },
    resend2FA: async () => {
      if (real) {
        try {
          await invokeFunction('auth-resend-2fa', {});
        } catch (e) {
          get().showToast(errorText(e));
          return;
        }
      }
      get().showToast('Novo código de verificação enviado para o seu e-mail institucional.');
    },
    requestPasswordReset: async (email) => {
      // A resposta na tela é a mesma para e-mail cadastrado ou não (RF-03).
      if (!real) return;
      const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/redefinir-senha` : undefined;
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    },
    resetPassword: async (password) => {
      if (password.length < 8) return { ok: false, error: 'A senha deve possuir no mínimo 8 caracteres.' };
      if (!/[A-Z]/.test(password) || !/\d/.test(password)) {
        return { ok: false, error: 'Use ao menos uma letra maiúscula e um número.' };
      }
      if (real) {
        // O link do e-mail abre uma sessão de recuperação (detectSessionInUrl na web).
        const { data } = await supabase.auth.getSession();
        if (!data.session) return { ok: false, error: 'Link inválido ou expirado. Peça um novo em "Esqueci a senha".' };
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return { ok: false, error: error.message };
        await supabase.auth.signOut({ scope: 'global' }); // encerra todas as sessões (RF-03)
      }
      return { ok: true };
    },
    logout: async () => {
      if (real) {
        await repo.logEvent('LOGOUT', 'auth', 'Usuário desconectado.'); // antes de encerrar a sessão
        await supabase.auth.signOut().catch(() => undefined);
        set(emptyData);
      } else {
        get().addAuditLog('LOGOUT', 'auth', 'Usuário desconectado.');
      }
      await clearAllDrafts(); // rascunhos só vivem até o logout (seção 8 dos requisitos)
      set({ currentUser: null, pendingUserId: null, lastAnnotationImageId: null, lastComparisonImageId: null });
    },

    // --- Avaliador ------------------------------------------------------------------
    saveAnalysis: async (imageId, marks, observation) => appendVersion(imageId, marks, observation, false),
    finalizeAnalysis: async (imageId, marks, observation) => appendVersion(imageId, marks, observation, true),
    restoreVersion: async (imageId, versionNumber) => {
      const user = me();
      const analysis = get().analyses.find((a) => a.imageId === imageId && a.evaluatorId === user?.id);
      const source = analysis?.history.find((v) => v.versionNumber === versionNumber);
      if (!analysis || !source) return { ok: false, error: 'Versão não encontrada.' };
      // Restaurar a versão k cria uma versão NOVA igual a k (RF-34).
      const result = appendVersion(imageId, source.marks, source.observation, false);
      if (!result.ok) return result;
      get().addAuditLog('VERSAO_RESTAURADA', 'annotation', `v${versionNumber} restaurada como v${result.version}.`, imageId);
      return { ok: true, version: result.version, marks: source.marks, observation: source.observation };
    },

    // --- Validador ------------------------------------------------------------------
    submitConsensus: async (data) => {
      if (real) {
        return remote(() =>
          repo.submitValidation({
            imageId: data.imageId,
            adoptedBlindCode: data.adoptedBlindCode,
            consensusKi67: data.consensusKi67,
            justification: data.justification,
            iccScore: data.iccScore,
            spatialAgreementPct: data.spatialAgreementPct,
          }),
        );
      }
      const user = me();
      const image = get().images.find((i) => i.id === data.imageId);
      if (!user || !image) return { ok: false, error: 'Imagem não encontrada.' };
      if (image.assignedEvaluatorIds.includes(user.id)) {
        return { ok: false, error: 'RN-08: você não pode validar uma imagem que também anotou.' };
      }
      if (image.status === 'validada') return { ok: false, error: 'Esta imagem já tem resultado validado.' };
      if (data.justification.trim().length < 10) return { ok: false, error: 'A justificativa técnica é obrigatória.' };
      const result: ConsensusResult = {
        id: newId('cons'),
        imageId: image.id,
        validatorId: user.id,
        validatorName: user.name,
        adoptedAnalysisCode: data.adoptedAnalysisCode,
        consensusKi67: data.consensusKi67,
        reagentsCount: data.reagentsCount,
        nonReagentsCount: data.nonReagentsCount,
        justification: data.justification.trim(),
        frozenAt: new Date().toISOString(),
        isImmutable: true,
        hashSHA256: demoHash(JSON.stringify(data)),
        iccScore: data.iccScore,
        divergenceDeltaPP: data.divergenceDeltaPP,
        spatialAgreementPct: data.spatialAgreementPct,
      };
      set((s) => ({
        images: s.images.map((img) => (img.id === image.id ? { ...img, status: 'validada', consensusResult: result } : img)),
      }));
      get().addAuditLog('VALIDACAO_REGISTRADA', 'validation', `${image.code} · Ki-67 ${data.consensusKi67.toFixed(1)}% · ${data.adoptedAnalysisCode}.`, image.id);
      return { ok: true };
    },

    // --- Gestor ---------------------------------------------------------------------
    createBatch: async (projectId, name, evaluatorsPerImage, description, requestId) => {
      const user = me();
      if (!name.trim()) return { ok: false, error: 'O nome do lote é obrigatório.' };
      if (evaluatorsPerImage < 1 || evaluatorsPerImage > 26) return { ok: false, error: 'N deve ficar entre 1 e 26.' };
      if (real) return remote(() => repo.createBatch(projectId, name.trim(), evaluatorsPerImage, description.trim(), requestId));
      const batch: Batch = {
        id: newId('batch'),
        projectId,
        name: name.trim(),
        evaluatorsPerImage,
        createdAt: new Date().toISOString(),
        createdBy: user?.name ?? 'Gestor',
        description: description.trim(),
        imagesCount: 0,
        completedImagesCount: 0,
      };
      set((s) => ({ batches: [batch, ...s.batches] }));
      get().addAuditLog('LOTE_CRIADO', 'batch', `${batch.name} · N=${evaluatorsPerImage}.`, undefined, batch.id);
      return { ok: true };
    },

    registerImages: async (batchId, files) => {
      const batch = get().batches.find((b) => b.id === batchId);
      const uploaded: string[] = [];
      const duplicates: string[] = [];
      if (!batch) return { uploaded, duplicates };
      for (const file of files) {
        if (get().imageHashes[file.sha256]) {
          duplicates.push(get().images.find((i) => i.id === get().imageHashes[file.sha256])?.code ?? file.sha256.slice(0, 8));
          continue;
        }
        const sequence = get().images.filter((i) => i.batchId === batchId).length + 1;
        const prefix = batch.name.match(/#(\d+)/)?.[1] ?? 'LT';
        const code = `LT${prefix.slice(-2)}-${String(sequence).padStart(4, '0')}`;
        const image: ImageItem = {
          id: newId('img'),
          code,
          batchId,
          batchName: batch.name,
          imageUrl: file.imageUrl,
          opticalMagnification: file.opticalMagnification ?? '40x Óptico IHC DAB',
          organ: file.organ ?? 'Não informado',
          uploadedAt: new Date().toISOString(),
          width: file.width,
          height: file.height,
          assignedEvaluatorIds: [],
          requiredEvaluatorsCount: batch.evaluatorsPerImage,
          status: 'pendente',
        };
        set((s) => ({ images: [...s.images, image], imageHashes: { ...s.imageHashes, [file.sha256]: image.id } }));
        get().addAuditLog('UPLOAD', 'batch', `${code} · SHA-256 ${file.sha256.slice(0, 16)}…`, image.id, batchId);
        uploaded.push(code);
      }
      return { uploaded, duplicates };
    },

    uploadImages: async (batchId, assets, onProgress) => {
      if (real) {
        // R2 (URL assinada) + register_image + pré-anotação por limiar de cor (só na web: D10).
        const report = await uploadImagesToBatch(assets, {
          batchId,
          onProgress: (done, total, name) => onProgress?.(`Enviado ${done} de ${total}: ${name}`),
          onRegistered: async (imageVersionId, bytes, mime) => {
            if (Platform.OS !== 'web') return;
            const marks = await computePreAnnotationWeb(bytes, mime);
            if (marks) await repo.setPreAnnotation(imageVersionId, marks);
          },
        });
        await get().refresh();
        return {
          uploaded: report.uploadedCodes,
          duplicates: report.duplicateFiles.map((d) => d.existingCode ?? d.filename),
          rejected: report.rejected,
          sanitized: report.sanitized,
        };
      }
      const maxBytes = env.uploadMaxMb * 1024 * 1024;
      const summary: UploadSummary = { uploaded: [], duplicates: [], rejected: [], sanitized: 0 };
      const ready: NewImageInput[] = [];
      for (const [i, asset] of assets.entries()) {
        onProgress?.(`Processando ${i + 1} de ${assets.length}: ${asset.name}`);
        try {
          if (asset.size && asset.size > maxBytes) throw new ImageFormatError(`Arquivo acima de ${env.uploadMaxMb} MB.`);
          const clean = sanitizeImage(await readAssetBytes(asset));
          if (clean.removed.length) summary.sanitized += 1;
          const imageUrl =
            Platform.OS === 'web' ? URL.createObjectURL(new Blob([clean.bytes], { type: clean.mimeType })) : asset.uri;
          ready.push({ imageUrl, width: clean.width, height: clean.height, sha256: await sha256Hex(clean.bytes) });
        } catch (e) {
          summary.rejected.push({ filename: asset.name, reason: errorText(e) });
        }
      }
      const registered = await get().registerImages(batchId, ready);
      return { ...summary, uploaded: registered.uploaded, duplicates: registered.duplicates };
    },

    assignEvaluators: async (imageIds, evaluatorIds) => {
      const user = me();
      const { images, users, batches, projects } = get();
      const targets = images.filter((i) => imageIds.includes(i.id));
      if (!targets.length || !evaluatorIds.length) return { ok: false, error: 'Selecione imagens e ao menos 1 avaliador.' };
      if (real) {
        // O banco aplica RN-07, RF-29 e o papel Avaliador; as mensagens de erro já vêm em português.
        return remote(async () => {
          const res = await repo.assignEvaluators(imageIds, evaluatorIds);
          return { ...res, created: res.created ?? 0 };
        });
      }

      for (const image of targets) {
        const project = projects.find((p) => p.id === batches.find((b) => b.id === image.batchId)?.projectId);
        // RN-07: o gestor do projeto não pode ser avaliador nele
        if (evaluatorIds.includes(user?.id ?? '') || (project && evaluatorIds.includes(project.managerId))) {
          return { ok: false, error: 'Gestores não podem se autoatribuir análises para assegurar o protocolo cego (RN-07).' };
        }
        const merged = Array.from(new Set([...image.assignedEvaluatorIds, ...evaluatorIds]));
        // RF-29: cada imagem recebe exatamente N avaliadores distintos
        if (merged.length > image.requiredEvaluatorsCount) {
          return { ok: false, error: `${image.code} já tem ${image.assignedEvaluatorIds.length} avaliador(es); o limite do lote é N=${image.requiredEvaluatorsCount}.` };
        }
      }
      const invalid = evaluatorIds.find((id) => {
        const u = users.find((x) => x.id === id);
        return !u || !u.isActive || !u.roles.includes('Avaliador');
      });
      if (invalid) return { ok: false, error: 'Todo usuário atribuído precisa estar ativo e ter o papel Avaliador.' };

      let created = 0;
      set((s) => ({
        images: s.images.map((img) => {
          if (!imageIds.includes(img.id)) return img;
          const merged = Array.from(new Set([...img.assignedEvaluatorIds, ...evaluatorIds]));
          created += merged.length - img.assignedEvaluatorIds.length;
          return { ...img, assignedEvaluatorIds: merged };
        }),
      }));
      for (const image of targets) {
        get().addAuditLog('ATRIBUICAO', 'batch', `${image.code} · ${evaluatorIds.length} avaliador(es).`, image.id, image.batchId);
      }
      return { ok: true, created };
    },

    // --- Admin ----------------------------------------------------------------------
    createUser: async ({ name, email, institution, roles }) => {
      if (!name.trim() || !email.trim()) return { ok: false, error: 'Nome e e-mail são obrigatórios.' };
      if (!roles.length) return { ok: false, error: 'O usuário deve possuir pelo menos um papel atribuído.' };
      if (get().users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
        return { ok: false, error: 'Já existe um usuário com este e-mail.' };
      }
      if (real) {
        // Edge Function com o service_role: cria a conta sem senha e envia o link para o usuário criar a dele.
        return remote(() => invokeFunction('admin-create-user', { name: name.trim(), email: email.trim(), institution, roles: toDbRoles(roles) }));
      }
      const user: User = {
        id: newId('usr'),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        institution: institution?.trim() || undefined,
        roles,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ users: [...s.users, user] }));
      get().addAuditLog('USUARIO_CRIADO', 'user_management', `${user.name} · papéis: ${roles.join(', ')}. Convite enviado por e-mail.`);
      return { ok: true };
    },
    toggleUserActive: async (userId) => {
      if (userId === me()?.id) return { ok: false, error: 'Você não pode desativar a própria conta.' };
      const target = get().users.find((u) => u.id === userId);
      if (!target) return { ok: false, error: 'Usuário não encontrado.' };
      if (real) return remote(() => repo.adminUpdateUser(userId, { isActive: !target.isActive }));
      set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, isActive: !u.isActive } : u)) }));
      get().addAuditLog(target.isActive ? 'USUARIO_DESATIVADO' : 'USUARIO_REATIVADO', 'user_management', target.name);
      return { ok: true };
    },
    updateUserRoles: async (userId, roles) => {
      if (!roles.length) return { ok: false, error: 'O usuário deve possuir pelo menos um papel atribuído.' };
      if (userId === me()?.id && !roles.includes('Admin')) {
        return { ok: false, error: 'Você não pode remover o próprio papel de administrador.' };
      }
      const target = get().users.find((u) => u.id === userId);
      if (real) return remote(() => repo.adminUpdateUser(userId, { roles: toDbRoles(roles) }));
      set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, roles } : u)) }));
      get().addAuditLog('PAPEIS_ALTERADOS', 'user_management', `${target?.name}: ${roles.join(', ')}.`);
      return { ok: true };
    },
    createProject: async (name, description, managerId, requestId) => {
      if (!name.trim()) return { ok: false, error: 'O nome do projeto é obrigatório.' };
      const manager = get().users.find((u) => u.id === managerId);
      if (!manager || !manager.isActive || !manager.roles.includes('Gestor')) {
        return { ok: false, error: 'O gestor designado precisa estar ativo e ter o papel Gestor.' };
      }
      if (real) return remote(() => repo.createProject(name.trim(), description.trim(), managerId, requestId));
      const project: Project = {
        id: newId('proj'),
        name: name.trim(),
        code: `ESTUDO-${name.trim().substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}-${Date.now().toString().slice(-4)}`,
        description: description.trim(),
        managerId,
        managerName: manager.name,
        batchesCount: 0,
        createdAt: new Date().toISOString(),
        status: 'ativo',
      };
      set((s) => ({ projects: [...s.projects, project] }));
      get().addAuditLog('PROJETO_CRIADO', 'batch', `${project.name} · gestor: ${manager.name}.`);
      return { ok: true };
    },
  };
});
