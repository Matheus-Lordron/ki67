// POST /functions/v1/r2-upload-url  { batch_id, sha256, mime_type, size_bytes }
//
// Só o gestor do projeto do lote recebe a URL de envio (RF-08). Arquivo com
// SHA-256 já cadastrado é avisado como duplicado ANTES do envio (RF-11).
// A chave no bucket é derivada do hash: projects/<projeto>/batches/<lote>/<sha256>.<ext>
// (mesmo conteúdo = mesma chave, então um reenvio nunca troca o original).
import { handle, HttpError, json, readJson } from '../_shared/http.ts';
import { presign, ttl } from '../_shared/r2.ts';
import { requireUser, serviceClient, userClient } from '../_shared/supabase.ts';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/tiff': 'tif' };
const MAX_BYTES = 50 * 1024 * 1024;

Deno.serve(
  handle(async (req) => {
    const { user, token } = await requireUser(req);
    const body = await readJson<{ batch_id?: string; sha256?: string; mime_type?: string; size_bytes?: number }>(req);
    const sha = String(body.sha256 ?? '').toLowerCase();
    const mime = String(body.mime_type ?? '');
    const size = Number(body.size_bytes ?? 0);
    if (!/^[0-9a-f]{64}$/.test(sha)) throw new HttpError(400, 'Hash SHA-256 inválido.');
    if (!EXT[mime]) throw new HttpError(400, 'Formato não aceito (use JPG, PNG ou TIFF).');
    if (!(size > 0 && size <= MAX_BYTES)) throw new HttpError(400, 'Arquivo vazio ou acima de 50 MB.');

    // Pelo RLS, com o token do usuário: só enxerga o lote quem participa do projeto.
    const { data: batch } = await userClient(req, token)
      .from('batches')
      .select('id, project_id, projects!inner(manager_id, status)')
      .eq('id', String(body.batch_id ?? ''))
      .maybeSingle();
    const project = (batch as unknown as { projects?: { manager_id: string; status: string } } | null)?.projects;
    if (!batch || project?.manager_id !== user.id) throw new HttpError(404, 'Lote não encontrado.');
    if (project.status !== 'ativo') throw new HttpError(409, 'O projeto não está ativo.');

    const { data: existing } = await serviceClient(req)
      .from('image_versions')
      .select('id, images!inner(code, project_id)')
      .eq('sha256', sha)
      .maybeSingle();
    if (existing) {
      const img = (existing as unknown as { images: { code: string; project_id: string } }).images; // relação N:1 chega como objeto
      return json(req, { duplicate: true, existing_code: img.project_id === batch.project_id ? img.code : null });
    }

    const storageKey = `projects/${batch.project_id}/batches/${batch.id}/${sha}.${EXT[mime]}`;
    const uploadUrl = await presign('PUT', storageKey, ttl('R2_UPLOAD_URL_TTL', 600));
    return json(req, { duplicate: false, upload_url: uploadUrl, storage_key: storageKey });
  }),
);
