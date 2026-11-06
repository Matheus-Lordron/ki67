// R-06 · Respostas comuns (_shared/http.ts): CORS e erros sem vazar detalhes internos.
import './_fake.ts';
import { assertEquals } from 'jsr:@std/assert@1';
import { handle, HttpError } from '../_shared/http.ts';

const req = (method: string, origin?: string) =>
  new Request('http://funcao.teste/', { method, headers: origin ? { Origin: origin } : {} });

Deno.test('preflight (OPTIONS) responde sem chamar a função', async () => {
  let chamou = false;
  const res = await handle(async () => {
    chamou = true;
    return new Response('x');
  })(req('OPTIONS', 'http://app.teste'));
  assertEquals(res.status, 200);
  assertEquals(chamou, false);
});

Deno.test('CORS: a origem configurada em APP_ORIGINS é liberada', async () => {
  const res = await handle(async () => new Response('ok'))(req('OPTIONS', 'http://app.teste'));
  assertEquals(res.headers.get('access-control-allow-origin'), 'http://app.teste');
});

Deno.test('CORS: origem desconhecida não recebe a própria origem de volta', async () => {
  const res = await handle(async () => new Response('ok'))(req('OPTIONS', 'http://site-malicioso.teste'));
  assertEquals(res.headers.get('access-control-allow-origin') === 'http://site-malicioso.teste', false);
});

Deno.test('HttpError vira a resposta com o status e a mensagem dele', async () => {
  const res = await handle(async () => {
    throw new HttpError(403, 'Proibido.');
  })(req('POST'));
  assertEquals(res.status, 403);
  assertEquals(await res.json(), { error: 'Proibido.' });
});

Deno.test('erro inesperado vira 500 genérico, sem a mensagem interna', async () => {
  const erro = console.error;
  console.error = () => {};
  const res = await handle(async () => {
    throw new Error('senha do banco: xyz');
  })(req('POST'));
  console.error = erro;
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'Erro interno. Tente novamente.' });
});
