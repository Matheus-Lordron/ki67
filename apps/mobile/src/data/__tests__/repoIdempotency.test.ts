/**
 * Idempotência na criação de projeto e lote: o formulário gera uma chave
 * (request_id) ao abrir e a reenvia em toda tentativa. O banco tem a coluna
 * unique e, quando a chave se repete, não insere de novo (ON CONFLICT DO NOTHING).
 */
import { createBatch, createProject } from '../repo';

const mockUpsert = jest.fn();
const mockInsert = jest.fn();
const mockEq = jest.fn();

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: mockUpsert,
      insert: mockInsert,
      select: jest.fn(() => ({ eq: mockEq })),
    })),
  },
  rpc: jest.fn(),
  ApiError: class ApiError extends Error {},
}));
jest.mock('@/services/cloudflare', () => ({ getSignedImageUrls: jest.fn() }));
jest.mock('@/services/device', () => ({ deviceLabel: () => 'teste' }));

const REQUEST_ID = '3f2c9a8e-1b4d-4c6e-9f0a-2b7d5e8c1a43';

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue({ error: null });
  mockInsert.mockResolvedValue({ error: null });
  mockEq.mockResolvedValue({ data: [], error: null });
});

describe('createProject', () => {
  it('envia a chave do formulário e não duplica quando ela se repete', async () => {
    await createProject('Estudo Ki67', 'desc', 'gestor-1', REQUEST_ID);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: REQUEST_ID, name: 'Estudo Ki67', manager_id: 'gestor-1' }),
      { onConflict: 'request_id', ignoreDuplicates: true },
    );
  });

  it('dois envios com a mesma chave mandam a mesma chave', async () => {
    await createProject('Estudo Ki67', '', 'gestor-1', REQUEST_ID);
    await createProject('Estudo Ki67', '', 'gestor-1', REQUEST_ID);

    const keys = mockUpsert.mock.calls.map(([row]) => row.request_id);
    expect(keys).toEqual([REQUEST_ID, REQUEST_ID]);
  });
});

describe('createBatch', () => {
  it('envia a chave do formulário e não duplica quando ela se repete', async () => {
    await createBatch('proj-1', 'Lote A', 3, '', REQUEST_ID);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: REQUEST_ID, project_id: 'proj-1', code: 'LT01' }),
      { onConflict: 'request_id', ignoreDuplicates: true },
    );
  });

  it('com o código já usado por outro lote, tenta o próximo mantendo a mesma chave', async () => {
    mockUpsert
      .mockResolvedValueOnce({ error: { code: '23505', message: 'batches_project_id_code_key' } })
      .mockResolvedValueOnce({ error: null });

    await createBatch('proj-1', 'Lote A', 3, '', REQUEST_ID);

    expect(mockUpsert.mock.calls.map(([row]) => [row.code, row.request_id])).toEqual([
      ['LT01', REQUEST_ID],
      ['LT02', REQUEST_ID],
    ]);
  });
});
