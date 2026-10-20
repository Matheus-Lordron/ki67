// Clientes do Supabase dentro das Edge Functions.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

import { HttpError } from './http.ts';

// Aceita as chaves novas (SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS, em JSON)
// e as antigas (SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY).
function pickKey(jsonVar: string, legacyVar: string): string {
  const legacy = Deno.env.get(legacyVar);
  if (legacy) return legacy;
  const dict = Deno.env.get(jsonVar);
  if (dict) {
    const parsed = JSON.parse(dict) as Record<string, string>;
    const key = parsed.default ?? Object.values(parsed)[0];
    if (key) return key;
  }
  throw new Error(`Chave do Supabase ausente (${legacyVar} / ${jsonVar}).`);
}

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = () => pickKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
const serviceKey = () => pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');

/** Repassa o IP e o navegador do usuário para o log de auditoria (request.headers no Postgres). */
function forwardHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip');
  if (ip) headers['x-forwarded-for'] = ip;
  const ua = req.headers.get('user-agent');
  if (ua) headers['user-agent'] = ua;
  return headers;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Ignora o RLS. Use só depois de conferir quem está chamando. */
export function serviceClient(req: Request): SupabaseClient {
  return createClient(url, serviceKey(), { ...noSession, global: { headers: forwardHeaders(req) } });
}

export function anonClient(req: Request): SupabaseClient {
  return createClient(url, anonKey(), { ...noSession, global: { headers: forwardHeaders(req) } });
}

/** Cliente com o JWT do usuário: tudo passa pelo RLS, como se fosse o app. */
export function userClient(req: Request, token: string): SupabaseClient {
  return createClient(url, anonKey(), {
    ...noSession,
    global: { headers: { ...forwardHeaders(req), Authorization: `Bearer ${token}` } },
  });
}

export function decodeJwt(token: string): Record<string, unknown> {
  const payload = token.split('.')[1] ?? '';
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
  return JSON.parse(atob(base64));
}

/** Confere o token do cabeçalho Authorization com o Supabase Auth. */
export async function requireUser(req: Request): Promise<{ user: User; token: string; sessionId: string }> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sessão obrigatória.');
  const { data, error } = await serviceClient(req).auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Sessão inválida ou expirada.');
  const sessionId = String(decodeJwt(token).session_id ?? '');
  if (!sessionId) throw new HttpError(401, 'Sessão inválida.');
  return { user: data.user, token, sessionId };
}

export interface MySession {
  is_active?: boolean;
  roles?: string[];
  name?: string;
  email?: string;
  two_factor_required?: boolean;
  two_factor_verified?: boolean;
}

export async function mySession(req: Request, token: string): Promise<MySession> {
  const { data, error } = await userClient(req, token).rpc('my_session');
  if (error) throw new Error(error.message);
  return data as MySession;
}
