// R-06 · r2-upload-url (RF-08, RF-11): só o gestor do projeto recebe a URL de envio;
// arquivo repetido é avisado antes do envio; a chave no bucket vem do hash.
import { chamadas, comToken, post, restaurar, simular, tabela, tokenValido, USUARIO } from './_fake.ts';
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { handler } from '../r2-upload-url/handler.ts';

const SHA = 'a'.repeat(64);
const PEDIDO = { batch_id: 'lote-1', sha256: SHA, mime_type: 'image/png', size_bytes: 1024 };
const lote = (managerId: string, status = 'ativo') => ({
  id: 'lote-1', project_id: 'proj-1', projects: { manager_id: managerId, status },
});

Deno.test('o gestor do projeto recebe a URL de PUT assinada, com a chave derivada do hash', async () => {
  simular(tokenValido, tabela('batches', [lote(USUARIO.id)]), tabela('image_versions', []));
  const res = await handler(post(PEDIDO, comToken));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.duplicate, false);
  assertEquals(body.storage_key, `projects/proj-1/batches/lote-1/${SHA}.png`);
  const url = new URL(body.upload_url);
  assertEquals(url.pathname, `/ki67-teste/projects/proj-1/batches/lote-1/${SHA}.png`);
  assertEquals(url.searchParams.get('X-Amz-Expires'), '600');
  assert(url.searchParams.get('X-Amz-Signature'));
  restaurar();
});

Deno.test('o lote é consultado com o token do usuário (RLS)', async () => {
  simular(tokenValido, tabela('batches', [lote(USUARIO.id)]), tabela('image_versions', []));
  await handler(post(PEDIDO, comToken));
  const consulta = chamadas.find((c) => c.path.startsWith('/rest/v1/batches'));
  assertEquals(consulta?.headers.get('authorization'), comToken.Authorization);
  restaurar();
});

Deno.test('quem não é o gestor do projeto: 404, como se o lote não existisse', async () => {
  simular(tokenValido, tabela('batches', [lote('outro-gestor')]));
  assertEquals((await handler(post(PEDIDO, comToken))).status, 404);
  restaurar();
});

Deno.test('lote invisível pelo RLS: 404', async () => {
  simular(tokenValido, tabela('batches', []));
  assertEquals((await handler(post(PEDIDO, comToken))).status, 404);
  restaurar();
});

Deno.test('projeto encerrado: 409', async () => {
  simular(tokenValido, tabela('batches', [lote(USUARIO.id, 'concluido')]));
  assertEquals((await handler(post(PEDIDO, comToken))).status, 409);
  restaurar();
});

Deno.test('arquivo já cadastrado no mesmo projeto: avisa a duplicata e não devolve URL (RF-11)', async () => {
  simular(tokenValido, tabela('batches', [lote(USUARIO.id)]),
    tabela('image_versions', [{ id: 'v9', images: { code: 'LT01-0007', project_id: 'proj-1' } }]));
  const body = await (await handler(post(PEDIDO, comToken))).json();
  assertEquals(body, { duplicate: true, existing_code: 'LT01-0007' });
  restaurar();
});

Deno.test('duplicata de OUTRO projeto: avisa sem revelar o código da imagem alheia', async () => {
  simular(tokenValido, tabela('batches', [lote(USUARIO.id)]),
    tabela('image_versions', [{ id: 'v9', images: { code: 'LT01-0007', project_id: 'proj-2' } }]));
  const body = await (await handler(post(PEDIDO, comToken))).json();
  assertEquals(body, { duplicate: true, existing_code: null });
  restaurar();
});

for (const [motivo, pedido] of Object.entries({
  'hash inválido': { ...PEDIDO, sha256: 'xyz' },
  'formato não aceito': { ...PEDIDO, mime_type: 'image/gif' },
  'arquivo vazio': { ...PEDIDO, size_bytes: 0 },
  'acima de 50 MB': { ...PEDIDO, size_bytes: 50 * 1024 * 1024 + 1 },
})) {
  Deno.test(`recusa antes de consultar o banco: ${motivo} (400)`, async () => {
    simular(tokenValido);
    assertEquals((await handler(post(pedido, comToken))).status, 400);
    assertEquals(chamadas.filter((c) => c.path.startsWith('/rest/')).length, 0);
    restaurar();
  });
}

// R-11 (S1): a URL de envio amarra tamanho, tipo e o SHA-256 informado. O R2 recusa um PUT
// com qualquer um deles diferente do que foi assinado.
const hexParaBase64 = (hex: string) => btoa(String.fromCharCode(...hex.match(/../g)!.map((b) => parseInt(b, 16))));

Deno.test('a URL assinada carrega Content-Length, Content-Type e o checksum SHA-256 (R-11)', async () => {
  simular(tokenValido, tabela('batches', [lote(USUARIO.id)]), tabela('image_versions', []));
  const body = await (await handler(post(PEDIDO, comToken))).json();
  const assinados = new URL(body.upload_url).searchParams.get('X-Amz-SignedHeaders')!.split(';');
  for (const h of ['content-length', 'content-type', 'host', 'x-amz-checksum-sha256']) {
    assert(assinados.includes(h), `${h} precisa estar entre os cabeçalhos assinados (${assinados.join(';')})`);
  }
  restaurar();
});

Deno.test('devolve ao app os cabeçalhos que o PUT precisa mandar, com o checksum em base64 (R-11)', async () => {
  simular(tokenValido, tabela('batches', [lote(USUARIO.id)]), tabela('image_versions', []));
  const body = await (await handler(post(PEDIDO, comToken))).json();
  assertEquals(body.headers, { 'Content-Type': 'image/png', 'x-amz-checksum-sha256': hexParaBase64(SHA) });
  restaurar();
});
