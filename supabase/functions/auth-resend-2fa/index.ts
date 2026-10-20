// POST /functions/v1/auth-resend-2fa  (com o token da sessão que aguarda o código)
// Gera um novo código para a mesma sessão e reenvia por e-mail (RF-02).
// O banco limita a 5 códigos a cada 15 min por usuário.
import { sendTwoFactorEmail } from '../_shared/email.ts';
import { handle, HttpError, json } from '../_shared/http.ts';
import { mySession, requireUser, serviceClient } from '../_shared/supabase.ts';

Deno.serve(
  handle(async (req) => {
    const { user, token, sessionId } = await requireUser(req);
    const session = await mySession(req, token);
    if (!session.is_active) throw new HttpError(401, 'Usuário desativado.');
    if (session.two_factor_verified) return json(req, { ok: true, already_verified: true });

    const { data: code, error } = await serviceClient(req).rpc('issue_two_factor_code', {
      p_user_id: user.id,
      p_session_id: sessionId,
    });
    if (error) console.error('issue_two_factor_code falhou', { code: error.code, message: error.message, details: error.details, sessionId });
    if (error) throw new HttpError(error.code === 'PT429' ? 429 : 500, error.code === 'PT429' ? error.message : 'Não foi possível gerar o código.');
    await sendTwoFactorEmail(user.email ?? session.email ?? '', session.name ?? '', String(code));
    return json(req, { ok: true });
  }),
);
