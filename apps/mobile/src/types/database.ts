// Espelho de supabase/schema.sql: enums, linhas das tabelas e views, e o
// formato de resposta de cada RPC. Ao mudar o SQL, mude este arquivo junto.
// Datas chegam como string ISO 8601 (UTC).

// --- Enums ----------------------------------------------------------------------
export type DbAppRole = 'admin' | 'gestor' | 'avaliador' | 'validador';
export type DbProjectStatus = 'ativo' | 'pausado' | 'concluido';
export type DbImageStatus = 'nao_atribuida' | 'aguardando_analises' | 'pronta_para_validacao' | 'validada' | 'concluida';
export type DbAnalysisStatus = 'pendente' | 'em_andamento' | 'finalizada';
export type DbVersionKind = 'autosave' | 'manual' | 'finalizacao' | 'restauracao' | 'reabertura';
export type DbValidationKind = 'escolha' | 'consenso';
export type DbAuditCategory = 'auth' | 'annotation' | 'validation' | 'batch' | 'user_management' | 'security' | 'export';
export type DbLabelIndexRole = 'positivo' | 'negativo' | 'ignorar';
export type DbLabelSymbol = 'circulo' | 'anel' | 'quadrado' | 'triangulo' | 'losango';

/** Marcação gravada no JSONB `marks` (mesmo formato de AnnotationMark). */
export interface DbMark {
  id: string;
  type: 'point' | 'box' | 'polygon';
  label: string; // labels.key
  [field: string]: unknown;
}

