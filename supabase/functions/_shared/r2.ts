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

/** Gera uma URL assinada (PUT para enviar, GET para ler) válida por ttlSeconds. */
export async function presign(method: 'GET' | 'PUT', key: string, ttlSeconds: number, query: Record<string, string> = {}): Promise<string> {
  const path = key.split('/').map(encodeURIComponent).join('/');
  // Estilo "path": https://<conta>.r2.cloudflarestorage.com/<bucket>/<chave>
  const url = new URL(`https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}/${path}`);
  url.searchParams.set('X-Amz-Expires', String(ttlSeconds));
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const signed = await r2().sign(new Request(url, { method }), { aws: { signQuery: true } });
  return signed.url;
}

export const ttl = (name: string, fallback: number) => Number(Deno.env.get(name) ?? fallback);
