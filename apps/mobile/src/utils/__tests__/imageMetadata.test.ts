import { detectImageType, ImageFormatError, inspectImage, sanitizeImage } from '@/utils/imageMetadata';

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const u16be = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const u16le = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u32le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const includes = (hay: Uint8Array, needle: string) => String.fromCharCode(...hay).includes(needle);

function jpegSegment(marker: number, payload: number[]) {
  return [0xff, marker, ...u16be(payload.length + 2), ...payload];
}

function buildJpeg() {
  const scan = [0x12, 0x34, 0xff, 0x00, 0x56];
  return new Uint8Array([
    0xff, 0xd8,
    ...jpegSegment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...jpegSegment(0xe1, [...ascii('Exif'), 0, 0, ...ascii('Paciente Joao da Silva')]),
    ...jpegSegment(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1, 9, 9, 9]),
    ...jpegSegment(0xfe, ascii('Prontuario 12345')),
    ...jpegSegment(0xc0, [8, ...u16be(200), ...u16be(300), 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]),
    ...jpegSegment(0xda, [1, 1, 0, 0, 0x3f, 0]),
    ...scan,
    0xff, 0xd9,
  ]);
}

function pngChunk(type: string, data: number[]) {
  return [...u32be(data.length), ...ascii(type), ...data, 0, 0, 0, 0];
}

function buildPng() {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...pngChunk('IHDR', [...u32be(64), ...u32be(32), 8, 2, 0, 0, 0]),
    ...pngChunk('tEXt', [...ascii('Author'), 0, ...ascii('Dra. Maria')]),
    ...pngChunk('IDAT', [1, 2, 3, 4]),
    ...pngChunk('IEND', []),
  ]);
}

// TIFF little-endian: IFD0 com largura, altura, ImageDescription e ponteiro EXIF.
function buildTiff() {
  const description = [...ascii('Paciente Jose'), 0]; // 14 bytes, fora da entrada
  const ifd0 = 8;
  const ifd0Size = 2 + 4 * 12 + 4;
  const descOffset = ifd0 + ifd0Size;
  const exifIfd = descOffset + description.length;
  const exifIfdSize = 2 + 12 + 4;
  const commentOffset = exifIfd + exifIfdSize;
  const comment = ascii('texto secreto');
  const entry = (tag: number, type: number, count: number, value: number[]) =>
    [...u16le(tag), ...u16le(type), ...u32le(count), ...value];
  return new Uint8Array([
    0x49, 0x49, 42, 0, ...u32le(ifd0),
    ...u16le(4),
    ...entry(256, 3, 1, [...u16le(640), 0, 0]),
    ...entry(257, 3, 1, [...u16le(480), 0, 0]),
    ...entry(270, 2, description.length, u32le(descOffset)),
    ...entry(34665, 4, 1, u32le(exifIfd)),
    ...u32le(0),
    ...description,
    ...u16le(1),
    ...entry(37510, 7, comment.length, u32le(commentOffset)),
    ...u32le(0),
    ...comment,
  ]);
}

describe('detectImageType', () => {
  it('reconhece o formato pelos bytes', () => {
    expect(detectImageType(buildJpeg())).toBe('image/jpeg');
    expect(detectImageType(buildPng())).toBe('image/png');
    expect(detectImageType(buildTiff())).toBe('image/tiff');
    expect(detectImageType(new Uint8Array(ascii('GIF89a')))).toBeNull();
  });

  it('recusa formato desconhecido', () => {
    expect(() => inspectImage(new Uint8Array(ascii('GIF89a......')))).toThrow(ImageFormatError);
  });
});

describe('JPEG', () => {
  it('lista EXIF e comentário e lê as dimensões', () => {
    const info = inspectImage(buildJpeg());
    expect(info).toMatchObject({ mimeType: 'image/jpeg', width: 300, height: 200 });
    expect(info.findings.map((f) => f.kind)).toEqual(['EXIF', 'Comentário JPEG']);
    expect(info.findings[1].preview).toBe('Prontuario 12345');
  });

  it('remove os metadados e mantém ICC, JFIF e os dados da imagem', () => {
    const original = buildJpeg();
    const clean = sanitizeImage(original);
    expect(clean.fullySanitized).toBe(true);
    expect(clean.removed).toHaveLength(2);
    expect(includes(clean.bytes, 'Paciente')).toBe(false);
    expect(includes(clean.bytes, 'Prontuario')).toBe(false);
    expect(includes(clean.bytes, 'ICC_PROFILE')).toBe(true);
    expect(includes(clean.bytes, 'JFIF')).toBe(true);
    expect(Array.from(clean.bytes.slice(-7))).toEqual(Array.from(original.slice(-7))); // scan + EOI intactos
    expect(inspectImage(clean.bytes)).toMatchObject({ width: 300, height: 200, findings: [] });
  });
});

describe('PNG', () => {
  it('remove chunks de texto e preserva o resto', () => {
    const info = inspectImage(buildPng());
    expect(info).toMatchObject({ mimeType: 'image/png', width: 64, height: 32 });
    expect(info.findings[0]).toEqual({ kind: 'PNG tEXt: Author', preview: 'Dra. Maria' });

    const clean = sanitizeImage(buildPng());
    expect(clean.fullySanitized).toBe(true);
    expect(includes(clean.bytes, 'Dra. Maria')).toBe(false);
    expect(includes(clean.bytes, 'IDAT')).toBe(true);
    expect(includes(clean.bytes, 'IEND')).toBe(true);
  });
});

describe('TIFF', () => {
  it('zera textos e a sub-IFD EXIF sem mudar o tamanho do arquivo', () => {
    const original = buildTiff();
    const info = inspectImage(original);
    expect(info).toMatchObject({ mimeType: 'image/tiff', width: 640, height: 480 });
    expect(info.findings.map((f) => f.kind)).toEqual(['TIFF ImageDescription', 'TIFF EXIF']);

    const clean = sanitizeImage(original);
    expect(clean.bytes.byteLength).toBe(original.byteLength);
    expect(clean.fullySanitized).toBe(true);
    expect(includes(clean.bytes, 'Paciente')).toBe(false);
    expect(includes(clean.bytes, 'secreto')).toBe(false);
    expect(includes(original, 'Paciente')).toBe(true); // o original não é alterado
    expect(inspectImage(clean.bytes)).toMatchObject({ width: 640, height: 480, findings: [] });
  });
});