// --- Tabelas --------------------------------------------------------------------
export interface DbProfile {
  id: string;
  name: string;
  email: string;
  roles: DbAppRole[];
  is_active: boolean;
  institution: string | null;
  avatar_url: string | null;
  last_login_at: string | null;
  deactivated_at: string | null;
  deactivated_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbProject {
  id: string;
  code: string;
  name: string;
  description: string;
  manager_id: string;
  status: DbProjectStatus;
  request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbLabel {
  id: string;
  project_id: string;
  key: string;
  name: string;
  color: string;
  symbol: DbLabelSymbol;
  index_role: DbLabelIndexRole;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface DbBatch {
  id: string;
  project_id: string;
  code: string;
  name: string;
  description: string;
  evaluators_per_image: number;
  request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbImage {
  id: string;
  batch_id: string;
  project_id: string;
  code: string;
  sequence_number: number;
  status: DbImageStatus;
  organ: string | null;
  optical_magnification: string | null;
  uploaded_by: string;
  created_at: string;
  status_changed_at: string;
}

export interface DbImageVersion {
  id: string;
  image_id: string;
  version_number: number;
  sha256: string;
  storage_key: string;
  preview_storage_key: string | null;
  mime_type: 'image/jpeg' | 'image/png' | 'image/tiff';
  size_bytes: number;
  width_px: number;
  height_px: number;
  metadata_sanitized: boolean;
  pre_annotation: DbMark[] | null;
  pre_annotation_at: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

export interface DbAnalysis {
  id: string;
  image_id: string;
  evaluator_id: string;
  blind_code: string;
  status: DbAnalysisStatus;
  current_version: number;
  assigned_by: string;
  assigned_at: string;
  started_at: string | null;
  last_saved_at: string | null;
  finalized_at: string | null;
}

export interface DbAnalysisVersion {
  id: string;
  analysis_id: string;
  version_number: number;
  image_version_id: string;
  author_id: string;
  kind: DbVersionKind;
  marks: DbMark[];
  observation: string;
  reagents_count: number;
  non_reagents_count: number;
  ki67_index: number | null;
  restored_from_version: number | null;
  device: string;
  content_sha256: string;
  created_at: string;
}

export interface DbConsensusResult {
  id: string;
  image_id: string;
  validator_id: string;
  kind: DbValidationKind;
  adopted_analysis_id: string | null;
  adopted_version_id: string | null;
  adopted_blind_code: string | null;
  consensus_marks: DbMark[] | null;
  reagents_count: number | null;
  non_reagents_count: number | null;
  consensus_ki67: number;
  icc_score: number | null;
  divergence_delta_pp: number | null;
  spatial_agreement_pct: number | null;
  agreement_metrics: Record<string, unknown>;
  justification: string;
  device: string;
  content_sha256: string;
  frozen_at: string;
}

export interface DbAuditLog {
  id: number;
  occurred_at: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  category: DbAuditCategory;
  entity: string | null;
  entity_id: string | null;
  project_id: string | null;
  batch_id: string | null;
  image_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  device: string | null;
  prev_hash: string;
  hash: string;
}

// --- Views ----------------------------------------------------------------------
export interface DbMyAnalysisRow {
  analysis_id: string;
  image_id: string;
  status: DbAnalysisStatus;
  blind_code: string;
  current_version: number;
  assigned_at: string;
  started_at: string | null;
  last_saved_at: string | null;
  finalized_at: string | null;
  image_code: string;
  organ: string | null;
  optical_magnification: string | null;
  batch_id: string;
  batch_code: string;
  batch_name: string;
  project_id: string;
  project_name: string;
  reagents_count: number | null;
  non_reagents_count: number | null;
  ki67_index: number | null;
}

export interface DbBatchProgressRow {
  batch_id: string;
  project_id: string;
  code: string;
  name: string;
  description: string;
  evaluators_per_image: number;
  created_at: string;
  images_count: number;
  unassigned_images: number;
  awaiting_images: number;
  ready_images: number;
  completed_images: number;
  pending_analyses: number;
  in_progress_analyses: number;
  finalized_analyses: number;
}

export interface DbEvaluatorProgressRow {
  project_id: string;
  batch_id: string;
  evaluator_id: string;
  evaluator_name: string | null;
  total: number;
  pending: number;
  in_progress: number;
  finalized: number;
  last_activity_at: string | null;
}

// --- RPCs -----------------------------------------------------------------------
export type RpcName =
  | 'my_session'
  | 'verify_two_factor_code'
  | 'register_login'
  | 'log_event'
  | 'verify_audit_chain'
  | 'admin_update_user'
  | 'register_image'
  | 'set_pre_annotation'
  | 'assign_evaluators'
  | 'assign_evaluators_to_batch'
  | 'open_analysis'
  | 'save_analysis_version'
  | 'finalize_analysis'
  | 'restore_analysis_version'
  | 'validation_queue'
  | 'get_comparison'
  | 'submit_validation';

/** Resposta de recusa das RPCs (acesso negado ou conflito). */
export interface RpcFailure {
  ok: false;
  error: 'NOT_FOUND' | 'FORBIDDEN' | 'VERSION_CONFLICT' | 'INVALID_CODE' | 'EXPIRED'
       | 'TOO_MANY_ATTEMPTS' | 'NO_CHALLENGE' | 'INACTIVE';
  current_version?: number;
  attempts_left?: number;
}

export interface MySession {
  authenticated: boolean;
  has_profile?: boolean;
  user_id?: string;
  name?: string;
  email?: string;
  roles?: DbAppRole[];
  is_active?: boolean;
  institution?: string | null;
  avatar_url?: string | null;
  last_login_at?: string | null;
  two_factor_required?: boolean;
  two_factor_verified?: boolean;
}

export interface LabelInfo {
  key: string;
  name: string;
  color: string;
  symbol: DbLabelSymbol;
  index_role: DbLabelIndexRole;
}

export interface OpenAnalysisResult {
  ok: true;
  analysis: {
    id: string;
    status: DbAnalysisStatus;
    blind_code: string;
    current_version: number;
    assigned_at: string;
    started_at: string | null;
    last_saved_at: string | null;
    finalized_at: string | null;
    read_only: boolean;
  };
  image: {
    id: string;
    code: string;
    organ: string | null;
    optical_magnification: string | null;
    batch_name: string;
    batch_code: string;
    project_name: string;
    image_version_id: string;
    width: number;
    height: number;
    mime_type: string;
  };
  labels: LabelInfo[];
  latest_version: {
    version_number: number;
    kind: DbVersionKind;
    marks: DbMark[];
    observation: string;
    reagents: number;
    non_reagents: number;
    ki67_index: number | null;
    created_at: string;
    content_sha256: string;
  } | null;
  pre_annotation: DbMark[] | null;
}

export interface SaveVersionResult {
  ok: true;
  version_number: number;
  reagents: number;
  non_reagents: number;
  ki67_index: number | null;
  saved_at: string;
  image_ready?: boolean;
}

export type RegisterImageResult =
  | { ok: true; status: 'uploaded'; image_id: string; image_version_id: string; code: string }
  | { ok: false; status: 'duplicate'; existing_code: string | null }
  | { ok: false; status: 'rejected'; reason: string };

export interface AssignResult {
  ok: true;
  created: number;
  skipped: number;
}

export interface ValidationQueueRow {
  image_id: string;
  image_code: string;
  status: DbImageStatus;
  batch_id: string;
  batch_name: string;
  project_id: string;
  project_name: string;
  organ: string | null;
  optical_magnification: string | null;
  evaluators_per_image: number;
  finalized_count: number;
  ready_since: string;
}

export interface ComparisonResult {
  ok: true;
  image: {
    id: string;
    code: string;
    status: DbImageStatus;
    organ: string | null;
    optical_magnification: string | null;
    batch_name: string;
    n: number;
    image_version_id: string;
    width: number;
    height: number;
    mime_type: string;
  };
  labels: LabelInfo[];
  analyses: Array<{
    blind_code: string;
    version_number: number;
    finalized_at: string;
    marks: DbMark[];
    observation: string;
    reagents: number;
    non_reagents: number;
    ki67_index: number | null;
    content_sha256: string;
  }>;
  metrics: { min: number | null; max: number | null; delta_pp: number | null; median: number | null };
  result: Omit<DbConsensusResult, 'validator_id' | 'adopted_analysis_id' | 'adopted_version_id'> | null;
}

export interface SubmitValidationResult {
  ok: true;
  id: string;
  consensus_ki67: number;
  divergence_delta_pp: number | null;
  content_sha256: string;
  frozen_at: string;
}

export interface AuditChainResult {
  ok: boolean;
  checked: number;
  first_broken_id: number | null;
}
