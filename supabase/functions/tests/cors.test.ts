// R-10 · CORS fechado por padrão (S2): sem APP_ORIGINS, navegador nenhum chama as funções.
// O app nativo (Android e iOS) não manda Origin e continua funcionando.
import './_fake.ts';
import { assertEquals } from 'jsr:@std/assert@1';
import { handle, json } from '../_shared/http.ts';

const ORIGINAL = Deno.env.get('APP_ORIGINS');

/** Roda o handler com APP_ORIGINS = `origens` (undefined = sem a variável). */
async function chamar(origens: string | undefined, metodo: string, origem?: string) {
  if (origens === undefined) Deno.env.delete('APP_ORIGINS');
  else Deno.env.set('APP_ORIGINS', origens);
  let rodou = false;
  try {
    const res = await handle(async (r) => {
      rodou = true;
      return json(r, { ok: true }); // como as funções de verdade respondem
    })(new Request('http://funcao.teste/', { method: metodo, headers: origem ? { Origin: origem } : {} }));
    return { res, rodou, allow: res.headers.get('access-control-allow-origin') };
  } finally {
    Deno.env.set('APP_ORIGINS', ORIGINAL!);
  }
}

Deno.test('sem APP_ORIGINS: o navegador recebe 403, sem Allow-Origin: *, e a função não roda', async () => {
  const { res, rodou, allow } = await chamar(undefined, 'POST', 'http://qualquer.site');
  assertEquals(res.status, 403);
  assertEquals(rodou, false);
  assertEquals(allow === '*' || allow === 'http://qualquer.site', false);
});

Deno.test('sem APP_ORIGINS: o preflight do navegador também é recusado', async () => {
  const { res, allow } = await chamar(undefined, 'OPTIONS', 'http://qualquer.site');
  assertEquals(res.status, 403);
  assertEquals(allow === '*' || allow === 'http://qualquer.site', false);
});

Deno.test('sem APP_ORIGINS: o app nativo (sem Origin) continua funcionando', async () => {
  const { res, rodou } = await chamar(undefined, 'POST');
  assertEquals(res.status, 200);
  assertEquals(rodou, true);
});

Deno.test('origem fora da lista: 403 e a função não roda (o efeito não acontece)', async () => {
  const { res, rodou } = await chamar('http://app.teste', 'POST', 'http://site-malicioso.teste');
  assertEquals(res.status, 403);
  assertEquals(rodou, false);
});

Deno.test('origem da lista: liberada com a própria origem no Allow-Origin', async () => {
  const { res, rodou, allow } = await chamar('http://app.teste, https://ki67.exemplo', 'POST', 'https://ki67.exemplo');
  assertEquals(res.status, 200);
  assertEquals(rodou, true);
  assertEquals(allow, 'https://ki67.exemplo');
});

Deno.test('APP_ORIGINS vazio conta como sem a variável', async () => {
  const { res, rodou } = await chamar('  ', 'POST', 'http://qualquer.site');
  assertEquals(res.status, 403);
  assertEquals(rodou, false);
});

Deno.test('APP_ORIGINS=* só libera tudo quando escrito de propósito', async () => {
  const { res, allow } = await chamar('*', 'POST', 'http://qualquer.site');
  assertEquals(res.status, 200);
  assertEquals(allow, '*');
});
