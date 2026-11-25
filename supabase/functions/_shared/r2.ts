// URLs pré-assinadas do Cloudflare R2 (API compatível com S3), com aws4fetch.
// O bucket é privado: sem uma URL assinada pela função, ninguém lê nem grava.
import { AwsClient } from 'npm:aws4fetch@1.0.20';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável ${name} não configurada nas secrets das Edge Functions.`);
  return value;
}

let client: AwsClient | null = null;
function r2(): AwsClient {
  client ??= new AwsClient({
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    service: 's3',
    region: 'auto',
  });
  return client;
}

/**
 * Gera uma URL assinada (PUT para enviar, GET para ler) válida por ttlSeconds.
 * `headers` entram na assinatura (inclusive Content-Type e Content-Length, que o
 * aws4fetch deixaria de fora): o R2 recusa o pedido que mandar outro valor.
 */
const objectUrl = (key: string) =>
  `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}/${key.split('/').map(encodeURIComponent).join('/')}`;

export async function presign(
  method: 'GET' | 'PUT',
  key: string,
  ttlSeconds: number,
  query: Record<string, string> = {},
  headers: Record<string, string> = {},
): Promise<string> {
  // Estilo "path": https://<conta>.r2.cloudflarestorage.com/<bucket>/<chave>
  const url = new URL(objectUrl(key));
  url.searchParams.set('X-Amz-Expires', String(ttlSeconds));
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const signed = await r2().sign(new Request(url, { method, headers }), { aws: { signQuery: true, allHeaders: true } });
  return signed.url;
}

/** SHA-256 em hexadecimal → base64, o formato do cabeçalho x-amz-checksum-sha256. */
export const sha256Base64 = (hex: string) => btoa(String.fromCharCode(...hex.match(/../g)!.map((b) => parseInt(b, 16))));

export const ttl = (name: string, fallback: number) => Number(Deno.env.get(name) ?? fallback);

// --- Operações feitas pela própria função (R-12: conferência da quarentena) ----------

export type ObjectRead =
  | { status: 'ok'; bytes: Uint8Array }
  | { status: 'ausente' }
  | { status: 'grande' };

/**
 * Baixa um objeto, parando assim que passar de maxBytes: um arquivo grande demais
 * nunca chega inteiro à memória da função.
 */
export async function getObject(key: string, maxBytes: number): Promise<ObjectRead> {
  const res = await r2().fetch(objectUrl(key), { method: 'GET' });
  if (res.status === 404) {
    await res.body?.cancel();
    return { status: 'ausente' };
  }
  if (!res.ok) throw new Error(`R2 GET falhou (HTTP ${res.status}).`);
  if (Number(res.headers.get('content-length') ?? 0) > maxBytes) {
    await res.body?.cancel();
    return { status: 'grande' };
  }
  const parts: Uint8Array[] = [];
  let total = 0;
  for await (const part of res.body ?? []) {
    total += part.byteLength;
    if (total > maxBytes) return { status: 'grande' }; // o for await cancela o resto
    parts.push(part);
  }
  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    bytes.set(p, pos);
    pos += p.byteLength;
  }
  return { status: 'ok', bytes };
}

/** Grava com o checksum SHA-256: o R2 recusa se os bytes chegarem diferentes. */
export async function putObject(key: string, bytes: Uint8Array, mime: string, sha256Hex: string): Promise<void> {
  const res = await r2().fetch(objectUrl(key), {
    method: 'PUT',
    headers: { 'Content-Type': mime, 'x-amz-checksum-sha256': sha256Base64(sha256Hex) },
    body: bytes as Uint8Array<ArrayBuffer>,
  });
  await res.body?.cancel();
  if (!res.ok) throw new Error(`R2 PUT falhou (HTTP ${res.status}).`);
}

/** Apaga um objeto. Só é usado na quarentena: nada em projects/ é apagado. */
export async function deleteQuarantined(key: string): Promise<void> {
  if (!key.startsWith('quarantine/')) throw new Error('Só a quarentena pode ser apagada.');
  const res = await r2().fetch(objectUrl(key), { method: 'DELETE' });
  await res.body?.cancel();
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE falhou (HTTP ${res.status}).`);
}
