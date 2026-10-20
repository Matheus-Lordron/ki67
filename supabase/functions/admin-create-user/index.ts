// POST /functions/v1/admin-create-user  { name, email, institution?, roles: ['avaliador', ...] }
//
// Cadastro de usuário pelo administrador (RF-04, RF-06, RF-07):
//  - só um admin ativo, com 2FA confirmado, pode chamar;
//  - a conta nasce SEM senha conhecida: o usuário recebe por e-mail um link para
//    criar a própria senha (o admin nunca vê nem escolhe a senha);
//  - papéis e autor vão no app_metadata, que só o servidor grava, e o trigger do
//    banco cria o perfil e registra USUARIO_CRIADO no log.
import { handle, HttpError, json, readJson } from '../_shared/http.ts';
import { anonClient, mySession, requireUser, serviceClient } from '../_shared/supabase.ts';

const ROLES = ['admin', 'gestor', 'avaliador', 'validador'];

Deno.serve(
  handle(async (req) => {
    const { user, token } = await requireUser(req);
    const caller = await mySession(req, token);
    const verified = caller.two_factor_verified || !caller.two_factor_required;
    if (!caller.is_active || !verified || !caller.roles?.includes('admin')) {
      throw new HttpError(403, 'Somente o administrador cadastra usuários.');
    }

    const body = await readJson<{ name?: string; email?: string; institution?: string; roles?: string[] }>(req);
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const roles = Array.from(new Set((body.roles ?? []).map((r) => String(r).toLowerCase()))).filter((r) => ROLES.includes(r));
    if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Nome e e-mail válidos são obrigatórios.');
    if (!roles.length) throw new HttpError(400, 'Escolha ao menos um papel.');

    const svc = serviceClient(req);
    const { data, error } = await svc.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { roles, created_by: user.id },
      user_metadata: { name, institution: String(body.institution ?? '').trim() || undefined },
    });
    if (error || !data.user) {
      const duplicated = /already|registered|exists/i.test(error?.message ?? '');
      throw new HttpError(duplicated ? 409 : 400, duplicated ? 'Já existe um usuário com este e-mail.' : 'Não foi possível criar o usuário.');
    }

    // Link de uso único para o novo usuário definir a senha (e-mail do Supabase Auth).
    const redirectTo = `${(Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')}/redefinir-senha`;
    const { error: mailError } = await anonClient(req).auth.resetPasswordForEmail(email, { redirectTo });

    return json(req, { ok: true, user_id: data.user.id, invite_sent: !mailError });
  }),
);
