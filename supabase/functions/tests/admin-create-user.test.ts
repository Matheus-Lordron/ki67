// R-06 · admin-create-user (RF-04, RF-06, RF-07): só o admin ativo e com 2FA cadastra;
// a conta nasce sem senha conhecida e os papéis vão no app_metadata.
import { chamou, comToken, post, resposta, restaurar, rpc, simular, tokenInvalido, tokenValido, USUARIO } from './_fake.ts';
import { assertEquals } from 'jsr:@std/assert@1';
import { handler } from '../admin-create-user/handler.ts';

const NOVO = { name: 'Nova Pessoa', email: ' Nova@Teste.Local ', institution: 'FMUSP', roles: ['Avaliador', 'validador', 'superusuario'] };
const admin = (s: Record<string, unknown> = {}) =>
  rpc('my_session', { is_active: true, roles: ['admin'], two_factor_required: true, two_factor_verified: true, ...s });
const criado = (c: { method: string; path: string }) =>
  c.method === 'POST' && c.path === '/auth/v1/admin/users' ? resposta({ id: 'novo-id', email: 'nova@teste.local' }) : undefined;
const duplicado = (c: { path: string }) =>
  c.path === '/auth/v1/admin/users' ? resposta({ msg: 'A user with this email address has already been registered' }, 422) : undefined;
const convite = (c: { path: string }) => (c.path.startsWith('/auth/v1/recover') ? resposta({}) : undefined);

Deno.test('o admin cadastra: papéis válidos e autor no app_metadata, sem senha', async () => {
  simular(tokenValido, admin(), criado, convite);
  const res = await handler(post(NOVO, comToken));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true, user_id: 'novo-id', invite_sent: true });
  const corpo = chamou('POST', '/auth/v1/admin/users')[0].body as Record<string, unknown>;
  assertEquals(corpo.email, 'nova@teste.local');
  assertEquals(corpo.app_metadata, { roles: ['avaliador', 'validador'], created_by: USUARIO.id });
  assertEquals('password' in corpo, false);
  restaurar();
});

Deno.test('o novo usuário recebe o link para definir a própria senha', async () => {
  simular(tokenValido, admin(), criado, convite);
  await handler(post(NOVO, comToken));
  const pedido = chamou('POST', '/auth/v1/recover')[0];
  assertEquals((pedido.body as { email: string }).email, 'nova@teste.local');
  assertEquals(new URL('http://x' + pedido.path).searchParams.get('redirect_to'), 'http://app.teste/redefinir-senha');
  restaurar();
});

for (const [quem, sessao] of Object.entries({
  'quem não é admin': { roles: ['gestor'] },
  'admin desativado': { is_active: false },
  'admin sem o 2FA confirmado': { two_factor_verified: false },
})) {
  Deno.test(`${quem}: 403 e nenhuma conta criada`, async () => {
    simular(tokenValido, admin(sessao));
    assertEquals((await handler(post(NOVO, comToken))).status, 403);
    assertEquals(chamou('POST', '/auth/v1/admin/users').length, 0);
    restaurar();
  });
}

Deno.test('sem sessão válida: 401', async () => {
  simular(tokenInvalido);
  assertEquals((await handler(post(NOVO, comToken))).status, 401);
  restaurar();
});

Deno.test('sem nenhum papel válido: 400', async () => {
  simular(tokenValido, admin());
  assertEquals((await handler(post({ ...NOVO, roles: ['superusuario'] }, comToken))).status, 400);
  restaurar();
});

Deno.test('e-mail inválido: 400', async () => {
  simular(tokenValido, admin());
  assertEquals((await handler(post({ ...NOVO, email: 'sem-arroba' }, comToken))).status, 400);
  restaurar();
});

Deno.test('e-mail já cadastrado: 409', async () => {
  simular(tokenValido, admin(), duplicado);
  const res = await handler(post(NOVO, comToken));
  assertEquals(res.status, 409);
  assertEquals(await res.json(), { error: 'Já existe um usuário com este e-mail.' });
  restaurar();
});
