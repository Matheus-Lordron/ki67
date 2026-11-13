// R-06 · auth-login (RF-01, RF-02, RF-06, RNF-06): limite de tentativas, mensagem
// genérica na falha, conta desativada barrada e código 2FA ligado à sessão.
import { chamadas, chamou, jwt, post, resend, resposta, restaurar, rpc, simular } from './_fake.ts';
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { handler, tempo } from '../auth-login/handler.ts';

// O relógio da função é trocado nos testes: nenhuma espera de verdade.
const esperas: number[] = [];
let relogio = 0;
tempo.esperar = (ms) => (esperas.push(ms), Promise.resolve());
tempo.agora = () => relogio;

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
/** Contagem de falhas recentes feita pelo banco (R-18): o e-mail é comparado pelo hash com sal. */
const falhas = ({ ip = 0, par = 0, email = 0 }) => rpc('count_login_failures', { par, ip, email });
const semFalhas = falhas({});
const sessao = (s: Record<string, unknown>) => rpc('my_session', { is_active: true, name: 'Pessoa', two_factor_required: true, ...s });

Deno.test('login certo: emite o código 2FA ligado a esta sessão e envia por e-mail', async () => {
  simular(semFalhas, senhaCerta, sessao({}), rpc('issue_two_factor_code', '123456'), resend());
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
  simular(semFalhas, senhaCerta, sessao({}), rpc('issue_two_factor_code', '123456'), resend());
  await handler(post(CREDENCIAIS));
  assertEquals((chamou('POST', '/auth/v1/token')[0].body as { email: string }).email, 'pessoa@teste.local');
  restaurar();
});

Deno.test('senha errada: mensagem genérica e LOGIN_FALHA no log', async () => {
  simular(semFalhas, senhaErrada, rpc('log_auth_failure', null));
  const res = await handler(post(CREDENCIAIS));
  assertEquals(res.status, 401);
  assertEquals(await res.json(), GENERICA);
  assertEquals(chamou('POST', '/rpc/log_auth_failure')[0].body,
    { p_email: 'pessoa@teste.local', p_reason: 'credenciais_invalidas', p_device: 'Chrome' });
  restaurar();
});

Deno.test('5 falhas em 15 min: 429, sem nem tentar a senha (RNF-06)', async () => {
  simular(falhas({ par: 5, email: 5 }));
  const res = await handler(post(CREDENCIAIS));
  assertEquals(res.status, 429);
  assertEquals(chamou('POST', '/auth/v1/token').length, 0);
  restaurar();
});

Deno.test('R-18: a contagem é pedida ao banco com o e-mail normalizado, sem filtrar o log pelo e-mail', async () => {
  simular(semFalhas, senhaErrada, rpc('log_auth_failure', null));
  await handler(post(CREDENCIAIS));
  assertEquals(chamou('POST', '/rpc/count_login_failures')[0].body, { p_email: 'pessoa@teste.local' });
  assertEquals(chamadas.filter((c) => c.path.startsWith('/rest/v1/audit_logs')).length, 0);
  restaurar();
});

Deno.test('conta desativada: encerra a sessão aberta e responde a mesma mensagem genérica (RF-06)', async () => {
  simular(semFalhas, senhaCerta, sessao({ is_active: false }), logout, rpc('log_auth_failure', null));
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
  simular(semFalhas, senhaCerta, sessao({}),
    rpc('issue_two_factor_code', { code: 'PT429', message: 'Muitos códigos. Aguarde.' }, 429));
  const res = await handler(post(CREDENCIAIS));
  assertEquals(res.status, 429);
  restaurar();
});

Deno.test('Resend recusa o envio: 502, sem devolver os tokens', async () => {
  const erro = console.error;
  console.error = () => {};
  simular(semFalhas, senhaCerta, sessao({}), rpc('issue_two_factor_code', '123456'), resend(500));
  const res = await handler(post(CREDENCIAIS));
  console.error = erro;
  assertEquals(res.status, 502);
  assertEquals((await res.json()).access_token, undefined);
  restaurar();
});

Deno.test('com o 2FA desligado no banco, entra sem código e sem e-mail', async () => {
  simular(semFalhas, senhaCerta, sessao({ two_factor_required: false }));
  const res = await handler(post(CREDENCIAIS));
  assertEquals((await res.json()).two_factor_required, false);
  assertEquals(chamou('POST', 'api.resend.com').length, 0);
  restaurar();
});

