// POST /functions/v1/auth-login  { email, password, device }
//
// Etapa 1 do login (RF-01, RF-02, RNF-06, R-14):
//  - limites a cada 15 min: 5 falhas por e-mail no mesmo IP, 20 por IP e 20 por e-mail
//    (de qualquer IP). Contar por e-mail + IP impede que alguém bloqueie a conta alheia;
//  - confere a senha no Supabase Auth; falha → LOGIN_FALHA no log e mensagem genérica,
//    sempre depois do mesmo tempo mínimo e com espera que cresce a cada falha seguida
//    (conta inexistente, senha errada e conta desativada ficam indistinguíveis);
//  - conta desativada não entra (RF-06);
//  - emite o código 2FA ligado a ESTA sessão e envia por e-mail.
// Devolve os tokens da sessão; o app só acessa dados depois de confirmar o código.
import { sendTwoFactorEmail } from '../_shared/email.ts';
import { clientIp, handle, HttpError, json, readJson } from '../_shared/http.ts';
import { anonClient, decodeJwt, mySession, serviceClient } from '../_shared/supabase.ts';

const GENERIC = 'E-mail ou senha inválidos';
const MAX_FAILURES = 5; // mesmo e-mail no mesmo IP
const MAX_FAILURES_PER_IP = 20; // folga para uma sala inteira atrás do mesmo IP
const MAX_FAILURES_PER_EMAIL = 20; // ataque distribuído contra um e-mail
const MIN_FAILURE_MS = 1000;
const MAX_EXTRA_MS = 4000;

/** Relógio e espera trocáveis nos testes. */
export const tempo = {
  agora: () => Date.now(),
  esperar: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};

export const handler = handle(async (req) => {
  const body = await readJson<{ email?: string; password?: string; device?: string }>(req);
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const device = String(body.device ?? '').slice(0, 300) || null;
  if (!email || !password) throw new HttpError(401, GENERIC);

  const started = tempo.agora();
  const svc = serviceClient(req);
  const ip = clientIp(req);
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const recentFailures = async (filters: Record<string, string>) => {
    let q = svc.from('audit_logs').select('id', { count: 'exact', head: true })
      .eq('action', 'LOGIN_FALHA').gte('occurred_at', since);
    for (const [column, value] of Object.entries(filters)) q = q.eq(column, value);
    return (await q).count ?? 0;
  };
  // Sem IP conhecido, o par vira só o e-mail (o limite antigo).
  const [pair, byIp, byEmail] = await Promise.all([
    recentFailures(ip ? { 'details->>email': email, ip_address: ip } : { 'details->>email': email }),
    ip ? recentFailures({ ip_address: ip }) : Promise.resolve(0),
    recentFailures({ 'details->>email': email }),
  ]);
  if (pair >= MAX_FAILURES || byIp >= MAX_FAILURES_PER_IP || byEmail >= MAX_FAILURES_PER_EMAIL) {
    throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');
  }

  const failure = async (reason: string) => {
    await svc.rpc('log_auth_failure', { p_email: email, p_reason: reason, p_device: device });
    // Mesmo tempo mínimo para qualquer falha, mais uma espera que dobra a cada falha seguida.
    const extra = pair > 0 ? Math.min(250 * 2 ** (pair - 1), MAX_EXTRA_MS) : 0;
    await tempo.esperar(Math.max(0, MIN_FAILURE_MS + extra - (tempo.agora() - started)));
    return new HttpError(401, GENERIC);
  };

  const anon = anonClient(req);
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) throw await failure('credenciais_invalidas');

  const session = await mySession(req, data.session.access_token);
  if (!session.is_active) {
    await anon.auth.signOut();
    throw await failure('usuario_desativado');
  }

  if (session.two_factor_required) {
    const sessionId = String(decodeJwt(data.session.access_token).session_id ?? '');
    const { data: code, error: codeError } = await svc.rpc('issue_two_factor_code', {
      p_user_id: data.user.id,
      p_session_id: sessionId,
    });
    if (codeError) {
      // O app recebe uma mensagem genérica; o motivo real fica em Edge Functions > Logs.
      console.error('issue_two_factor_code falhou', { code: codeError.code, message: codeError.message, details: codeError.details, sessionId });
      throw new HttpError(codeError.code === 'PT429' ? 429 : 500, codeError.code === 'PT429' ? codeError.message : 'Não foi possível gerar o código.');
    }
    await sendTwoFactorEmail(email, session.name ?? email, String(code));
  }

  return json(req, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    two_factor_required: !!session.two_factor_required,
  });
});
