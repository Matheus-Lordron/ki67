// R-12: inspeção de imagens no SERVIDOR. Só lê, nunca altera o arquivo.
//
// É a parte de leitura de apps/mobile/src/utils/imageMetadata.ts (o app também
// higieniza; o servidor só confere). As duas cópias leem as mesmas imagens de exemplo
// em tests/fixtures/imagens: se uma mudar e a outra não, os testes acusam.
// Ao mudar uma regra aqui, mude lá também (e regere as imagens com o gerar.ts).
//
// Devolve o formato (pelos bytes, não pela extensão), largura, altura e os metadados de
// texto encontrados (EXIF, XMP, IPTC, comentários, textos de PNG, tags de texto de TIFF).

export type SupportedMime = 'image/jpeg' | 'image/png' | 'image/tiff';

export interface Inspection {
  mime: SupportedMime;
  width: number;
  height: number;
  /** Tipos de metadado de texto encontrados, ex.: "EXIF", "PNG tEXt: Author". Vazio = limpo. */
  metadados: string[];
}

export class ImageFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageFormatError';
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function detectImageType(b: Uint8Array): SupportedMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && PNG_SIGNATURE.every((v, i) => b[i] === v)) return 'image/png';
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 42 && b[3] === 0) ||
                        (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 42))) return 'image/tiff';
  return null;
}

export function inspectImage(bytes: Uint8Array): Inspection {
  const mime = detectImageType(bytes);
  if (!mime) throw new ImageFormatError('Formato não reconhecido: envie JPG, PNG ou TIFF.');
  let info: { width: number; height: number; metadados: string[] };
  try {
    info = mime === 'image/jpeg' ? jpeg(bytes) : mime === 'image/png' ? png(bytes) : tiff(bytes);
  } catch (e) {
    if (e instanceof ImageFormatError) throw e;
    throw new ImageFormatError('Arquivo de imagem corrompido.'); // leitura fora do arquivo (RangeError)
  }
  if (!info.width || !info.height) throw new ImageFormatError('Não foi possível ler as dimensões da imagem.');
  return { mime, ...info };
}

const startsWith = (b: Uint8Array, offset: number, ascii: string) =>
  offset + ascii.length <= b.length && [...ascii].every((c, i) => b[offset + i] === c.charCodeAt(0));
const latin1 = (b: Uint8Array, max = 79) => String.fromCharCode(...b.subarray(0, max));

// --- JPEG: segmentos até o início do scan (SOS) ----------------------------------

function jpeg(b: Uint8Array) {
  const metadados: string[] = [];
  let width = 0;
  let height = 0;
  let pos = 2;
  while (pos < b.length) {
    if (b[pos] !== 0xff) throw new ImageFormatError('JPEG corrompido.');
    const marker = b[pos + 1];
    if (marker === 0xff) { pos += 1; continue; }
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { pos += 2; continue; }
    if (pos + 4 > b.length) throw new ImageFormatError('JPEG truncado.');
    const len = (b[pos + 2] << 8) | b[pos + 3];
    const end = pos + 2 + len;
    if (len < 2 || end > b.length) throw new ImageFormatError('JPEG corrompido.');
    if (marker === 0xda) break;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      height = (b[pos + 5] << 8) | b[pos + 6];
      width = (b[pos + 7] << 8) | b[pos + 8];
    }
    const kind = jpegKind(marker, b.subarray(pos + 4, end));
    if (kind) metadados.push(kind);
    pos = end;
  }
  return { width, height, metadados };
}

function jpegKind(marker: number, payload: Uint8Array): string | null {
  if (marker === 0xe0 || marker === 0xee) return null; // JFIF / Adobe
  if (marker === 0xe2 && startsWith(payload, 0, 'ICC_PROFILE')) return null;
  if (marker === 0xe1) {
    if (startsWith(payload, 0, 'Exif')) return 'EXIF';
    if (startsWith(payload, 0, 'http://ns.adobe.com/xap/1.0/')) return 'XMP';
    return 'APP1';
  }
  if (marker === 0xed) return 'IPTC/Photoshop';
  if (marker === 0xfe) return 'Comentário JPEG';
  if (marker >= 0xe0 && marker <= 0xef) return `APP${marker - 0xe0}`;
  return null;
}

