// Respostas JSON e CORS comuns a todas as Edge Functions.

// CORS fechado por padrão (R-10): sem APP_ORIGINS, nenhuma origem de navegador passa.
// "*" só vale se estiver escrito de propósito na variável.
const allowedOrigins = () =>
  (Deno.env.get('APP_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean);

/** O app nativo não manda Origin; o navegador sempre manda. */
function originAllowed(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const allowed = allowedOrigins();
  return allowed.includes('*') || allowed.includes(origin);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = allowedOrigins();
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (allowed.includes('*')) headers['Access-Control-Allow-Origin'] = '*';
  else if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders(req) }) : null;
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Envolve o handler: CORS, JSON e erros viram respostas sem vazar detalhes internos. */
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    // Origem fora da lista: recusa antes de rodar, porque o CORS sozinho só impede o
    // navegador de LER a resposta; o efeito (login, cadastro) aconteceria mesmo assim.
    if (!originAllowed(req)) return json(req, { error: 'Origem não autorizada.' }, 403);
    const early = preflight(req);
    if (early) return early;
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json(req, { error: e.message }, e.status);
      console.error(e);
      return json(req, { error: 'Erro interno. Tente novamente.' }, 500);
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Corpo da requisição inválido.');
  }
}
