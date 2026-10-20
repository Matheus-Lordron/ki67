/**
 * Acesso ao Supabase (Fase 4). Toda leitura passa pelo RLS com o token do
 * usuário; toda escrita sensível passa pelas RPCs de supabase/schema.sql, que
 * também gravam o log de auditoria com hash SHA-256 encadeado.
 */
import type { PostgrestError } from '@supabase/supabase-js';

import {
  type ProjectAnalysisRow,
  toAnalysis,
  toAuditLog,
  toBatch,
  toConsensus,
  toImage,
  toProject,
  toUser,
  toVersion,
} from '@/data/mappers';
import { getSignedImageUrls } from '@/services/cloudflare';
import { deviceLabel } from '@/services/device';
import { ApiError, rpc, supabase } from '@/services/supabase';
import type {
  AnalysisVersion,
  AuditLog,
  Batch,
  ComparisonResult,
  DbAnalysisVersion,
  DbAuditLog,
  DbBatch,
  DbConsensusResult,
  DbImage,
  DbImageStatus,
  DbProfile,
  DbProject,
  EvaluatorAnalysis,
  ImageItem,
  MySession,
  OpenAnalysisResult,
  Project,
  RpcFailure,
  SaveVersionResult,
  User,
  UserRole,
} from '@/types';

