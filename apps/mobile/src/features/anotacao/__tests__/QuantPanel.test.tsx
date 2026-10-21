import { fireEvent, render, screen } from '@testing-library/react-native';

import { QuantPanel } from '@/features/anotacao/QuantPanel';

const base = {
  counts: { reagents: 13, nonReagents: 21, total: 34 },
  activeLabel: 'reagente' as const,
  onLabel: jest.fn(),
  onPreAnnotate: jest.fn(),
  observation: '',
  onObservation: jest.fn(),
  activeVersion: 12,
  onHistory: jest.fn(),
};

describe('QuantPanel', () => {
  it('mostra a contagem de cada classe e o total', async () => {
    await render(<QuantPanel {...base} />);
    expect(screen.getByLabelText('Reagente: 13 marcados')).toBeTruthy();
    expect(screen.getByLabelText('Não reagente: 21 marcados')).toBeTruthy();
    expect(screen.getByText('34')).toBeTruthy();
  });

  it('não mostra índice, porcentagem nem faixas de estratificação', async () => {
    await render(<QuantPanel {...base} />);
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/ki-?67/i)).toBeNull();
    expect(screen.queryByText(/índice|baixo|intermedi|alto/i)).toBeNull();
  });

  it('troca a classe ativa ao tocar na outra classe', async () => {
    const onLabel = jest.fn();
    await render(<QuantPanel {...base} onLabel={onLabel} />);
    await fireEvent.press(screen.getByLabelText('Não reagente: 21 marcados'));
    expect(onLabel).toHaveBeenCalledWith('nao_reagente');
  });

  it('esconde a sugestão automática em modo somente leitura', async () => {
    await render(<QuantPanel {...base} readOnly />);
    expect(screen.queryByText('Sugerir não reagentes')).toBeNull();
  });
});
