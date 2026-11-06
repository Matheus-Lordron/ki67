// R-06 · r2-download-url (RF-28, RNV-06): URL de leitura só para quem o RLS deixa ver.
import { chamadas, comToken, post, restaurar, simular, tabela, tokenInvalido, tokenValido } from './_fake.ts';
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { handler } from '../r2-download-url/handler.ts';

const VERSAO = { id: 'v1', storage_key: 'projects/p/batches/b/abc.png', preview_storage_key: 'projects/p/batches/b/abc-preview.jpg' };

Deno.test('sem token: 401 e nenhuma URL', async () => {
  simular(tokenInvalido);
  const res = await handler(post({ image_version_id: 'v1' }));
  assertEquals(res.status, 401);
  restaurar();
});

Deno.test('a consulta da imagem vai com o token do usuário (o RLS decide)', async () => {
  simular(tokenValido, tabela('image_versions', [VERSAO]));
  await handler(post({ image_version_id: 'v1' }, comToken));
  const consulta = chamadas.find((c) => c.path.startsWith('/rest/v1/image_versions'));
  assertEquals(consulta?.headers.get('authorization'), comToken.Authorization);
  restaurar();
});

Deno.test('imagem que o RLS não devolve: 404, sem URL', async () => {
  simular(tokenValido, tabela('image_versions', []));
  const res = await handler(post({ image_version_id: 'v1' }, comToken));
  assertEquals(res.status, 404);
  assertEquals((await res.json()).url, undefined);
  restaurar();
});

Deno.test('URL assinada do R2, válida por 5 min e sem cache (RNF-06)', async () => {
  simular(tokenValido, tabela('image_versions', [VERSAO]));
  const res = await handler(post({ image_version_id: 'v1' }, comToken));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  const url = new URL(body.url);
  assertEquals(url.host, 'conta-teste.r2.cloudflarestorage.com');
  assertEquals(url.searchParams.get('X-Amz-Expires'), '300');
  assertEquals(url.searchParams.get('response-cache-control'), 'no-store');
  assert(url.searchParams.get('X-Amz-Signature'), 'a URL precisa estar assinada');
  assertEquals(body.expires_in, 300);
  restaurar();
});

Deno.test('por padrão entrega a cópia reduzida; com variant=original, o arquivo original', async () => {
  simular(tokenValido, tabela('image_versions', [VERSAO]));
  const reduzida = await (await handler(post({ image_version_id: 'v1' }, comToken))).json();
  assertStringIncludes(reduzida.url, 'abc-preview.jpg');
  const original = await (await handler(post({ image_version_id: 'v1', variant: 'original' }, comToken))).json();
  assertStringIncludes(original.url, 'abc.png');
  restaurar();
});

Deno.test('pedido sem imagem: 400', async () => {
  simular(tokenValido);
  assertEquals((await handler(post({}, comToken))).status, 400);
  restaurar();
});
