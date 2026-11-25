// R-12: imagens de exemplo usadas pelos DOIS inspetores de metadados, o do app
// (apps/mobile/src/utils/imageMetadata.ts, Jest) e o do servidor
// (supabase/functions/_shared/imageInspect.ts, Deno). Se um deles mudar e o outro não,
// os testes dos dois lados leem os mesmos arquivos e acusam a diferença.
//
// As "-sujo" têm metadados de texto (dados fictícios). As "-limpo" são a saída da
// higienização do APP para a "-sujo" correspondente: o servidor precisa aceitá-las.
//
// Ferramenta de teste, não vai para produção. Para regerar (na raiz do repositório):
//   deno run --allow-read --allow-write tests/fixtures/imagens/gerar.ts
import { inspectImage, sanitizeImage } from '../../../apps/mobile/src/utils/imageMetadata.ts';

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const u16be = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const u16le = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u32le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

const seg = (marker: number, payload: number[]) => [0xff, marker, ...u16be(payload.length + 2), ...payload];
const sof = (w: number, h: number) => seg(0xc0, [8, ...u16be(h), ...u16be(w), 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]);
const jpeg = (...segments: number[][]) =>
  new Uint8Array([0xff, 0xd8, ...segments.flat(), ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]), 0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9]);
const jfif = seg(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);

const chunk = (type: string, data: number[]) => [...u32be(data.length), ...ascii(type), ...data, 0, 0, 0, 0];
const png = (...chunks: number[][]) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', [...u32be(64), ...u32be(32), 8, 2, 0, 0, 0]), ...chunks.flat(),
    ...chunk('IDAT', [1, 2, 3, 4]), ...chunk('IEND', [])]);

// TIFF little-endian: IFD0 com largura, altura, ImageDescription e uma sub-IFD (EXIF ou GPS).
function tiff(subTag: number) {
  const description = [...ascii('Paciente Jose'), 0];
  const ifd0 = 8;
  const descOffset = ifd0 + 2 + 4 * 12 + 4;
  const subIfd = descOffset + description.length;
  const commentOffset = subIfd + 2 + 12 + 4;
  const comment = ascii('texto secreto');
  const entry = (tag: number, type: number, count: number, value: number[]) =>
    [...u16le(tag), ...u16le(type), ...u32le(count), ...value];
  return new Uint8Array([
    0x49, 0x49, 42, 0, ...u32le(ifd0),
    ...u16le(4),
    ...entry(256, 3, 1, [...u16le(640), 0, 0]),
    ...entry(257, 3, 1, [...u16le(480), 0, 0]),
    ...entry(270, 2, description.length, u32le(descOffset)),
    ...entry(subTag, 4, 1, u32le(subIfd)),
    ...u32le(0),
    ...description,
    ...u16le(1),
    ...entry(37510, 7, comment.length, u32le(commentOffset)),
    ...u32le(0),
    ...comment,
  ]);
}

const sujas: Record<string, Uint8Array> = {
  'jpeg-exif': jpeg(jfif, seg(0xe1, [...ascii('Exif'), 0, 0, ...ascii('Paciente Joao da Silva')]),
    seg(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1, 9, 9, 9]), seg(0xfe, ascii('Prontuario 12345')), sof(200, 300)),
  'jpeg-xmp': jpeg(jfif, seg(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/'), 0, ...ascii('<x:xmpmeta>Joao</x:xmpmeta>')]), sof(120, 80)),
  'jpeg-iptc-app5': jpeg(jfif, seg(0xed, ascii('Photoshop 3.0 IPTC')), seg(0xe5, ascii('fabricante')), sof(10, 10)),
  'png-texto': png(chunk('tEXt', [...ascii('Author'), 0, ...ascii('Dra. Maria')]), chunk('tIME', [7, 234, 11, 13, 10, 0, 0])),
  'png-ztxt-exif': png(chunk('zTXt', [...ascii('Comment'), 0, 0, 1, 2, 3]), chunk('eXIf', [0x4d, 0x4d, 0, 42])),
  'tiff-exif': tiff(34665),
  'tiff-gps': tiff(34853),
};

const extensao = (mime: string) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/tiff': 'tif' })[mime]!;
const esperado: Record<string, { mime: string; width: number; height: number; metadados: string[] }> = {};
const dir = new URL('.', import.meta.url);

for (const [nome, bytes] of Object.entries(sujas)) {
  const suja = inspectImage(bytes);
  const limpa = sanitizeImage(bytes);
  if (!limpa.fullySanitized) throw new Error(`${nome}: a higienização do app não removeu tudo`);
  const ext = extensao(suja.mimeType);
  await Deno.writeFile(new URL(`${nome}-sujo.${ext}`, dir), bytes);
  await Deno.writeFile(new URL(`${nome}-limpo.${ext}`, dir), limpa.bytes);
  const base = { mime: suja.mimeType, width: suja.width, height: suja.height };
  esperado[`${nome}-sujo.${ext}`] = { ...base, metadados: suja.findings.map((f) => f.kind) };
  esperado[`${nome}-limpo.${ext}`] = { ...base, metadados: [] };
}

await Deno.writeTextFile(new URL('esperado.json', dir), JSON.stringify(esperado, null, 2) + '\n');
console.log(`${Object.keys(esperado).length} arquivos gerados.`);
