// R-06 · auth-resend-2fa (RF-02): novo código para a MESMA sessão, com o limite do banco.
import { chamou, comToken, post, resend, restaurar, rpc, SESSAO, simular, tokenInvalido, tokenValido, USUARIO } from './_fake.ts';
import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { handler } from '../auth-resend-2fa/handler.ts';

const sessao = (s: Record<string, unknown> = {}) =>
  rpc('my_session', { is_active: true, name: 'Pessoa', two_factor_verified: false, ...s });

Deno.test('reenvia um código novo ligado à mesma sessão', async () => {
  simular(tokenValido, sessao(), rpc('issue_two_factor_code', '654321'), resend());
  const res = await handler(post({}, comToken));
  assertEquals(await res.json(), { ok: true });
  assertEquals(chamou('POST', '/rpc/issue_two_factor_code')[0].body, { p_user_id: USUARIO.id, p_session_id: SESSAO });
  const email = chamou('POST', 'api.resend.com')[0].body as { to: string[]; text: string };
  assertEquals(email.to, [USUARIO.email]);
  assertStringIncludes(email.text, '654321');
  restaurar();
});

Deno.test('sessão já confirmada: não gera código nem envia e-mail', async () => {
  simular(tokenValido, sessao({ two_factor_verified: true }));
  assertEquals(await (await handler(post({}, comToken))).json(), { ok: true, already_verified: true });
  assertEquals(chamou('POST', '/rpc/issue_two_factor_code').length, 0);
  restaurar();
});

Deno.test('usuário desativado: 401, sem código', async () => {
  simular(tokenValido, sessao({ is_active: false }));
  assertEquals((await handler(post({}, comToken))).status, 401);
  assertEquals(chamou('POST', '/rpc/issue_two_factor_code').length, 0);
  restaurar();
});

Deno.test('limite de 5 códigos em 15 min (PT429): 429', async () => {
  const erro = console.error;
  console.error = () => {};
  simular(tokenValido, sessao(), rpc('issue_two_factor_code', { code: 'PT429', message: 'Muitos códigos. Aguarde.' }, 429));
  const res = await handler(post({}, comToken));
  console.error = erro;
  assertEquals(res.status, 429);
  assertEquals(chamou('POST', 'api.resend.com').length, 0);
  restaurar();
});

Deno.test('sem sessão válida: 401', async () => {
  simular(tokenInvalido);
  assertEquals((await handler(post({}, comToken))).status, 401);
  restaurar();
});
