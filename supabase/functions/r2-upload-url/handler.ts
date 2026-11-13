// POST /functions/v1/r2-upload-url  { batch_id, sha256, mime_type, size_bytes, quarantine? }
//
// Só o gestor do projeto do lote recebe a URL de envio (RF-08). Arquivo com
// SHA-256 já cadastrado é avisado como duplicado ANTES do envio (RF-11).
// A chave no bucket é derivada do hash: projects/<projeto>/batches/<lote>/<sha256>.<ext>
// (mesmo conteúdo = mesma chave, então um reenvio nunca troca o original).
// R-12: com `quarantine: true`, a chave fica em quarantine/<projeto>/<lote>/; o arquivo só
// vai para projects/ depois de conferido pela r2-confirm-upload.
import { EXT, finalKey, managedBatch, MAX_BYTES, quarantineKey } from '../_shared/batch.ts';
import { handle, HttpError, json, readJson } from '../_shared/http.ts';
import { presign, sha256Base64, ttl } from '../_shared/r2.ts';
import { requireUser, serviceClient } from '../_shared/supabase.ts';

export const handler = handle(async (req) => {
  const { user, token } = await requireUser(req);
  const body = await readJson<{ batch_id?: string; sha256?: string; mime_type?: string; size_bytes?: number; quarantine?: boolean }>(req);
  const sha = String(body.sha256 ?? '').toLowerCase();
  const mime = String(body.mime_type ?? '');
  const size = Number(body.size_bytes ?? 0);
  if (!/^[0-9a-f]{64}$/.test(sha)) throw new HttpError(400, 'Hash SHA-256 inválido.');
  if (!EXT[mime]) throw new HttpError(400, 'Formato não aceito (use JPG, PNG ou TIFF).');
  if (!(size > 0 && size <= MAX_BYTES)) throw new HttpError(400, 'Arquivo vazio ou acima de 50 MB.');

  // Pelo RLS, com o token do usuário: só enxerga o lote quem participa do projeto.
  const batch = await managedBatch(req, token, user.id, body.batch_id);

  const { data: existing } = await serviceClient(req)
    .from('image_versions')
    .select('id, images!inner(code, project_id)')
    .eq('sha256', sha)
    .maybeSingle();
  if (existing) {
    const img = (existing as unknown as { images: { code: string; project_id: string } }).images; // relação N:1 chega como objeto
    return json(req, { duplicate: true, existing_code: img.project_id === batch.project_id ? img.code : null });
  }

  const storageKey = body.quarantine === true ? quarantineKey(batch, sha, EXT[mime]) : finalKey(batch, sha, EXT[mime]);
  // R-11: tamanho, tipo e SHA-256 entram na assinatura. O R2 recusa o PUT de um arquivo
  // diferente do declarado; o app manda `headers` no PUT (o navegador põe o Content-Length).
  const headers = { 'Content-Type': mime, 'x-amz-checksum-sha256': sha256Base64(sha) };
  const uploadUrl = await presign('PUT', storageKey, ttl('R2_UPLOAD_URL_TTL', 600), {},
    { ...headers, 'Content-Length': String(size) });
  return json(req, { duplicate: false, upload_url: uploadUrl, storage_key: storageKey, headers });
});
