// R-12 (S1) · r2-confirm-upload: o arquivo enviado para a quarentena só vira imagem do
// lote depois que o servidor confere hash, tamanho, formato e metadados. Recusado, ele é
// apagado da quarentena e a recusa vai para o log. Nada sob projects/ é apagado.
import { chamadas, chamou, comToken, post, r2Bucket, restaurar, rpc, simular, tabela, tokenValido, USUARIO } from './_fake.ts';
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { handler } from '../r2-confirm-upload/handler.ts';

const FIXTURES = new URL('../../../tests/fixtures/imagens/', import.meta.url);
const LIMPO = await Deno.readFile(new URL('png-texto-limpo.png', FIXTURES)); // 64 x 32
const SUJO = await Deno.readFile(new URL('jpeg-exif-sujo.jpg', FIXTURES));
const JPEG_LIMPO = await Deno.readFile(new URL('jpeg-exif-limpo.jpg', FIXTURES));

const hex = async (b: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b as Uint8Array<ArrayBuffer>)), (x) => x.toString(16).padStart(2, '0')).join('');
const SHA = await hex(LIMPO);
const quarentena = (sha = SHA, ext = 'png') => `quarantine/proj-1/lote-1/${sha}.${ext}`;
const FINAL = `projects/proj-1/batches/lote-1/${SHA}.png`;

const lote = (managerId = USUARIO.id, status = 'ativo') => ({
  id: 'lote-1', project_id: 'proj-1', projects: { manager_id: managerId, status },
});
const REGISTRADO = { ok: true, status: 'uploaded', image_id: 'img-9', image_version_id: 'ver-9', code: 'LT01-0009' };

/** Monta o cenário: o bucket começa só com o arquivo na quarentena. */
function cenario(chave: string, bytes: Uint8Array, extras: Parameters<typeof simular> = []) {
  const objetos = new Map([[chave, bytes]]);
  simular(tokenValido, tabela('batches', [lote()]), tabela('image_versions', []), r2Bucket(objetos),
    rpc('register_verified_image', REGISTRADO), rpc('log_upload_rejected', null), ...extras);
  return objetos;
}
const pedido = (chave: string) => post({ batch_id: 'lote-1', storage_key: chave, organ: 'mama', optical_magnification: '40x', device: 'Chrome' }, comToken);
const nadaApagadoEmProjects = () =>
  assertEquals(chamadas.filter((c) => c.method === 'DELETE' && c.path.includes('/projects/')).length, 0);

Deno.test('arquivo conferido: grava em projects/, registra em nome do gestor e limpa a quarentena', async () => {
  const objetos = cenario(quarentena(), LIMPO);
  const res = await handler(pedido(quarentena()));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), REGISTRADO);
  assertEquals(objetos.get(FINAL), LIMPO);
  assertEquals(objetos.has(quarentena()), false);
  assertEquals(chamou('POST', '/rpc/register_verified_image')[0].body, {
    p_user_id: USUARIO.id, p_batch_id: 'lote-1', p_sha256: SHA, p_storage_key: FINAL,
    p_mime_type: 'image/png', p_size_bytes: LIMPO.byteLength, p_width_px: 64, p_height_px: 32,
    p_organ: 'mama', p_optical_magnification: '40x', p_device: 'Chrome',
  });
  nadaApagadoEmProjects();
  restaurar();
});

Deno.test('a gravação definitiva leva o checksum SHA-256: o R2 confere a integridade', async () => {
  cenario(quarentena(), LIMPO);
  await handler(pedido(quarentena()));
  const put = chamadas.find((c) => c.method === 'PUT' && c.path.includes('/projects/'))!;
  assertEquals(put.headers.get('x-amz-checksum-sha256'), btoa(String.fromCharCode(...SHA.match(/../g)!.map((b) => parseInt(b, 16)))));
  assertEquals(put.headers.get('content-type'), 'image/png');
  restaurar();
});

Deno.test('arquivo com EXIF: recusado, apagado da quarentena, recusa no log e nada registrado', async () => {
  const sha = await hex(SUJO);
  const objetos = cenario(quarentena(sha, 'jpg'), SUJO);
  const body = await (await handler(pedido(quarentena(sha, 'jpg')))).json();
  assertEquals(body.status, 'rejected');
  assertStringIncludes(body.reason, 'metadados');
  assertEquals(objetos.size, 0);
  assertEquals(chamou('POST', '/rpc/register_verified_image').length, 0);
  const log = chamou('POST', '/rpc/log_upload_rejected')[0].body as Record<string, string>;
  assertEquals([log.p_user_id, log.p_batch_id, log.p_sha256], [USUARIO.id, 'lote-1', sha]);
  assertStringIncludes(log.p_reason, 'EXIF');
  restaurar();
});

Deno.test('a versão higienizada pelo app do mesmo arquivo passa', async () => {
  const sha = await hex(JPEG_LIMPO);
  cenario(quarentena(sha, 'jpg'), JPEG_LIMPO);
  assertEquals((await (await handler(pedido(quarentena(sha, 'jpg')))).json()).status, 'uploaded');
  restaurar();
});

