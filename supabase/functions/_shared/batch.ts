// Lote que o usuário gerencia, lido com o token dele (RLS). Usado pelas funções de envio.
import { HttpError } from './http.ts';
import { userClient } from './supabase.ts';

export interface ManagedBatch {
  id: string;
  project_id: string;
}

/** 404 se o lote não existe, é invisível pelo RLS ou é de outro gestor; 409 se o projeto não está ativo. */
export async function managedBatch(req: Request, token: string, userId: string, batchId: unknown): Promise<ManagedBatch> {
  const { data: batch } = await userClient(req, token)
    .from('batches')
    .select('id, project_id, projects!inner(manager_id, status)')
    .eq('id', String(batchId ?? ''))
    .maybeSingle();
  const project = (batch as unknown as { projects?: { manager_id: string; status: string } } | null)?.projects;
  if (!batch || project?.manager_id !== userId) throw new HttpError(404, 'Lote não encontrado.');
  if (project.status !== 'ativo') throw new HttpError(409, 'O projeto não está ativo.');
  return { id: String(batch.id), project_id: String(batch.project_id) };
}

export const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/tiff': 'tif' };
export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));
export const MAX_BYTES = 50 * 1024 * 1024;

/** Chave definitiva: derivada do hash (mesmo conteúdo = mesma chave). */
export const finalKey = (b: ManagedBatch, sha: string, ext: string) => `projects/${b.project_id}/batches/${b.id}/${sha}.${ext}`;
/** Chave na quarentena: só a r2-confirm-upload tira o arquivo daqui. */
export const quarantineKey = (b: ManagedBatch, sha: string, ext: string) => `quarantine/${b.project_id}/${b.id}/${sha}.${ext}`;