async function rows<T>(query: PromiseLike<{ data: unknown; error: PostgrestError | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new ApiError(error.message, error.code);
  return (data ?? []) as T[];
}

const unique = <T,>(list: T[]) => Array.from(new Set(list));
const AUDIT_LIMIT = 500;

export interface RoleData {
  users: User[];
  projects: Project[];
  batches: Batch[];
  images: ImageItem[];
  analyses: EvaluatorAnalysis[];
  auditLogs: AuditLog[];
  validationIndices: Record<string, number[]>;
  imageVersions: Record<string, string>; // imageId → imageVersionId
}

interface VersionRow {
  id: string;
  image_id: string;
  version_number: number;
  width_px: number;
  height_px: number;
}

function latestVersions(list: VersionRow[]) {
  const map: Record<string, VersionRow> = {};
  for (const v of list) if (!map[v.image_id] || map[v.image_id].version_number < v.version_number) map[v.image_id] = v;
  return map;
}

// --- Sessão --------------------------------------------------------------------------

export const loadMySession = () => rpc<MySession>('my_session');

export async function loadProfile(id: string): Promise<User | null> {
  const list = await rows<DbProfile>(supabase.from('profiles').select('*').eq('id', id));
  return list[0] ? toUser(list[0]) : null;
}

// --- Leitura por papel ----------------------------------------------------------------

export async function loadRoleData(role: UserRole, me: User): Promise<RoleData> {
  switch (role) {
    case 'Avaliador':
      return loadEvaluator(me);
    case 'Validador':
      return loadValidator(me);
    case 'Gestor':
      return loadManager(me);
    case 'Admin':
      return loadAdmin(me);
  }
}

async function loadEvaluator(me: User): Promise<RoleData> {
  const own = await rows<ProjectAnalysisRow>(supabase.from('v_project_analyses').select('*').eq('evaluator_id', me.id));
  const imageIds = unique(own.map((r) => r.image_id));
  if (!imageIds.length) return { users: [me], projects: [], batches: [], images: [], analyses: [], auditLogs: [], validationIndices: {}, imageVersions: {} };

  const [images, versions] = await Promise.all([
    rows<DbImage>(supabase.from('images').select('*').in('id', imageIds)),
    rows<VersionRow>(supabase.from('image_versions').select('id, image_id, version_number, width_px, height_px').in('image_id', imageIds)),
  ]);
  const batches = await rows<DbBatch>(supabase.from('batches').select('*').in('id', unique(images.map((i) => i.batch_id))));
  const latest = latestVersions(versions);
  const urls = await getSignedImageUrls(Object.values(latest).map((v) => v.id));

  return {
    users: [me],
    projects: [],
    batches: batches.map((b) => toBatch(b, [me], images.filter((i) => i.batch_id === b.id).length, 0)),
    images: images.map((i) => {
      const b = batches.find((x) => x.id === i.batch_id);
      const v = latest[i.id];
      const mine = own.find((r) => r.image_id === i.id);
      return toImage(i, {
        batch: b && { name: b.name, n: b.evaluators_per_image },
        version: v && { id: v.id, width: v.width_px, height: v.height_px },
        url: v && urls[v.id],
        evaluatorIds: [me.id], // o avaliador não sabe quem mais recebeu a imagem (RF-27)
        anyStarted: (mine?.current_version ?? 0) > 0,
      });
    }),
    analyses: own.map((r) => toAnalysis(r)),
    auditLogs: [],
    validationIndices: {},
    imageVersions: Object.fromEntries(Object.values(latest).map((v) => [v.image_id, v.id])),
  };
}

interface QueueRow {
  image_id: string;
  image_code: string;
  status: DbImageStatus;
  batch_id: string;
  batch_name: string;
  project_id: string;
  organ: string | null;
  optical_magnification: string | null;
  evaluators_per_image: number;
  finalized_count: number;
  ready_since: string;
  image_version_id: string | null;
  width_px: number | null;
  height_px: number | null;
  ki67_indices: (number | string)[];
  consensus_ki67: number | string | null;
}

async function loadValidator(me: User): Promise<RoleData> {
  const queue = await rpc<QueueRow[]>('validation_queue', { p_include_validated: true });
  const urls = await getSignedImageUrls(queue.map((q) => q.image_version_id).filter((v): v is string => !!v));
  const images: ImageItem[] = queue.map((q) => ({
    id: q.image_id,
    code: q.image_code,
    batchId: q.batch_id,
    batchName: q.batch_name,
    imageUrl: (q.image_version_id && urls[q.image_version_id]) || '',
    opticalMagnification: q.optical_magnification ?? '—',
    organ: q.organ ?? 'Não informado',
    uploadedAt: q.ready_since,
    width: q.width_px ?? 1,
    height: q.height_px ?? 1,
    assignedEvaluatorIds: [], // a fila do banco já exclui imagens que o validador anotou (RN-08)
    requiredEvaluatorsCount: q.evaluators_per_image,
    status: q.status === 'validada' ? 'validada' : 'pronta_para_validacao',
    consensusResult:
      q.consensus_ki67 !== null
        ? { id: '', imageId: q.image_id, validatorId: '', validatorName: '', consensusKi67: Number(q.consensus_ki67), reagentsCount: 0, nonReagentsCount: 0, justification: '', frozenAt: q.ready_since, isImmutable: true, hashSHA256: '', iccScore: 0, divergenceDeltaPP: 0, spatialAgreementPct: 0 }
        : undefined,
  }));
  return {
    users: [me],
    projects: [],
    batches: [],
    images,
    analyses: [],
    auditLogs: [],
    validationIndices: Object.fromEntries(queue.map((q) => [q.image_id, q.ki67_indices.map(Number)])),
    imageVersions: Object.fromEntries(queue.filter((q) => q.image_version_id).map((q) => [q.image_id, q.image_version_id as string])),
  };
}

async function loadManager(me: User): Promise<RoleData> {
  const projects = await rows<DbProject>(supabase.from('projects').select('*').eq('manager_id', me.id).order('created_at'));
  const pids = projects.map((p) => p.id);
  if (!pids.length) return { users: [me], projects: [], batches: [], images: [], analyses: [], auditLogs: [], validationIndices: {}, imageVersions: {} };

  const [batches, images, versions, analysisRows, consensus, profiles, logs] = await Promise.all([
    rows<DbBatch>(supabase.from('batches').select('*').in('project_id', pids).order('created_at', { ascending: false })),
    rows<DbImage>(supabase.from('images').select('*').in('project_id', pids).order('code')),
    rows<VersionRow>(supabase.from('image_versions').select('id, image_id, version_number, width_px, height_px, images!inner(project_id)').in('images.project_id', pids)),
    rows<ProjectAnalysisRow>(supabase.from('v_project_analyses').select('*').in('project_id', pids)),
    rows<DbConsensusResult>(supabase.from('consensus_results').select('*, images!inner(project_id)').in('images.project_id', pids)),
    rows<DbProfile>(supabase.from('profiles').select('*').order('name')),
    rows<DbAuditLog>(supabase.from('audit_logs').select('*').in('project_id', pids).order('id', { ascending: false }).limit(AUDIT_LIMIT)),
  ]);
  const users = profiles.map(toUser);
  if (!users.some((u) => u.id === me.id)) users.push(me);
  const latest = latestVersions(versions);
  const urls = await getSignedImageUrls(Object.values(latest).map((v) => v.id));

  const mappedImages = images.map((i) => {
    const b = batches.find((x) => x.id === i.batch_id);
    const v = latest[i.id];
    const imageAnalyses = analysisRows.filter((r) => r.image_id === i.id);
    const c = consensus.find((x) => x.image_id === i.id);
    return toImage(i, {
      batch: b && { name: b.name, n: b.evaluators_per_image },
      version: v && { id: v.id, width: v.width_px, height: v.height_px },
      url: v && urls[v.id],
      evaluatorIds: imageAnalyses.map((r) => r.evaluator_id),
      anyStarted: imageAnalyses.some((r) => r.current_version > 0),
      consensus: c && toConsensus(c, users),
    });
  });

  return {
    users,
    projects: projects.map((p) => toProject(p, users, batches.filter((b) => b.project_id === p.id).length)),
    batches: batches.map((b) => {
      const imgs = mappedImages.filter((i) => i.batchId === b.id);
      return toBatch(b, users, imgs.length, imgs.filter((i) => i.status === 'validada').length);
    }),
    images: mappedImages,
    analyses: analysisRows.map((r) => toAnalysis(r)),
    auditLogs: logs.map(toAuditLog),
    validationIndices: {},
    imageVersions: Object.fromEntries(Object.values(latest).map((v) => [v.image_id, v.id])),
  };
}

async function loadAdmin(me: User): Promise<RoleData> {
  const [profiles, projects, batches, logs] = await Promise.all([
    rows<DbProfile>(supabase.from('profiles').select('*').order('name')),
    rows<DbProject>(supabase.from('projects').select('*').order('created_at')),
    rows<DbBatch>(supabase.from('batches').select('*')),
    rows<DbAuditLog>(supabase.from('audit_logs').select('*').order('id', { ascending: false }).limit(AUDIT_LIMIT)),
  ]);
  const users = profiles.map(toUser);
  return {
    users: users.length ? users : [me],
    projects: projects.map((p) => toProject(p, users, batches.filter((b) => b.project_id === p.id).length)),
    batches: batches.map((b) => toBatch(b, users, 0, 0)),
    images: [], // o admin não vê imagens nem anotações (papel do sistema, não do estudo)
    analyses: [],
    auditLogs: logs.map(toAuditLog),
    validationIndices: {},
    imageVersions: {},
  };
}

// --- Avaliador -----------------------------------------------------------------------

export const openAnalysis = (analysisId: string) =>
  rpc<OpenAnalysisResult | RpcFailure>('open_analysis', { p_analysis_id: analysisId, p_device: deviceLabel() });

export async function loadHistory(analysisId: string): Promise<AnalysisVersion[]> {
  const list = await rows<DbAnalysisVersion>(
    supabase.from('analysis_versions').select('*').eq('analysis_id', analysisId).order('version_number', { ascending: false }),
  );
  return list.map(toVersion);
}

export async function loadPreAnnotation(imageVersionId: string) {
  const list = await rows<{ pre_annotation: unknown[] | null }>(supabase.from('image_versions').select('pre_annotation').eq('id', imageVersionId));
  return (list[0]?.pre_annotation ?? []) as import('@/types').AnnotationMark[];
}

export const saveVersion = (analysisId: string, base: number, marks: unknown[], observation: string) =>
  rpc<SaveVersionResult | RpcFailure>('save_analysis_version', {
    p_analysis_id: analysisId,
    p_base_version: base,
    p_marks: marks,
    p_observation: observation,
    p_device: deviceLabel(),
    p_kind: 'autosave',
  });

export const finalizeVersion = (analysisId: string, base: number, marks: unknown[], observation: string) =>
  rpc<SaveVersionResult | RpcFailure>('finalize_analysis', {
    p_analysis_id: analysisId,
    p_base_version: base,
    p_marks: marks,
    p_observation: observation,
    p_device: deviceLabel(),
  });

export const restoreVersion = (analysisId: string, versionNumber: number, base: number) =>
  rpc<SaveVersionResult | RpcFailure>('restore_analysis_version', {
    p_analysis_id: analysisId,
    p_version_number: versionNumber,
    p_base_version: base,
    p_device: deviceLabel(),
  });

// --- Validador ------------------------------------------------------------------------

export const loadComparison = (imageId: string) =>
  rpc<ComparisonResult | RpcFailure>('get_comparison', { p_image_id: imageId, p_device: deviceLabel() });

export function submitValidation(input: {
  imageId: string;
  adoptedBlindCode?: string;
  consensusKi67: number;
  justification: string;
  iccScore: number;
  spatialAgreementPct: number;
}) {
  return rpc<{ ok: boolean; error?: string }>('submit_validation', {
    p_image_id: input.imageId,
    p_kind: input.adoptedBlindCode ? 'escolha' : 'consenso',
    p_justification: input.justification,
    p_adopted_blind_code: input.adoptedBlindCode ?? null,
    p_consensus_marks: null,
    p_consensus_ki67: input.adoptedBlindCode ? null : input.consensusKi67,
    p_metrics: { icc_score: input.iccScore, spatial_agreement_pct: input.spatialAgreementPct },
    p_device: deviceLabel(),
  });
}

// --- Gestor ---------------------------------------------------------------------------

export async function createBatch(projectId: string, name: string, n: number, description: string) {
  const existing = await rows<{ code: string }>(supabase.from('batches').select('code').eq('project_id', projectId));
  let seq = existing.length + 1;
  for (let attempt = 0; attempt < 5; attempt++, seq++) {
    const code = `LT${String(seq).padStart(2, '0')}`;
    if (existing.some((b) => b.code === code)) continue;
    const { error } = await supabase.from('batches').insert({ project_id: projectId, code, name, description, evaluators_per_image: n });
    if (!error) return;
    if (error.code !== '23505') throw new ApiError(error.message, error.code); // 23505 = código repetido: tenta o próximo
  }
  throw new ApiError('Não foi possível gerar o código do lote.', 'BATCH_CODE');
}

export const assignEvaluators = (imageIds: string[], evaluatorIds: string[]) =>
  rpc<{ ok: boolean; created?: number; error?: string }>('assign_evaluators', {
    p_image_ids: imageIds,
    p_evaluator_ids: evaluatorIds,
    p_device: deviceLabel(),
  });

export const setPreAnnotation = (imageVersionId: string, marks: unknown[]) =>
  rpc<{ ok: boolean }>('set_pre_annotation', { p_image_version_id: imageVersionId, p_marks: marks, p_device: deviceLabel() });

// --- Admin ----------------------------------------------------------------------------

export const adminUpdateUser = (userId: string, patch: { roles?: string[]; isActive?: boolean }) =>
  rpc<{ ok: boolean }>('admin_update_user', {
    p_user_id: userId,
    p_roles: patch.roles ?? null,
    p_is_active: patch.isActive ?? null,
  });

export async function createProject(name: string, description: string, managerId: string) {
  const abbr = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 8) || 'ESTUDO';
  const code = `${abbr}-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { error } = await supabase.from('projects').insert({ code, name, description, manager_id: managerId });
  if (error) throw new ApiError(error.message, error.code);
}

// --- Log ------------------------------------------------------------------------------

const APP_LOGGABLE = new Set(['LOGOUT', 'SESSAO_EXPIRADA', 'EXPORTACAO', 'UPLOAD_RECUSADO', 'PERFIL_TROCADO', 'HISTORICO_ABERTO', 'PRE_MARCACAO_EXECUTADA', 'RASCUNHO_SINCRONIZADO']);

/** Ações que o próprio app registra; as críticas já são registradas pelas RPCs. */
export async function logEvent(action: string, category: AuditLog['category'], details?: string, refs: { imageId?: string; batchId?: string; projectId?: string } = {}) {
  if (!APP_LOGGABLE.has(action)) return;
  try {
    await rpc('log_event', {
      p_action: action,
      p_category: category,
      p_details: details ? { detalhe: details } : {},
      p_image_id: refs.imageId ?? null,
      p_batch_id: refs.batchId ?? null,
      p_project_id: refs.projectId ?? null,
      p_device: deviceLabel(),
    });
  } catch {
    // o log do app é complementar: falha de rede não bloqueia a ação
  }
}
