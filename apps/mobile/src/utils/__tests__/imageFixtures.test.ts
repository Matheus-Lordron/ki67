/// <reference types="node" />
// O Jest roda em Node; o @types/node vem com o próprio Jest (@jest/types).
// R-12: o inspetor do app e o do servidor (supabase/functions/_shared/imageInspect.ts)
// leem as MESMAS imagens de exemplo, em tests/fixtures/imagens. Este lado confere que o
// app acha os metadados esperados e que a higienização dele gera exatamente o arquivo
// "-limpo", que o servidor precisa aceitar.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inspectImage, sanitizeImage } from '@/utils/imageMetadata';

const DIR = join(__dirname, '../../../../../tests/fixtures/imagens');
const esperado: Record<string, { mime: string; width: number; height: number; metadados: string[] }> =
  JSON.parse(readFileSync(join(DIR, 'esperado.json'), 'utf8'));
const ler = (nome: string) => new Uint8Array(readFileSync(join(DIR, nome)));

describe('imagens de exemplo compartilhadas com o servidor (R-12)', () => {
  it('toda imagem da pasta está em esperado.json', () => {
    const arquivos = readdirSync(DIR).filter((n) => /\.(jpg|png|tif)$/.test(n)).sort();
    expect(arquivos).toEqual(Object.keys(esperado).sort());
    expect(arquivos.length).toBeGreaterThanOrEqual(14);
  });

  it.each(Object.entries(esperado))('%s: formato, dimensões e metadados', (nome, e) => {
    const r = inspectImage(ler(nome));
    expect({ mime: r.mimeType, width: r.width, height: r.height, metadados: r.findings.map((f) => f.kind) }).toEqual(e);
  });

  it.each(Object.keys(esperado).filter((n) => n.includes('-sujo.')))('%s: a higienização gera o "-limpo"', (nome) => {
    const limpa = sanitizeImage(ler(nome));
    expect(limpa.fullySanitized).toBe(true);
    expect(Array.from(limpa.bytes)).toEqual(Array.from(ler(nome.replace('-sujo.', '-limpo.'))));
  });
});
