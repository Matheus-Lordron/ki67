import { detectNuclei } from '@/features/anotacao/colorThreshold';

// Imagem sintética 200x200: fundo branco, um "núcleo" azul e um marrom.
function synthetic() {
  const width = 200;
  const height = 200;
  const data = new Uint8ClampedArray(width * height * 4).fill(245);
  const paint = (cx: number, cy: number, rgb: [number, number, number]) => {
    for (let y = cy - 3; y <= cy + 3; y++) {
      for (let x = cx - 3; x <= cx + 3; x++) {
        const i = (y * width + x) * 4;
        [data[i], data[i + 1], data[i + 2]] = rgb;
      }
    }
  };
  paint(20, 30, [110, 130, 190]); // hematoxilina (azul-claro)
  paint(70, 60, [140, 80, 45]); // DAB (marrom)
  return { data, width, height };
}

test('encontra um núcleo de cada cor, no centro de cada um, em % da imagem', () => {
  const marks = detectNuclei(synthetic());
  expect(marks).toHaveLength(2);
  const hema = marks.find((m) => m.label === 'nao_reagente')!;
  const dab = marks.find((m) => m.label === 'reagente')!;
  expect(hema).toMatchObject({ type: 'point', isAutoSuggested: true, origin: 'pre_anotacao', x: 10.25, y: 15.25 });
  expect(dab).toMatchObject({ x: 35.25, y: 30.25 });
});

test('fundo branco não gera sugestão', () => {
  const blank = { data: new Uint8ClampedArray(50 * 50 * 4).fill(250), width: 50, height: 50 };
  expect(detectNuclei(blank)).toEqual([]);
});