// --- PNG: chunks até o IEND ------------------------------------------------------

const PNG_TEXT_CHUNKS = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function png(b: Uint8Array) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const metadados: string[] = [];
  let width = 0;
  let height = 0;
  let pos = 8;
  while (pos + 12 <= b.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7]);
    const end = pos + 12 + len;
    if (end > b.length) throw new ImageFormatError('PNG corrompido.');
    if (type === 'IHDR') {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
    }
    if (PNG_TEXT_CHUNKS.has(type)) {
      const data = b.subarray(pos + 8, pos + 8 + len);
      const nul = data.indexOf(0);
      const keyword = type === 'eXIf' || type === 'tIME' ? '' : latin1(data.subarray(0, nul < 0 ? Math.min(data.length, 79) : nul));
      metadados.push(`PNG ${type}${keyword ? `: ${keyword}` : ''}`);
    }
    pos = end;
    if (type === 'IEND') break;
  }
  return { width, height, metadados };
}

// --- TIFF: IFDs encadeadas e sub-IFDs EXIF/GPS --------------------------------------

const TIFF_TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4 };
const TIFF_TEXT_TAGS: Record<number, string> = {
  269: 'DocumentName', 270: 'ImageDescription', 271: 'Make', 272: 'Model', 285: 'PageName',
  305: 'Software', 306: 'DateTime', 315: 'Artist', 316: 'HostComputer', 33432: 'Copyright',
};
const TIFF_BLOB_TAGS: Record<number, string> = { 700: 'XMP', 33723: 'IPTC', 34377: 'Photoshop' };
const TIFF_SUB_IFDS: Record<number, string> = { 34665: 'EXIF', 34853: 'GPS', 40965: 'Interoperabilidade' };

function tiff(b: Uint8Array) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const le = b[0] === 0x49;
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);
  const inBounds = (offset: number, size: number) => offset >= 0 && size >= 0 && offset + size <= b.length;
  const isBlank = (offset: number, size: number) => b.subarray(offset, offset + size).every((v) => v === 0);
  const metadados: string[] = [];
  const visited = new Set<number>();
  let width = 0;
  let height = 0;

  if (b[2] === 43 || b[3] === 43) throw new ImageFormatError('BigTIFF não é suportado.');
  let ifd = u32(4);
  let first = true;
  while (ifd && inBounds(ifd, 2) && !visited.has(ifd)) {
    visited.add(ifd);
    const n = u16(ifd);
    if (!inBounds(ifd, 2 + n * 12 + 4)) throw new ImageFormatError('TIFF corrompido.');
    for (let i = 0; i < n; i++) {
      const entry = ifd + 2 + i * 12;
      const tag = u16(entry);
      const type = u16(entry + 2);
      const size = (TIFF_TYPE_SIZE[type] ?? 1) * u32(entry + 4);
      const dataOffset = size <= 4 ? entry + 8 : u32(entry + 8);
      if (first && (tag === 256 || tag === 257)) {
        const value = type === 3 ? u16(entry + 8) : u32(entry + 8);
        if (tag === 256) width = value; else height = value;
      }
      if (!inBounds(dataOffset, size) || size === 0) continue;
      const name = TIFF_TEXT_TAGS[tag] ?? TIFF_BLOB_TAGS[tag];
      if (name && !isBlank(dataOffset, size)) metadados.push(`TIFF ${name}`);
      const subName = TIFF_SUB_IFDS[tag];
      if (subName) {
        const sub = u32(entry + 8);
        if (inBounds(sub, 2) && u16(sub) > 0) metadados.push(`TIFF ${subName}`);
      }
    }
    first = false;
    ifd = u32(ifd + 2 + n * 12);
  }
  return { width, height, metadados };
}