// --- R-14 (S4): limite por IP, por e-mail + IP e por e-mail; mesma resposta e mesmo tempo ---

const IP = '200.10.20.30';
const doIp = (body: unknown) => post(body, { 'x-forwarded-for': `${IP}, 10.0.0.1` });

Deno.test('R-14: 21ª tentativa do mesmo IP, com e-mails diferentes, recebe 429 sem tentar a senha', async () => {
  simular(falhas({ ip: 20 }));
  const res = await handler(doIp({ ...CREDENCIAIS, email: 'outra.pessoa@teste.local' }));
  assertEquals(res.status, 429);
  assertEquals(chamou('POST', '/auth/v1/token').length, 0);
  restaurar();
});

Deno.test('R-14: com 19 falhas no IP, a tentativa ainda segue', async () => {
  simular(falhas({ ip: 19 }), senhaErrada, rpc('log_auth_failure', null));
  assertEquals((await handler(doIp(CREDENCIAIS))).status, 401);
  assertEquals(chamou('POST', '/auth/v1/token').length, 1);
  restaurar();
});

Deno.test('R-14: 5 falhas do mesmo e-mail no mesmo IP: 429', async () => {
  simular(falhas({ ip: 5, par: 5, email: 5 }));
  assertEquals((await handler(doIp(CREDENCIAIS))).status, 429);
  restaurar();
});

Deno.test('R-14: 5 falhas no seu e-mail vindas de OUTRO IP não bloqueiam você (S4)', async () => {
  simular(falhas({ ip: 0, par: 0, email: 5 }), senhaCerta, sessao({}), rpc('issue_two_factor_code', '123456'), resend());
  assertEquals((await handler(doIp(CREDENCIAIS))).status, 200);
  restaurar();
});

Deno.test('R-14: 20 falhas no mesmo e-mail, de IPs variados, bloqueiam o e-mail (ataque distribuído)', async () => {
  simular(falhas({ ip: 0, par: 0, email: 20 }));
  assertEquals((await handler(doIp(CREDENCIAIS))).status, 429);
  restaurar();
});

Deno.test('R-14: conta inexistente e conta desativada respondem igual e no mesmo tempo', async () => {
  const tempoTotal = async (rotas: Parameters<typeof simular>, demora: number) => {
    esperas.length = 0;
    simular(...rotas);
    let chamada = 0;
    tempo.agora = () => (chamada++ === 0 ? 0 : demora); // início e momento da falha
    const res = await handler(doIp(CREDENCIAIS));
    tempo.agora = () => relogio;
    restaurar();
    return { status: res.status, body: await res.json(), total: demora + esperas.reduce((a, b) => a + b, 0) };
  };
  const inexistente = await tempoTotal([falhas({}), senhaErrada, rpc('log_auth_failure', null)], 120);
  const desativada = await tempoTotal([falhas({}), senhaCerta, sessao({ is_active: false }), logout, rpc('log_auth_failure', null)], 650);
  assertEquals(inexistente.status, desativada.status);
  assertEquals(inexistente.body, desativada.body);
  assertEquals(inexistente.total, desativada.total);
});

Deno.test('R-14: a espera cresce a cada falha seguida do mesmo e-mail no mesmo IP', async () => {
  const espera = async (par: number) => {
    esperas.length = 0;
    simular(falhas({ par }), senhaErrada, rpc('log_auth_failure', null));
    await handler(doIp(CREDENCIAIS));
    restaurar();
    return esperas.reduce((a, b) => a + b, 0);
  };
  const [zero, uma, tres] = [await espera(0), await espera(1), await espera(3)];
  assert(zero < uma && uma < tres, `esperas: ${zero}, ${uma}, ${tres}`);
});

Deno.test('R-14: o IP do usuário segue para o banco, que conta pela mesma regra do log', async () => {
  simular(semFalhas, senhaErrada, rpc('log_auth_failure', null));
  await handler(doIp(CREDENCIAIS));
  for (const nome of ['count_login_failures', 'log_auth_failure']) {
    assertEquals(chamou('POST', `/rpc/${nome}`)[0].headers.get('x-forwarded-for'), `${IP}, 10.0.0.1`);
  }
  restaurar();
});