Deno.test('conteúdo diferente do hash declarado: recusado e nada registrado', async () => {
  const objetos = cenario(quarentena('f'.repeat(64)), LIMPO);
  const body = await (await handler(pedido(quarentena('f'.repeat(64))))).json();
  assertEquals(body.status, 'rejected');
  assertStringIncludes(body.reason, 'hash');
  assertEquals(objetos.size, 0);
  assertEquals(chamou('POST', '/rpc/register_verified_image').length, 0);
  restaurar();
});

Deno.test('extensão .png com conteúdo JPEG: recusado', async () => {
  const sha = await hex(JPEG_LIMPO);
  cenario(quarentena(sha, 'png'), JPEG_LIMPO);
  const body = await (await handler(pedido(quarentena(sha, 'png')))).json();
  assertEquals(body.status, 'rejected');
  assertEquals(chamou('POST', '/rpc/register_verified_image').length, 0);
  restaurar();
});

Deno.test('arquivo que não é imagem: recusado', async () => {
  const lixo = new TextEncoder().encode('isto não é uma imagem');
  const sha = await hex(lixo);
  cenario(quarentena(sha), lixo);
  assertEquals((await (await handler(pedido(quarentena(sha)))).json()).status, 'rejected');
  restaurar();
});

Deno.test('acima de 50 MB: recusado sem calcular o hash do arquivo todo', async () => {
  const grande = new Uint8Array(50 * 1024 * 1024 + 1);
  const objetos = cenario(quarentena(), grande);
  const body = await (await handler(pedido(quarentena()))).json();
  assertEquals(body.status, 'rejected');
  assertStringIncludes(body.reason, '50 MB');
  assertEquals(objetos.size, 0);
  restaurar();
});

Deno.test('arquivo que não chegou à quarentena: 409 e nada no log', async () => {
  simular(tokenValido, tabela('batches', [lote()]), r2Bucket(new Map()));
  assertEquals((await handler(pedido(quarentena()))).status, 409);
  assertEquals(chamou('POST', '/rpc/').length, 0);
  restaurar();
});

Deno.test('mesmo arquivo já cadastrado: duplicata, quarentena limpa, sem gravar de novo', async () => {
  const objetos = cenario(quarentena(), LIMPO, []);
  simular(tokenValido, tabela('batches', [lote()]),
    tabela('image_versions', [{ id: 'v1', images: { code: 'LT01-0001', project_id: 'proj-1' } }]), r2Bucket(objetos));
  const body = await (await handler(pedido(quarentena()))).json();
  assertEquals(body, { ok: false, status: 'duplicate', existing_code: 'LT01-0001' });
  assertEquals(objetos.size, 0);
  assertEquals(chamadas.filter((c) => c.method === 'PUT').length, 0);
  restaurar();
});

Deno.test('o banco recusa no registro: devolve a recusa e NÃO apaga o arquivo definitivo', async () => {
  const objetos = new Map([[quarentena(), LIMPO]]);
  simular(tokenValido, tabela('batches', [lote()]), tabela('image_versions', []), r2Bucket(objetos),
    rpc('register_verified_image', { ok: false, status: 'rejected', reason: 'O projeto não está ativo.' }));
  const body = await (await handler(pedido(quarentena()))).json();
  assertEquals(body.status, 'rejected');
  assert(objetos.has(FINAL), 'o arquivo definitivo é endereçado pelo hash e pode ser de outra imagem');
  nadaApagadoEmProjects();
  restaurar();
});

for (const [motivo, chave] of Object.entries({
  'fora da quarentena': FINAL,
  'de outro lote': `quarantine/proj-1/lote-2/${SHA}.png`,
  'de outro projeto': `quarantine/proj-2/lote-1/${SHA}.png`,
  'com ../ no caminho': `quarantine/proj-1/lote-1/../${SHA}.png`,
  'extensão fora da lista': `quarantine/proj-1/lote-1/${SHA}.gif`,
})) {
  Deno.test(`chave ${motivo}: 400 sem tocar no R2`, async () => {
    simular(tokenValido, tabela('batches', [lote()]), r2Bucket(new Map()));
    assertEquals((await handler(pedido(chave))).status, 400);
    assertEquals(chamadas.filter((c) => c.host.includes('r2.cloudflarestorage.com')).length, 0);
    restaurar();
  });
}

Deno.test('quem não é o gestor do projeto: 404 sem tocar no R2', async () => {
  simular(tokenValido, tabela('batches', [lote('outro-gestor')]), r2Bucket(new Map()));
  assertEquals((await handler(pedido(quarentena()))).status, 404);
  assertEquals(chamadas.filter((c) => c.host.includes('r2.cloudflarestorage.com')).length, 0);
  restaurar();
});

Deno.test('projeto encerrado: 409 sem tocar no R2', async () => {
  simular(tokenValido, tabela('batches', [lote(USUARIO.id, 'concluido')]), r2Bucket(new Map()));
  assertEquals((await handler(pedido(quarentena()))).status, 409);
  restaurar();
});
