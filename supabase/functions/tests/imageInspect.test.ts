// R-12: o inspetor do servidor lê as MESMAS imagens de exemplo que o inspetor do app
// (tests/fixtures/imagens, testadas também em apps/mobile/src/utils/__tests__/imageFixtures.test.ts).
// Os dois precisam achar os mesmos metadados; a saída higienizada pelo app ("-limpo") precisa passar.
import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { ImageFormatError, inspectImage } from '../_shared/imageInspect.ts';

const DIR = new URL('../../../tests/fixtures/imagens/', import.meta.url);
const esperado: Record<string, { mime: string; width: number; height: number; metadados: string[] }> =
  JSON.parse(await Deno.readTextFile(new URL('esperado.json', DIR)));
const ler = (nome: string) => Deno.readFile(new URL(nome, DIR));

Deno.test('toda imagem da pasta de exemplos está em esperado.json', async () => {
  const arquivos: string[] = [];
  for await (const e of Deno.readDir(DIR)) if (/\.(jpg|png|tif)$/.test(e.name)) arquivos.push(e.name);
  assertEquals(arquivos.sort(), Object.keys(esperado).sort());
});

for (const [nome, e] of Object.entries(esperado)) {
  Deno.test(`${nome}: mesmo formato, dimensões e metadados que o app`, async () => {
    assertEquals(inspectImage(await ler(nome)), e);
  });
}

Deno.test('formato fora da lista (GIF) é recusado', () => {
  assertThrows(() => inspectImage(new TextEncoder().encode('GIF89a......')), ImageFormatError);
});

Deno.test('JPEG cortado no meio é recusado', async () => {
  const jpeg = await ler('jpeg-exif-limpo.jpg');
  assertThrows(() => inspectImage(jpeg.subarray(0, 12)), ImageFormatError);
});

Deno.test('PNG sem dimensões é recusado', () => {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const iend = [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0];
  assertThrows(() => inspectImage(new Uint8Array([...sig, ...iend])), ImageFormatError);
});
