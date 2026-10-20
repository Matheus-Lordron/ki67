// POST /functions/v1/auth-login  { email, password, device }
//
// Etapa 1 do login (RF-01, RF-02, RNF-06):
//  - no máximo 5 falhas por e-mail a cada 15 min;
//  - confere a senha no Supabase Auth; falha → LOGIN_FALHA no log e mensagem genérica;
//  - conta desativada não entra (RF-06);
//  - emite o código 2FA ligado a ESTA sessão e envia por e-mail.
// Devolve os tokens da sessão; o app só acessa dados depois de confirmar o código.
import { sendTwoFactorEmail } from '../_shared/email.ts';
import { handle, HttpError, json, readJson } from '../_shared/http.ts';
import { anonClient, decodeJwt, mySession, serviceClient } from '../_shared/supabase.ts';

const GENERIC = 'E-mail ou senha inválidos';
const MAX_FAILURES = 5;

Deno.serve(
  handle(async (req) => {
    const body = await readJson<{ email?: string; password?: string; device?: string }>(req);
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const device = String(body.device ?? '').slice(0, 300) || null;
    if (!email || !password) throw new HttpError(401, GENERIC);

    const svc = serviceClient(req);
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await svc
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'LOGIN_FALHA')
      .eq('details->>email', email)
      .gte('occurred_at', since);
    if ((count ?? 0) >= MAX_FAILURES) {
      throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');
    }

    const failure = async (reason: string) => {
      await svc.rpc('log_auth_failure', { p_email: email, p_reason: reason, p_device: device });
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
  }),
);
