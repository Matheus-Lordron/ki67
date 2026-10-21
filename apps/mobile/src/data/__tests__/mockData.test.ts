import { INITIAL_IMAGES, INITIAL_PROJECTS } from '@/data/mockData';

// No Jest não existe o registro de assets do Metro; basta saber que a imagem é local.
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ uri: 'asset://demo.jpg' }) } }));

describe('dados de demonstração', () => {
  it('o projeto de exemplo se chama Ki67: o nome é escolhido no projeto, não no app', () => {
    expect(INITIAL_PROJECTS.map((p) => p.name)).toContain('Ki67');
  });

  it('as imagens são locais (assets/demo), não links externos gerados por IA', () => {
    for (const img of INITIAL_IMAGES) {
      expect(img.imageUrl).toBe('asset://demo.jpg');
      expect(img.width).toBeGreaterThan(0);
      expect(img.height).toBeGreaterThan(0);
    }
  });
});
