/**
 * Inspeção e higienização de metadados de imagens (RNV-07 / LGPD).
 *
 * Roda no aparelho, ANTES do upload, em JavaScript puro (web, Android e iOS):
 * - descobre o formato pelos bytes (não confia na extensão nem no MIME do sistema);
 * - lê largura e altura;
 * - lista metadados de texto que podem identificar o paciente (EXIF, XMP, IPTC,
 *   comentários, textos de PNG, tags de texto de TIFF);
 * - remove esses metadados SEM recodificar a imagem: os pixels ficam idênticos.
 *
 * JPEG: remove os segmentos APP1 (EXIF/XMP), APP13 (IPTC), COM e APPn
 *       desconhecidos. Mantém JFIF (APP0), perfil de cor ICC (APP2) e Adobe (APP14).
 * PNG:  remove os chunks tEXt, zTXt, iTXt, eXIf e tIME.
 * TIFF: zera, no lugar, o conteúdo das tags de texto, XMP, IPTC e das sub-IFDs
 *       EXIF e GPS. O arquivo mantém o mesmo tamanho e a mesma estrutura.
 */

export type SupportedMime = 'image/jpeg' | 'image/png' | 'image/tiff';

export interface MetadataFinding {
  /** Tipo do metadado, ex.: "EXIF", "XMP", "TIFF ImageDescription". */
  kind: string;
  /** Trecho do conteúdo (até 60 caracteres), só para o aviso na tela. */
  preview?: string;
}

export interface ImageInspection {
  mimeType: SupportedMime;
  width: number;
  height: number;
  findings: MetadataFinding[];
}

export interface SanitizedImage extends ImageInspection {
  /** Bytes prontos para envio (cópia higienizada). */
  bytes: Uint8Array<ArrayBuffer>;
  /** Metadados encontrados no arquivo original (o que foi removido). */
  removed: MetadataFinding[];
  /** true quando a releitura do arquivo higienizado não encontra mais nada. */
  fullySanitized: boolean;
}

export class ImageFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageFormatError';
  }
}

export function detectImageType(b: Uint8Array): SupportedMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && PNG_SIGNATURE.every((v, i) => b[i] === v)) return 'image/png';
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 42 && b[3] === 0) ||
                        (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 42))) return 'image/tiff';
  return null;
}

export function inspectImage(bytes: Uint8Array): ImageInspection {
  const mimeType = requireType(bytes);
  const { width, height, findings } = process(mimeType, bytes, false).info;
  return { mimeType, width, height, findings };
}

export function sanitizeImage(bytes: Uint8Array): SanitizedImage {
  const mimeType = requireType(bytes);
  const result = process(mimeType, bytes, true);
  const after = process(mimeType, result.bytes, false).info;
  return {
    mimeType,
    width: result.info.width,
    height: result.info.height,
    findings: after.findings,
    removed: result.info.findings,
    bytes: result.bytes as Uint8Array<ArrayBuffer>, // com strip = true é sempre uma cópia nova
    fullySanitized: after.findings.length === 0,
  };
}

// ---------------------------------------------------------------------------

interface ProcessResult {
  bytes: Uint8Array;
  info: { width: number; height: number; findings: MetadataFinding[] };
}

function requireType(bytes: Uint8Array): SupportedMime {
  const type = detectImageType(bytes);
  if (!type) throw new ImageFormatError('Formato não reconhecido: envie JPG, PNG ou TIFF.');
  return type;
}

function process(mime: SupportedMime, bytes: Uint8Array, strip: boolean): ProcessResult {
  const result = mime === 'image/jpeg' ? processJpeg(bytes, strip)
               : mime === 'image/png'  ? processPng(bytes, strip)
               : processTiff(bytes, strip);
  if (!result.info.width || !result.info.height) {
    throw new ImageFormatError('Não foi possível ler as dimensões da imagem.');
  }
  return result;
}

// Latin-1 manual: o TextDecoder do Hermes (Android/iOS) só garante UTF-8.
function latin1(b: Uint8Array, max = 200): string {
  return String.fromCharCode(...b.subarray(0, max));
}

