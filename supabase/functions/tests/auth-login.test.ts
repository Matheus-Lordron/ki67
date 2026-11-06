// R-06 · auth-login (RF-01, RF-02, RF-06, RNF-06): limite de tentativas, mensagem
// genérica na falha, conta desativada barrada e código 2FA ligado à sessão.
import { chamadas, chamou, contagem, jwt, post, resend, resposta, restaurar, rpc, simular } from './_fake.ts';
import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { handler } from '../auth-login/handler.ts';

const GENERICA = { error: 'E-mail ou senha inválidos' };
const SESSAO = '10000000-0000-4000-8000-0000000000aa';
const ACESSO = jwt({ sub: 'u1', session_id: SESSAO, role: 'authenticated' });
const CREDENCIAIS = { email: '  Pessoa@Teste.Local ', password: 'senha-certa', device: 'Chrome' };

const senhaCerta = (c: { method: string; path: string }) =>
  c.method === 'POST' && c.path.startsWith('/auth/v1/token?grant_type=password')
    ? resposta({ access_token: ACESSO, refresh_token: 'refresh', token_type: 'bearer', expires_in: 3600,
                 user: { id: 'u1', email: 'pessoa@teste.local' } })
    : undefined;
const senhaErrada = (c: { method: string; path: string }) =>
  c.path.startsWith('/auth/v1/token') ? resposta({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400) : undefined;
const logout = (c: { path: string }) => (c.path.startsWith('/auth/v1/logout') ? resposta(undefined, 204) : undefined);
const sessao = (s: Record<string, unknown>) => rpc('my_session', { is_active: true, name: 'Pessoa', two_factor_required: true, ...s });

Deno.test('login certo: emite o código 2FA ligado a esta sessão e envia por e-mail', async () => {
  simular(contagem('audit_logs', 0), senhaCerta, sessao({}), rpc('issue_two_factor_code', '123456'), resend());
  const res = await handler(post(CREDENCIAIS));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { access_token: ACESSO, refresh_token: 'refresh', two_factor_required: true });
  const emissao = chamou('POST', '/rpc/issue_two_factor_code')[0];
  assertEquals(emissao.body, { p_user_id: 'u1', p_session_id: SESSAO });
  const email = chamou('POST', 'api.resend.com')[0].body as { to: string[]; subject: string };
  assertEquals(email.to, ['pessoa@teste.local']);
  assertStringIncludes(email.subject, '123456');
  restaurar();
});

Deno.test('o e-mail chega normalizado (minúsculas, sem espaços) ao Supabase Auth', async () => {
  simular(contagem('audit_logs', 0), senhaCerta, sessao({}), rpc('issue_two_factor_code', '123456'), resend());
  await handler(post(CREDENCIAIS));
  assertEquals((chamou('POST', '/auth/v1/token')[0].body as { email: string }).email, 'pessoa@teste.local');
  restaurar();
});

Deno.test('senha errada: mensagem genérica e LOGIN_FALHA no log', async () => {
  simular(contagem('audit_logs', 0), senhaErrada, rpc('log_auth_failure', null));
  const res = await handler(post(CREDENCIAIS));
  assertEquals(res.status, 401);
  assertEquals(await res.json(), GENERICA);
  assertEquals(chamou('POST', '/rpc/log_auth_failure')[0].body,
    { p_email: 'pessoa@teste.local', p_reason: 'credenciais_invalidas', p_device: 'Chrome' });
  restaurar();
});

Deno.test('5 falhas em 15 min: 429, sem nem tentar a senha (RNF-06)', async () => {
  simular(contagem('audit_logs', 5));
  const res = await handler(post(CREDENCIAIS));
  assertEquals(res.status, 429);
  assertEquals(chamou('POST', '/auth/v1/token').length, 0);
  restaurar();
});

Deno.test('a contagem de falhas olha LOGIN_FALHA do mesmo e-mail nos últimos 15 min', async () => {
  simular(contagem('audit_logs', 0), senhaErrada, rpc('log_auth_failure', null));
  await handler(post(CREDENCIAIS));
  const consulta = decodeURIComponent(chamadas.find((c) => c.method === 'HEAD')!.path);
  assertStringIncludes(consulta, 'action=eq.LOGIN_FALHA');
  assertStringIncludes(consulta, 'details->>email=eq.pessoa@teste.local');
  assertStringIncludes(consulta, 'occurred_at=gte.');
  restaurar();
});

Deno.test('conta desativada: encerra a sessão aberta e responde a mesma mensagem genérica (RF-06)', async () => {
  simular(contagem('audit_logs', 0), senhaCerta, sessao({ is_active: false }), logout, rpc('log_auth_failure', null));
  const res = await handler(post(CREDENCIAIS));
  assertEquals(res.status, 401);
  assertEquals(await res.json(), GENERICA);
  assertEquals(chamou('POST', '/auth/v1/logout').length, 1);
  assertEquals((chamou('POST', '/rpc/log_auth_failure')[0].body as { p_reason: string }).p_reason, 'usuario_desativado');
  restaurar();
});

Deno.test('sem e-mail ou senha: 401 genérico, sem consultar nada', async () => {
  simular();
  const res = await handler(post({ email: '', password: '' }));
  assertEquals(res.status, 401);
  assertEquals(await res.json(), GENERICA);
  assertEquals(chamadas.length, 0);
  restaurar();
});

Deno.test('limite de códigos do banco (PT429) vira 429 com a mensagem do banco', async () => {
  simular(contagem('audit_logs', 0), senhaCerta, sessao({}),
    rpc('issue_two_factor_code', { code: 'PT429', message: 'Muitos códigos. Aguarde.' }, 429));
  const res = await handler(post(CREDENCIAIS));
  assertEquals(res.status, 429);
  restaurar();
});

Deno.test('Resend recusa o envio: 502, sem devolver os tokens', async () => {
  const erro = console.error;
  console.error = () => {};
  simular(contagem('audit_logs', 0), senhaCerta, sessao({}), rpc('issue_two_factor_code', '123456'), resend(500));
  const res = await handler(post(CREDENCIAIS));
  console.error = erro;
  assertEquals(res.status, 502);
  assertEquals((await res.json()).access_token, undefined);
  restaurar();
});

Deno.test('com o 2FA desligado no banco, entra sem código e sem e-mail', async () => {
  simular(contagem('audit_logs', 0), senhaCerta, sessao({ two_factor_required: false }));
  const res = await handler(post(CREDENCIAIS));
  assertEquals((await res.json()).two_factor_required, false);
  assertEquals(chamou('POST', 'api.resend.com').length, 0);
  restaurar();
});
