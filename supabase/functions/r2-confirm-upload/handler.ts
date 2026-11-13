// POST /functions/v1/r2-confirm-upload  { batch_id, storage_key, organ?, optical_magnification?, device? }
//
// R-12 (S1): segunda etapa do envio. O app já mandou o arquivo para a quarentena
// (r2-upload-url com quarantine: true). Aqui o SERVIDOR, sem confiar no app:
//   1. confere que quem pede é o gestor do lote e que a chave é a quarentena desse lote;
//   2. baixa o arquivo (até 50 MB; acima disso para de ler);
//   3. confere o SHA-256, o formato pelos bytes, as dimensões e a ausência de metadados
//      de texto (EXIF, XMP, IPTC...), com a mesma regra do app (_shared/imageInspect.ts);
//   4. recusado: apaga da quarentena e registra a recusa no log;
//   5. aceito: grava em projects/ (com checksum), registra a imagem e limpa a quarentena.
// Nada em projects/ é apagado aqui: a chave vem do hash e pode ser de outra imagem já
// registrada. Um arquivo que sobrar ali tem o mesmo conteúdo e é reaproveitado no reenvio.
import { finalKey, managedBatch, MAX_BYTES, MIME_BY_EXT, quarantineKey } from '../_shared/batch.ts';
import { handle, HttpError, json, readJson } from '../_shared/http.ts';
import { ImageFormatError, inspectImage } from '../_shared/imageInspect.ts';
import { deleteQuarantined, getObject, putObject } from '../_shared/r2.ts';
import { requireUser, serviceClient } from '../_shared/supabase.ts';

const QUARANTINE_KEY = /^quarantine\/[^/]+\/[^/]+\/([0-9a-f]{64})\.(jpg|png|tif)$/;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const handler = handle(async (req) => {
  const { user, token } = await requireUser(req);
  const body = await readJson<{ batch_id?: string; storage_key?: string; organ?: string;
                                optical_magnification?: string; device?: string }>(req);
  const batch = await managedBatch(req, token, user.id, body.batch_id);

  const key = String(body.storage_key ?? '');
  const match = QUARANTINE_KEY.exec(key);
  if (!match || key !== quarantineKey(batch, match[1], match[2])) {
    throw new HttpError(400, 'Chave de envio inválida.');
  }
  const [, sha, ext] = match;
  const mime = MIME_BY_EXT[ext];
  const device = String(body.device ?? '').slice(0, 300) || null;
  const svc = serviceClient(req);

  const reject = async (reason: string) => {
    await deleteQuarantined(key);
    await svc.rpc('log_upload_rejected', {
      p_user_id: user.id, p_batch_id: batch.id, p_sha256: sha, p_reason: reason, p_device: device,
    });
    return json(req, { ok: false, status: 'rejected', reason });
  };

  const object = await getObject(key, MAX_BYTES);
  if (object.status === 'ausente') throw new HttpError(409, 'O arquivo não chegou ao armazenamento. Envie de novo.');
  if (object.status === 'grande') return reject('Arquivo acima de 50 MB.');
  const bytes = object.bytes;

  if ((await sha256Hex(bytes)) !== sha) return reject('O arquivo recebido não confere com o hash declarado.');
  let inspection;
  try {
    inspection = inspectImage(bytes);
  } catch (e) {
    if (e instanceof ImageFormatError) return reject(e.message);
    throw e;
  }
  if (inspection.mime !== mime) return reject('O conteúdo do arquivo não é do formato declarado.');
  if (inspection.metadados.length) {
    return reject(`O arquivo ainda tem metadados de texto (${inspection.metadados.join(', ')}). Envie pelo app, que remove esses dados.`);
  }

  // Duplicata: não grava de novo (a chave definitiva seria a mesma do original).
  const { data: existing } = await svc
    .from('image_versions')
    .select('id, images!inner(code, project_id)')
    .eq('sha256', sha)
    .maybeSingle();
  if (existing) {
    await deleteQuarantined(key);
    const img = (existing as unknown as { images: { code: string; project_id: string } }).images;
    return json(req, { ok: false, status: 'duplicate', existing_code: img.project_id === batch.project_id ? img.code : null });
  }

  const target = finalKey(batch, sha, ext);
  await putObject(target, bytes, mime, sha);
  const { data: registered, error } = await svc.rpc('register_verified_image', {
    p_user_id: user.id,
    p_batch_id: batch.id,
    p_sha256: sha,
    p_storage_key: target,
    p_mime_type: mime,
    p_size_bytes: bytes.byteLength,
    p_width_px: inspection.width,
    p_height_px: inspection.height,
    p_organ: body.organ ?? null,
    p_optical_magnification: body.optical_magnification ?? null,
    p_device: device,
  });
  if (error) throw error; // 500 genérico; o arquivo fica na quarentena e o envio pode ser repetido
  // A quarentena tem regra de expiração no bucket: se esta limpeza falhar, ela some sozinha.
  await deleteQuarantined(key).catch((e) => console.error('limpeza da quarentena falhou', { key, e: String(e) }));
  return json(req, registered);
});