function preview(b: Uint8Array): string | undefined {
  const text = latin1(b).replace(/[\x00-\x1f\x7f-\x9f]+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

function startsWith(b: Uint8Array, offset: number, ascii: string): boolean {
  if (offset + ascii.length > b.length) return false;
  for (let i = 0; i < ascii.length; i++) if (b[offset + i] !== ascii.charCodeAt(i)) return false;
  return true;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// --- JPEG ---------------------------------------------------------------------

function processJpeg(b: Uint8Array, strip: boolean): ProcessResult {
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  const findings: MetadataFinding[] = [];
  let width = 0;
  let height = 0;
  let pos = 2;

  while (pos < b.length) {
    if (b[pos] !== 0xff) throw new ImageFormatError('JPEG corrompido.');
    const marker = b[pos + 1];
    if (marker === 0xff) { // byte de preenchimento
      pos += 1;
      continue;
    }
    if (marker === 0xd9) { // EOI
      parts.push(b.subarray(pos));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { // marcadores sem tamanho
      parts.push(b.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }
    if (pos + 4 > b.length) throw new ImageFormatError('JPEG truncado.');
    const len = (b[pos + 2] << 8) | b[pos + 3];
    const end = pos + 2 + len;
    if (len < 2 || end > b.length) throw new ImageFormatError('JPEG corrompido.');

    if (marker === 0xda) { // SOS: o resto é dado de imagem
      parts.push(b.subarray(pos));
      break;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      height = (b[pos + 5] << 8) | b[pos + 6];
      width = (b[pos + 7] << 8) | b[pos + 8];
    }

    const payload = b.subarray(pos + 4, end);
    const finding = jpegFinding(marker, payload);
    if (finding) findings.push(finding);
    if (!(finding && strip)) parts.push(b.subarray(pos, end));
    pos = end;
  }

  return { bytes: strip ? concat(parts) : b, info: { width, height, findings } };
}

function jpegFinding(marker: number, payload: Uint8Array): MetadataFinding | null {
  if (marker === 0xe0 || marker === 0xee) return null; // JFIF / Adobe
  if (marker === 0xe2 && startsWith(payload, 0, 'ICC_PROFILE')) return null;
  if (marker === 0xe1) {
    if (startsWith(payload, 0, 'Exif')) return { kind: 'EXIF' };
    if (startsWith(payload, 0, 'http://ns.adobe.com/xap/1.0/')) return { kind: 'XMP', preview: preview(payload.subarray(29)) };
    return { kind: 'APP1' };
  }
  if (marker === 0xed) return { kind: 'IPTC/Photoshop' };
  if (marker === 0xfe) return { kind: 'Comentário JPEG', preview: preview(payload) };
  if (marker >= 0xe0 && marker <= 0xef) return { kind: `APP${marker - 0xe0}` };
  return null;
}

// --- PNG ----------------------------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_TEXT_CHUNKS = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function processPng(b: Uint8Array, strip: boolean): ProcessResult {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  const findings: MetadataFinding[] = [];
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
    let removed = false;
    if (PNG_TEXT_CHUNKS.has(type)) {
      const data = b.subarray(pos + 8, pos + 8 + len);
      const nul = data.indexOf(0);
      const keyword = type === 'eXIf' || type === 'tIME' ? '' : latin1(data.subarray(0, nul < 0 ? Math.min(data.length, 79) : nul));
      findings.push({
        kind: `PNG ${type}${keyword ? `: ${keyword}` : ''}`,
        preview: type === 'tEXt' && nul >= 0 ? preview(data.subarray(nul + 1)) : undefined,
      });
      removed = strip;
    }
    if (!removed) parts.push(b.subarray(pos, end));
    pos = end;
    if (type === 'IEND') break;
  }

  return { bytes: strip ? concat(parts) : b, info: { width, height, findings } };
}

// --- TIFF ---------------------------------------------------------------------

const TIFF_TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4 };
const TIFF_TEXT_TAGS: Record<number, string> = {
  269: 'DocumentName', 270: 'ImageDescription', 271: 'Make', 272: 'Model', 285: 'PageName',
  305: 'Software', 306: 'DateTime', 315: 'Artist', 316: 'HostComputer', 33432: 'Copyright',
};
const TIFF_BLOB_TAGS: Record<number, string> = { 700: 'XMP', 33723: 'IPTC', 34377: 'Photoshop' };
const TIFF_SUB_IFDS: Record<number, string> = { 34665: 'EXIF', 34853: 'GPS', 40965: 'Interoperabilidade' };

function processTiff(original: Uint8Array, strip: boolean): ProcessResult {
  const b = strip ? original.slice() : original;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const le = b[0] === 0x49;
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);
  const findings: MetadataFinding[] = [];
  const visited = new Set<number>();
  let width = 0;
  let height = 0;

  const inBounds = (offset: number, size: number) => offset >= 0 && size >= 0 && offset + size <= b.length;
  const isBlank = (offset: number, size: number) => b.subarray(offset, offset + size).every((v) => v === 0);

  // Lê uma entrada de IFD: onde estão os dados e quantos bytes ocupam.
  const entryAt = (entry: number) => {
    const tag = u16(entry);
    const type = u16(entry + 2);
    const count = u32(entry + 4);
    const size = (TIFF_TYPE_SIZE[type] ?? 1) * count;
    const dataOffset = size <= 4 ? entry + 8 : u32(entry + 8);
    return { tag, type, size, dataOffset };
  };

  // Zera uma sub-IFD inteira (EXIF/GPS): primeiro os dados apontados, depois a tabela.
  const wipeIfd = (offset: number) => {
    if (!inBounds(offset, 2) || visited.has(offset)) return;
    visited.add(offset);
    const n = u16(offset);
    const tableSize = 2 + n * 12 + 4;
    if (!inBounds(offset, tableSize)) return;
    for (let i = 0; i < n; i++) {
      const e = entryAt(offset + 2 + i * 12);
      if (TIFF_SUB_IFDS[e.tag] && e.size === 4) wipeIfd(u32(offset + 2 + i * 12 + 8));
      if (e.size > 4 && inBounds(e.dataOffset, e.size)) b.fill(0, e.dataOffset, e.dataOffset + e.size);
    }
    b.fill(0, offset, offset + tableSize);
  };

  if (b[2] === 43 || b[3] === 43) throw new ImageFormatError('BigTIFF não é suportado.');
  let ifd = u32(4);
  let first = true;

  while (ifd && inBounds(ifd, 2) && !visited.has(ifd)) {
    visited.add(ifd);
    const n = u16(ifd);
    if (!inBounds(ifd, 2 + n * 12 + 4)) throw new ImageFormatError('TIFF corrompido.');

    for (let i = 0; i < n; i++) {
      const entry = ifd + 2 + i * 12;
      const e = entryAt(entry);
      if (first && (e.tag === 256 || e.tag === 257)) {
        const value = e.type === 3 ? u16(entry + 8) : u32(entry + 8);
        if (e.tag === 256) width = value; else height = value;
      }
      if (!inBounds(e.dataOffset, e.size) || e.size === 0) continue;

      const textName = TIFF_TEXT_TAGS[e.tag];
      const blobName = TIFF_BLOB_TAGS[e.tag];
      if ((textName || blobName) && !isBlank(e.dataOffset, e.size)) {
        findings.push({
          kind: `TIFF ${textName ?? blobName}`,
          preview: textName ? preview(b.subarray(e.dataOffset, e.dataOffset + e.size)) : undefined,
        });
        if (strip) b.fill(0, e.dataOffset, e.dataOffset + e.size);
      }

      const subName = TIFF_SUB_IFDS[e.tag];
      if (subName) {
        const sub = u32(entry + 8);
        if (inBounds(sub, 2) && u16(sub) > 0) {
          findings.push({ kind: `TIFF ${subName}` });
          if (strip) wipeIfd(sub);
        }
      }
    }
    first = false;
    ifd = u32(ifd + 2 + n * 12);
  }

  return { bytes: b, info: { width, height, findings } };
}
