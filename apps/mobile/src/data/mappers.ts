/**
 * Converte as linhas do Supabase para os tipos das telas (src/types/index.ts,
 * herdados do protótipo). Assim as telas funcionam igual nos modos demo e real.
 */
import type {
  AnalysisVersion,
  AnnotationMark,
  AuditLog,
  Batch,
  ConsensusResult,
  DbAnalysisVersion,
  DbAppRole,
  DbAuditLog,
  DbBatch,
  DbConsensusResult,
  DbImage,
  DbImageStatus,
  DbProfile,
  DbProject,
  EvaluatorAnalysis,
  ImageItem,
  Project,
  User,
  UserRole,
} from '@/types';

const ROLE_TO_UI: Record<DbAppRole, UserRole> = { admin: 'Admin', gestor: 'Gestor', avaliador: 'Avaliador', validador: 'Validador' };
const ROLE_TO_DB: Record<UserRole, DbAppRole> = { Admin: 'admin', Gestor: 'gestor', Avaliador: 'avaliador', Validador: 'validador' };

export const toUiRoles = (roles: DbAppRole[]) => roles.map((r) => ROLE_TO_UI[r]).filter(Boolean);
export const toDbRoles = (roles: UserRole[]) => roles.map((r) => ROLE_TO_DB[r]);

export function toUser(p: DbProfile): User {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    roles: toUiRoles(p.roles),
    isActive: p.is_active,
    institution: p.institution ?? undefined,
    createdAt: p.created_at,
    lastLogin: p.last_login_at ?? undefined,
  };
}

export function toProject(p: DbProject, users: User[], batchCount: number): Project {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    description: p.description,
    managerId: p.manager_id,
    managerName: users.find((u) => u.id === p.manager_id)?.name ?? '—',
    batchesCount: batchCount,
    createdAt: p.created_at,
    status: p.status,
  };
}

export function toBatch(b: DbBatch, users: User[], imagesCount: number, completed: number): Batch {
  return {
    id: b.id,
    projectId: b.project_id,
    name: b.name,
    evaluatorsPerImage: b.evaluators_per_image,
    createdAt: b.created_at,
    createdBy: users.find((u) => u.id === b.created_by)?.name ?? '—',
    description: b.description,
    imagesCount,
    completedImagesCount: completed,
  };
}

/** Status do banco → status do protótipo. "Em andamento" = alguma análise já salva. */
export function toImageStatus(status: DbImageStatus, anyStarted: boolean): ImageItem['status'] {
  switch (status) {
    case 'nao_atribuida':
      return 'pendente';
    case 'aguardando_analises':
      return anyStarted ? 'em_andamento' : 'pendente';
    case 'pronta_para_validacao':
      return 'pronta_para_validacao';
    default:
      return 'validada'; // 'validada' e 'concluida' (N = 1)
  }
}

export interface ImageExtras {
  batch?: { name: string; n: number };
  version?: { id: string; width: number; height: number };
  url?: string;
  evaluatorIds: string[];
  anyStarted: boolean;
  consensus?: ConsensusResult;
}

export function toImage(i: DbImage, x: ImageExtras): ImageItem {
  return {
    id: i.id,
    code: i.code,
    batchId: i.batch_id,
    batchName: x.batch?.name ?? '—',
    imageUrl: x.url ?? '',
    opticalMagnification: i.optical_magnification ?? '—',
    organ: i.organ ?? 'Não informado',
    uploadedAt: i.created_at,
    width: x.version?.width ?? 1,
    height: x.version?.height ?? 1,
    assignedEvaluatorIds: x.evaluatorIds,
    requiredEvaluatorsCount: x.batch?.n ?? 1,
    status: toImageStatus(i.status, x.anyStarted),
    consensusResult: x.consensus,
  };
}

/** Linha de public.v_project_analyses. */
export interface ProjectAnalysisRow {
  analysis_id: string;
  image_id: string;
  evaluator_id: string;
  blind_code: string;
  status: EvaluatorAnalysis['status'];
  current_version: number;
  assigned_at: string;
  last_saved_at: string | null;
  finalized_at: string | null;
  image_code: string;
  batch_id: string;
  project_id: string;
  marks: AnnotationMark[] | null;
  observation: string | null;
  reagents_count: number | null;
  non_reagents_count: number | null;
  ki67_index: number | null;
  content_sha256: string | null;
}

export function toAnalysis(r: ProjectAnalysisRow, history: AnalysisVersion[] = []): EvaluatorAnalysis {
  return {
    id: r.analysis_id,
    imageId: r.image_id,
    evaluatorId: r.evaluator_id,
    evaluatorCode: `Análise ${r.blind_code}`, // nunca o nome do avaliador
    status: r.status,
    currentVersion: r.current_version,
    lastSavedAt: r.last_saved_at ?? r.assigned_at,
    finalizedAt: r.finalized_at ?? undefined,
    marks: r.marks ?? [],
    observation: r.observation ?? '',
    history,
    hashSHA256: r.content_sha256 ?? '—',
  };
}

export function toVersion(v: DbAnalysisVersion): AnalysisVersion {
  return {
    versionNumber: v.version_number,
    createdAt: v.created_at,
    savedBy: v.device,
    reagentsCount: v.reagents_count,
    nonReagentsCount: v.non_reagents_count,
    ki67Index: v.ki67_index === null ? null : Number(v.ki67_index),
    marks: v.marks as unknown as AnnotationMark[],
    observation: v.observation,
  };
}

export function toConsensus(c: Omit<DbConsensusResult, 'validator_id' | 'adopted_analysis_id' | 'adopted_version_id'> & { validator_id?: string }, users: User[]): ConsensusResult {
  return {
    id: c.id,
    imageId: c.image_id,
    validatorId: c.validator_id ?? '',
    validatorName: users.find((u) => u.id === c.validator_id)?.name ?? 'Validador',
    adoptedAnalysisCode: c.kind === 'escolha' ? `Análise ${c.adopted_blind_code} adotada` : 'Consenso',
    consensusKi67: Number(c.consensus_ki67),
    reagentsCount: c.reagents_count ?? 0,
    nonReagentsCount: c.non_reagents_count ?? 0,
    justification: c.justification,
    frozenAt: c.frozen_at,
    isImmutable: true,
    hashSHA256: c.content_sha256,
    iccScore: Number(c.icc_score ?? 0),
    divergenceDeltaPP: Number(c.divergence_delta_pp ?? 0),
    spatialAgreementPct: Number(c.spatial_agreement_pct ?? 0),
  };
}

const CATEGORY: Record<DbAuditLog['category'], AuditLog['category']> = {
  auth: 'auth',
  annotation: 'annotation',
  validation: 'validation',
  batch: 'batch',
  user_management: 'user_management',
  security: 'security',
  export: 'export',
};

function describe(details: Record<string, unknown>): string | undefined {
  const entries = Object.entries(details ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!entries.length) return undefined;
  return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ');
}

export function toAuditLog(l: DbAuditLog): AuditLog {
  return {
    id: String(l.id),
    userId: l.user_id ?? 'system',
    userName: l.user_name ?? 'Sistema',
    action: l.action,
    category: CATEGORY[l.category],
    timestamp: l.occurred_at,
    ipAddress: l.ip_address ?? '—',
    device: l.device ?? '—',
    imageId: l.image_id ?? undefined,
    batchId: l.batch_id ?? undefined,
    hashSHA256: l.hash,
    details: describe(l.details),
  };
}
