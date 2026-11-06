// R-06: simulação dos serviços externos para os testes das Edge Functions.
// Supabase (Auth e PostgREST) e Resend falam por HTTP: trocamos o fetch global por
// rotas falsas. O R2 não precisa de rede: a URL é assinada localmente.
// Importe ESTE arquivo antes de qualquer handler: as variáveis de ambiente são lidas
// quando os módulos de _shared carregam.

const ENV: Record<string, string> = {
  SUPABASE_URL: 'http://supabase.test',
  SUPABASE_ANON_KEY: 'chave-publica-de-teste',
  SUPABASE_SERVICE_ROLE_KEY: 'chave-secreta-de-teste',
  R2_ACCOUNT_ID: 'conta-teste',
  R2_ACCESS_KEY_ID: 'id-de-teste',
  R2_SECRET_ACCESS_KEY: 'segredo-de-teste',
  R2_BUCKET: 'ki67-teste',
  R2_DOWNLOAD_URL_TTL: '300',
  R2_UPLOAD_URL_TTL: '600',
  RESEND_API_KEY: 're_teste',
  MAIL_FROM: 'Teste <teste@teste.local>',
  APP_URL: 'http://app.teste',
  APP_ORIGINS: 'http://app.teste',
};
for (const [k, v] of Object.entries(ENV)) Deno.env.set(k, v);

export interface Chamada {
  method: string;
  path: string; // caminho + query, sem o host do Supabase
  host: string;
  headers: Headers;
  body: unknown;
}

type Rota = (c: Chamada) => Response | undefined | Promise<Response | undefined>;

export const chamadas: Chamada[] = [];
let rotas: Rota[] = [];
const fetchOriginal = globalThis.fetch;

/** Instala as rotas deste teste. A primeira que devolver uma Response responde. */
export function simular(...novas: Rota[]) {
  chamadas.length = 0;
  rotas = novas;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const texto = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text();
    let body: unknown = texto;
    try {
      body = texto ? JSON.parse(texto) : undefined;
    } catch { /* corpo não-JSON fica como texto */ }
    const c: Chamada = { method: req.method, path: url.pathname + url.search, host: url.host, headers: req.headers, body };
    chamadas.push(c);
    for (const r of rotas) {
      const res = await r(c);
      if (res) return res;
    }
    throw new Error(`chamada não prevista no teste: ${c.method} ${url.href}`);
  };
}

export function restaurar() {
  globalThis.fetch = fetchOriginal;
}

export const resposta = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** JWT de mentira: só o payload importa para as funções (a assinatura é do Supabase). */
export function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.assinatura`;
}

export const USUARIO = { id: '00000000-0000-4000-8000-000000000004', email: 'avaliador@teste.local' };
export const SESSAO = '10000000-0000-4000-8000-000000000004';
export const TOKEN = jwt({ sub: USUARIO.id, session_id: SESSAO, role: 'authenticated' });

// --- Rotas prontas -----------------------------------------------------------------

const ehSupabase = (c: Chamada) => c.host === 'supabase.test';

/** GET /auth/v1/user: o token é válido e pertence a USUARIO. */
export const tokenValido: Rota = (c) =>
  ehSupabase(c) && c.method === 'GET' && c.path === '/auth/v1/user' ? resposta(USUARIO) : undefined;

export const tokenInvalido: Rota = (c) =>
  ehSupabase(c) && c.path === '/auth/v1/user' ? resposta({ message: 'invalid JWT' }, 401) : undefined;

/** POST /rest/v1/rpc/<nome> respondendo com `body`. */
export const rpc = (nome: string, body: unknown, status = 200): Rota => (c) =>
  ehSupabase(c) && c.method === 'POST' && c.path === `/rest/v1/rpc/${nome}` ? resposta(body, status) : undefined;

/** GET/HEAD /rest/v1/<tabela>?... respondendo com as linhas (e Content-Range para count). */
export const tabela = (nome: string, linhas: unknown[]): Rota => (c) => {
  if (!ehSupabase(c) || !c.path.startsWith(`/rest/v1/${nome}?`)) return undefined;
  const objeto = (c.headers.get('accept') ?? '').includes('vnd.pgrst.object');
  if (objeto) return linhas.length ? resposta(linhas[0]) : resposta({ code: 'PGRST116', message: 'no rows' }, 406);
  return resposta(c.method === 'HEAD' ? undefined : linhas, 200, { 'Content-Range': `0-${Math.max(linhas.length - 1, 0)}/${linhas.length}` });
};

/** HEAD com count: devolve só o total. */
export const contagem = (nome: string, total: number): Rota => (c) =>
  ehSupabase(c) && c.method === 'HEAD' && c.path.startsWith(`/rest/v1/${nome}?`)
    ? new Response(null, { status: 200, headers: { 'Content-Range': `*/${total}` } })
    : undefined;

/** Envio pelo Resend. */
export const resend = (status = 200): Rota => (c) =>
  c.host === 'api.resend.com' ? resposta(status === 200 ? { id: 'email-teste' } : { message: 'recusado' }, status) : undefined;

export const chamou = (metodo: string, trecho: string) =>
  chamadas.filter((c) => c.method === metodo && (c.path.includes(trecho) || c.host.includes(trecho)));

export const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://funcao.teste/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://app.teste', ...headers },
    body: JSON.stringify(body),
  });

export const comToken = { Authorization: `Bearer ${TOKEN}` };
