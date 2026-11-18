/// <reference types="node" />
// R-12 parte 2: o app envia para a quarentena e quem registra a imagem é o servidor
// (r2-confirm-upload), depois de conferir o arquivo. O app não chama mais register_image.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { uploadImagesToBatch } from '../cloudflare';

const mockInvoke = jest.fn();
const mockRpc = jest.fn();
const mockRead = jest.fn();

jest.mock('@/services/supabase', () => ({
  invokeFunction: (...a: unknown[]) => mockInvoke(...a),
  rpc: (...a: unknown[]) => mockRpc(...a),
  ApiError: class ApiError extends Error {},
}));
jest.mock('@/services/files', () => ({ readAssetBytes: (...a: unknown[]) => mockRead(...a) }));
jest.mock('@/services/device', () => ({ deviceLabel: () => 'Chrome' }));
jest.mock('@/config/env', () => ({ env: { uploadMaxMb: 50 } }));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: async (_alg: string, bytes: Uint8Array) => {
    const h = jest.requireActual<typeof import('node:crypto')>('node:crypto').createHash('sha256').update(bytes).digest();
    return h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength);
  },
}));

const FIXTURES = join(__dirname, '../../../../../tests/fixtures/imagens');
const SUJO = new Uint8Array(readFileSync(join(FIXTURES, 'jpeg-exif-sujo.jpg')));
const LIMPO = new Uint8Array(readFileSync(join(FIXTURES, 'jpeg-exif-limpo.jpg')));
const SHA_LIMPO = createHash('sha256').update(LIMPO).digest('hex');
const CHAVE = `quarantine/proj-1/lote-1/${SHA_LIMPO}.jpg`;
const ASSET = { name: 'lamina.jpg', size: SUJO.byteLength, uri: 'file://lamina.jpg' } as never;

const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch as never;
  mockRead.mockResolvedValue(SUJO);
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
});

function responder(confirmacao: unknown) {
  mockInvoke.mockImplementation(async (name: string) => {
    if (name === 'r2-upload-url') return { duplicate: false, upload_url: 'https://r2/put', storage_key: CHAVE, headers: { 'x-amz-checksum-sha256': 'abc' } };
    if (name === 'r2-confirm-upload') return confirmacao;
    throw new Error(`função inesperada: ${name}`);
  });
}

it('pede URL de quarentena, envia o arquivo já higienizado e confirma no servidor', async () => {
  responder({ ok: true, status: 'uploaded', image_id: 'img-1', image_version_id: 'ver-1', code: 'LT01-0001' });
  const onRegistered = jest.fn();
  const report = await uploadImagesToBatch([ASSET], { batchId: 'lote-1', organ: 'mama', opticalMagnification: '40x', onRegistered });

  expect(mockInvoke).toHaveBeenNthCalledWith(1, 'r2-upload-url', {
    batch_id: 'lote-1', sha256: SHA_LIMPO, mime_type: 'image/jpeg', size_bytes: LIMPO.byteLength, quarantine: true,
  });
  expect(Buffer.from(mockFetch.mock.calls[0][1].body)).toEqual(Buffer.from(LIMPO));
  expect(mockInvoke).toHaveBeenNthCalledWith(2, 'r2-confirm-upload', {
    batch_id: 'lote-1', storage_key: CHAVE, organ: 'mama', optical_magnification: '40x', device: 'Chrome',
  });
  expect(onRegistered).toHaveBeenCalledWith('ver-1', expect.any(Uint8Array), 'image/jpeg');
  expect(report).toMatchObject({ uploaded: 1, uploadedCodes: ['LT01-0001'], sanitized: 1 });
});

it('não chama mais o register_image (o app não registra a imagem sozinho)', async () => {
  responder({ ok: true, status: 'uploaded', image_id: 'img-1', image_version_id: 'ver-1', code: 'LT01-0001' });
  await uploadImagesToBatch([ASSET], { batchId: 'lote-1' });
  expect(mockRpc).not.toHaveBeenCalled();
});

it('recusa do servidor aparece no resumo com o motivo e sem pré-anotação', async () => {
  responder({ ok: false, status: 'rejected', reason: 'O arquivo ainda tem metadados de texto (EXIF).' });
  const onRegistered = jest.fn();
  const report = await uploadImagesToBatch([ASSET], { batchId: 'lote-1', onRegistered });
  expect(report.rejected).toEqual([{ filename: 'lamina.jpg', reason: 'O arquivo ainda tem metadados de texto (EXIF).' }]);
  expect(onRegistered).not.toHaveBeenCalled();
});

it('duplicata detectada pelo servidor aparece como duplicata', async () => {
  responder({ ok: false, status: 'duplicate', existing_code: 'LT01-0003' });
  const report = await uploadImagesToBatch([ASSET], { batchId: 'lote-1' });
  expect(report.duplicateFiles).toEqual([{ filename: 'lamina.jpg', existingCode: 'LT01-0003' }]);
});

it('PUT recusado pelo armazenamento: não pede a confirmação', async () => {
  responder({ ok: true });
  mockFetch.mockResolvedValue({ ok: false, status: 403 });
  const report = await uploadImagesToBatch([ASSET], { batchId: 'lote-1' });
  expect(report.rejected[0].reason).toContain('403');
  expect(mockInvoke).toHaveBeenCalledTimes(1);
});
