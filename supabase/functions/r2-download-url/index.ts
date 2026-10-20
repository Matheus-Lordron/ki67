// POST /functions/v1/r2-download-url
//   { image_version_id }            → { url, expires_in }
//   { image_version_ids: [...] }    → { urls: { [id]: url }, expires_in }
//   variant: 'preview' (cópia reduzida, se existir) | 'original'
//
// A consulta usa o token do usuário: o RLS só devolve as imagens que ele pode ver
// (avaliador atribuído, gestor do projeto ou validador elegível). Sem linha, sem URL.
// Validade de 5 min e Cache-Control no-store (RNF-06).
import { handle, HttpError, json, readJson } from '../_shared/http.ts';
import { presign, ttl } from '../_shared/r2.ts';
import { requireUser, userClient } from '../_shared/supabase.ts';

Deno.serve(
  handle(async (req) => {
    const { token } = await requireUser(req);
    const body = await readJson<{ image_version_id?: string; image_version_ids?: string[]; variant?: string }>(req);
    const ids = Array.from(new Set([...(body.image_version_ids ?? []), ...(body.image_version_id ? [body.image_version_id] : [])])).slice(0, 100);
    if (!ids.length) throw new HttpError(400, 'Informe ao menos uma imagem.');

    const { data, error } = await userClient(req, token)
      .from('image_versions')
      .select('id, storage_key, preview_storage_key')
      .in('id', ids);
    if (error) throw new Error(error.message);

    const expires = ttl('R2_DOWNLOAD_URL_TTL', 300);
    const urls: Record<string, string> = {};
    for (const v of data ?? []) {
      const key = body.variant === 'original' ? v.storage_key : (v.preview_storage_key ?? v.storage_key);
      urls[v.id] = await presign('GET', key, expires, { 'response-cache-control': 'no-store' });
    }
    if (body.image_version_id && !urls[body.image_version_id]) throw new HttpError(404, 'Imagem não encontrada.');
    return json(req, { urls, url: body.image_version_id ? urls[body.image_version_id] : undefined, expires_in: expires });
  }),
);
