// Tipos de domínio usados pelas telas, migrados do protótipo do AI Studio.
// Os tipos que espelham as tabelas do Supabase ficam em ./database.ts; a
// conversão entre os dois é feita pelos serviços (Fase 4).
export * from './database';

export type UserRole = 'Admin' | 'Gestor' | 'Avaliador' | 'Validador';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  isActive: boolean;
  avatar?: string;
  institution?: string;
  createdAt: string;
  lastLogin?: string;
}

export type MarkType = 'point' | 'box' | 'polygon';
export type MarkLabel = 'reagente' | 'nao_reagente'; // reagente = DAB brown (●), nao_reagente = Hematoxylin blue (○)

export interface AnnotationMark {
  id: string;
  type: MarkType;
  label: MarkLabel;
  isAutoSuggested: boolean; // Pre-annotation uses dashed outline; manual uses solid outline
  /** Origem da marcação (premissa da Q2): permite medir o efeito da pré-anotação. */
  origin?: 'manual' | 'pre_anotacao' | 'pre_anotacao_editada';
  // For point:
  x: number; // 0 to 100 (percentage of image width)
  y: number; // 0 to 100 (percentage of image height)
  // For box:
  width?: number;
  height?: number;
  // For polygon:
  points?: Array<{ x: number; y: number }>;
  createdAt: string;
}

export interface AnalysisVersion {
  versionNumber: number;
  createdAt: string;
  savedBy: string; // Evaluator pseudonym or blind ID
  reagentsCount: number;
  nonReagentsCount: number;
  ki67Index: number | null;
  marks: AnnotationMark[];
  observation: string;
}

export type AnalysisStatus = 'pendente' | 'em_andamento' | 'finalizada';

export interface EvaluatorAnalysis {
  id: string;
  imageId: string;
  evaluatorId: string;
  evaluatorCode: string; // e.g., "Avaliador A", "Avaliador B" (never real names shown to validator)
  status: AnalysisStatus;
  currentVersion: number;
  lastSavedAt: string;
  finalizedAt?: string;
  marks: AnnotationMark[];
  observation: string;
  history: AnalysisVersion[];
  hashSHA256: string;
}

export interface ImageItem {
  id: string;
  code: string; // e.g., "LT01-0042"
  batchId: string;
  batchName: string;
  imageUrl: string;
  opticalMagnification: string; // e.g. "40x Óptico"
  organ: string; // e.g. "Mama - Carcinoma Ductal Invasivo"
  uploadedAt: string;
  width: number;
  height: number;
  assignedEvaluatorIds: string[];
  requiredEvaluatorsCount: number; // N, default 3
  status: 'pendente' | 'em_andamento' | 'pronta_para_validacao' | 'validada';
  consensusResult?: ConsensusResult;
}

export interface ConsensusResult {
  id: string;
  imageId: string;
  validatorId: string;
  validatorName: string;
  adoptedAnalysisCode?: string; // e.g. "Análise A" or "Consenso Fisionado"
  consensusKi67: number;
  reagentsCount: number;
  nonReagentsCount: number;
  justification: string;
  frozenAt: string;
  isImmutable: boolean;
  hashSHA256: string;
  iccScore: number;
  divergenceDeltaPP: number;
  spatialAgreementPct: number;
}

export interface Batch {
  id: string;
  projectId?: string;
  name: string;
  evaluatorsPerImage: number; // N, default 3, min 1
  createdAt: string;
  createdBy: string;
  description: string;
  imagesCount: number;
  completedImagesCount: number;
}

export interface UploadBatchResult {
  uploaded: number;
  duplicates: number;
  rejected: Array<{ filename: string; reason: string }>;
  exifWarningShown: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  category: 'auth' | 'annotation' | 'validation' | 'batch' | 'user_management' | 'security' | 'export';
  timestamp: string;
  ipAddress: string;
  device: string;
  imageId?: string;
  batchId?: string;
  hashSHA256: string;
  details?: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string;
  managerId: string;
  managerName: string;
  batchesCount: number;
  createdAt: string;
  status: 'ativo' | 'concluido' | 'pausado';
}
